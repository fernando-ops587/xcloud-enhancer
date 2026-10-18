package local.xcloud.enhancer

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.ContentValues
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.net.Uri
import android.net.wifi.WifiManager
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.provider.MediaStore
import android.util.Base64
import android.view.InputDevice
import android.view.KeyEvent
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import java.io.File
import java.io.FileOutputStream
import java.io.OutputStream
import java.net.HttpURLConnection
import java.net.URL

class MainActivity : Activity() {
    private lateinit var web: WebView
    private val channelId = "xcloud_queue"
    private var script = ""
    private var docStart = false
    private var warned = false
    private var wifiLock: WifiManager.WifiLock? = null

    // Estado do atalho e do painel (o JS avisa quando o painel abre/fecha)
    @Volatile private var panelOpen = false
    private val down = mutableSetOf<Int>()
    private var comboLatched = false
    private var lastHatX = 0
    private var lastHatY = 0

    private var saveOut: OutputStream? = null
    private var saveUri: Uri? = null

    /** Ponte JS <-> Kotlin: o script chama XceNative.<método>(...) */
    inner class Bridge {
        @JavascriptInterface
        fun notify(title: String, body: String) = runOnUiThread { showNotification(title, body) }

        @JavascriptInterface
        fun vibrate(ms: Int) = doVibrate(ms.toLong())

        @JavascriptInterface
        fun setBrightness(v: Float) = runOnUiThread {
            val lp = window.attributes
            lp.screenBrightness = if (v <= 0f) WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE else v.coerceIn(0.05f, 1f)
            window.attributes = lp
        }

        @JavascriptInterface
        fun panel(open: Boolean) { panelOpen = open }

        @JavascriptInterface
        fun postJson(url: String, json: String) {
            // Só aceita webhooks do Discord
            if (!(url.startsWith("https://discord.com/api/webhooks/") || url.startsWith("https://discordapp.com/api/webhooks/"))) return
            Thread {
                try {
                    val c = URL(url).openConnection() as HttpURLConnection
                    c.requestMethod = "POST"
                    c.setRequestProperty("Content-Type", "application/json")
                    c.doOutput = true
                    c.outputStream.use { it.write(json.toByteArray()) }
                    c.responseCode
                    c.disconnect()
                } catch (_: Exception) { }
            }.start()
        }

        @JavascriptInterface
        fun saveBegin(name: String, mime: String) {
            try {
                val video = mime.startsWith("video")
                if (Build.VERSION.SDK_INT >= 29) {
                    val values = ContentValues().apply {
                        put(MediaStore.MediaColumns.DISPLAY_NAME, name)
                        put(MediaStore.MediaColumns.MIME_TYPE, mime)
                        put(
                            MediaStore.MediaColumns.RELATIVE_PATH,
                            (if (video) Environment.DIRECTORY_MOVIES else Environment.DIRECTORY_PICTURES) + "/xCloud"
                        )
                        put(MediaStore.MediaColumns.IS_PENDING, 1)
                    }
                    val coll = if (video) MediaStore.Video.Media.EXTERNAL_CONTENT_URI else MediaStore.Images.Media.EXTERNAL_CONTENT_URI
                    saveUri = contentResolver.insert(coll, values)
                    saveOut = saveUri?.let { contentResolver.openOutputStream(it) }
                } else {
                    val dir = getExternalFilesDir(if (video) Environment.DIRECTORY_MOVIES else Environment.DIRECTORY_PICTURES)
                    saveOut = FileOutputStream(File(dir, name))
                }
            } catch (_: Exception) { saveOut = null }
        }

        @JavascriptInterface
        fun saveChunk(b64: String) {
            try { saveOut?.write(Base64.decode(b64, Base64.DEFAULT)) } catch (_: Exception) { }
        }

        @JavascriptInterface
        fun saveEnd() {
            try { saveOut?.close() } catch (_: Exception) { }
            if (Build.VERSION.SDK_INT >= 29) {
                saveUri?.let {
                    contentResolver.update(it, ContentValues().apply { put(MediaStore.MediaColumns.IS_PENDING, 0) }, null, null)
                }
            }
            saveOut = null
            saveUri = null
            runOnUiThread { Toast.makeText(this@MainActivity, "Salvo na pasta xCloud (Filmes/Imagens)", Toast.LENGTH_SHORT).show() }
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        if ((applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
            WebView.setWebContentsDebuggingEnabled(true) // chrome://inspect para descobrir os seletores do Hub
        }

        if (Build.VERSION.SDK_INT >= 33 &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 1)

        script = assets.open("xcloud-enhancer.user.js").bufferedReader().readText()
        docStart = WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)

        web = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false
            settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            settings.userAgentString =
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
                "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0"
            webViewClient = object : WebViewClient() {
                // Reserva: se o aparelho não suporta injeção no início da página, injeta aqui (o script ignora a 2ª vez)
                override fun onPageStarted(view: WebView, url: String?, favicon: Bitmap?) { inject(view, url) }
                override fun onPageFinished(view: WebView, url: String?) {
                    inject(view, url)
                    // Diagnóstico: se o plug-in não carregou, avisa na hora
                    if (!warned && url != null && url.startsWith("https://www.xbox.com")) {
                        view.evaluateJavascript("!!window.xce") { r ->
                            if (r != "true" && !warned) {
                                warned = true
                                Toast.makeText(this@MainActivity, "O plug-in NÃO carregou nesta página. Tire um print e envie.", Toast.LENGTH_LONG).show()
                            }
                        }
                    }
                }
            }
            addJavascriptInterface(Bridge(), "XceNative")
        }

        // Injeta o script antes do JS da página (equivale a @run-at document-start)
        if (docStart) {
            WebViewCompat.addDocumentStartJavaScript(web, script, setOf("https://www.xbox.com", "https://play.xbox.com"))
        }

        web.setLayerType(View.LAYER_TYPE_HARDWARE, null)   // composição do vídeo na GPU

        try {
            val wm = applicationContext.getSystemService(WIFI_SERVICE) as WifiManager
            @Suppress("DEPRECATION")
            val mode = if (Build.VERSION.SDK_INT >= 29) WifiManager.WIFI_MODE_FULL_LOW_LATENCY else WifiManager.WIFI_MODE_FULL_HIGH_PERF
            wifiLock = wm.createWifiLock(mode, "xcloud-enhancer").apply { setReferenceCounted(false); acquire() }
        } catch (_: Exception) { }

        setContentView(web)
        val ver = try { packageManager.getPackageInfo(packageName, 0).versionName } catch (_: Exception) { "?" }
        Toast.makeText(this, "xCloud Enhancer $ver", Toast.LENGTH_LONG).show()
        web.loadUrl("https://www.xbox.com/play")
    }

    override fun onDestroy() {
        try { wifiLock?.let { if (it.isHeld) it.release() } } catch (_: Exception) { }
        super.onDestroy()
    }

    private fun inject(view: WebView, url: String?) {
        if (!docStart && url != null && (url.startsWith("https://www.xbox.com") || url.startsWith("https://play.xbox.com"))) {
            view.evaluateJavascript(script, null)
        }
    }

    @Suppress("DEPRECATION")
    private fun doVibrate(ms: Long) {
        val vib: Vibrator = if (Build.VERSION.SDK_INT >= 31)
            (getSystemService(VIBRATOR_MANAGER_SERVICE) as VibratorManager).defaultVibrator
        else getSystemService(VIBRATOR_SERVICE) as Vibrator
        if (Build.VERSION.SDK_INT >= 26) vib.vibrate(VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE))
        else vib.vibrate(ms)
    }

    private fun showNotification(title: String, body: String) {
        val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        val builder = if (Build.VERSION.SDK_INT >= 26) {
            nm.createNotificationChannel(NotificationChannel(channelId, "Fila do xCloud", NotificationManager.IMPORTANCE_HIGH))
            Notification.Builder(this, channelId)
        } else {
            @Suppress("DEPRECATION") Notification.Builder(this)
        }
        nm.notify(
            1,
            builder.setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentTitle(title).setContentText(body).setAutoCancel(true).build()
        )
    }

    private fun nav(cmd: String) { web.evaluateJavascript("window.xce&&xce.nav('$cmd')", null) }
    private fun togglePanel() { web.evaluateJavascript("window.xce&&xce.toggle()", null) }

    /**
     * Atalhos para abrir/fechar o painel:
     *  - Controle (gamepad): apertar View (Select) e Menu (Start) AO MESMO TEMPO.
     *  - Controle remoto da TV: botão de detalhes ("i", KEYCODE_INFO). A tecla Menu também funciona.
     * Com o painel aberto, o app consome os botões (o jogo não recebe nada) e traduz
     * D-Pad / A / B / LB / RB em comandos para o painel, venham do gamepad ou do controle remoto.
     */
    override fun dispatchKeyEvent(e: KeyEvent): Boolean {
        val c = e.keyCode

        if (c == KeyEvent.KEYCODE_INFO || c == KeyEvent.KEYCODE_MENU) {
            if (e.action == KeyEvent.ACTION_UP) togglePanel()
            return true
        }

        if (c == KeyEvent.KEYCODE_BUTTON_SELECT || c == KeyEvent.KEYCODE_BUTTON_START) {
            if (e.action == KeyEvent.ACTION_DOWN) {
                down.add(c)
                if (down.size == 2 && !comboLatched) { comboLatched = true; togglePanel() }
            } else if (e.action == KeyEvent.ACTION_UP) {
                down.remove(c)
                if (down.isEmpty()) comboLatched = false
            }
            if (panelOpen) return true
        }

        if (panelOpen) {
            val cmd = when (c) {
                KeyEvent.KEYCODE_DPAD_UP -> "up"
                KeyEvent.KEYCODE_DPAD_DOWN -> "down"
                KeyEvent.KEYCODE_DPAD_LEFT -> "left"
                KeyEvent.KEYCODE_DPAD_RIGHT -> "right"
                KeyEvent.KEYCODE_BUTTON_A, KeyEvent.KEYCODE_DPAD_CENTER, KeyEvent.KEYCODE_ENTER -> "ok"
                KeyEvent.KEYCODE_BUTTON_B, KeyEvent.KEYCODE_BACK -> "back"
                KeyEvent.KEYCODE_BUTTON_L1 -> "tabprev"
                KeyEvent.KEYCODE_BUTTON_R1 -> "tabnext"
                else -> null
            }
            if (cmd != null) {
                val repeatable = cmd == "up" || cmd == "down" || cmd == "left" || cmd == "right"
                if (e.action == KeyEvent.ACTION_DOWN && (e.repeatCount == 0 || repeatable)) nav(cmd)
                return true
            }
            if ((e.source and InputDevice.SOURCE_GAMEPAD) == InputDevice.SOURCE_GAMEPAD) return true
        }
        return super.dispatchKeyEvent(e)
    }

    // Alguns controles mandam o direcional como "hat" (eixo), não como tecla: tratamos aqui.
    override fun dispatchGenericMotionEvent(ev: MotionEvent): Boolean {
        if (panelOpen && (ev.source and InputDevice.SOURCE_JOYSTICK) == InputDevice.SOURCE_JOYSTICK &&
            ev.action == MotionEvent.ACTION_MOVE
        ) {
            var x = ev.getAxisValue(MotionEvent.AXIS_HAT_X)
            var y = ev.getAxisValue(MotionEvent.AXIS_HAT_Y)
            if (x == 0f && y == 0f) { x = ev.getAxisValue(MotionEvent.AXIS_X); y = ev.getAxisValue(MotionEvent.AXIS_Y) }
            val dx = if (x > 0.6f) 1 else if (x < -0.6f) -1 else 0
            val dy = if (y > 0.6f) 1 else if (y < -0.6f) -1 else 0
            if (dy != 0 && dy != lastHatY) nav(if (dy < 0) "up" else "down")
            if (dx != 0 && dx != lastHatX) nav(if (dx < 0) "left" else "right")
            lastHatX = dx
            lastHatY = dy
            return true
        }
        return super.dispatchGenericMotionEvent(ev)
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        @Suppress("DEPRECATION")
        if (hasFocus) window.decorView.systemUiVisibility =
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or View.SYSTEM_UI_FLAG_FULLSCREEN or
            View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
    }

    // "Voltar": fecha o painel primeiro; depois navega ou sai
    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        web.evaluateJavascript("(window.xce&&xce.back&&xce.back())") { r ->
            if (r != "true") { if (web.canGoBack()) web.goBack() else finish() }
        }
    }
}
