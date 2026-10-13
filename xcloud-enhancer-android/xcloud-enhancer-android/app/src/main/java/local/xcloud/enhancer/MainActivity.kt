package local.xcloud.enhancer

import android.annotation.SuppressLint
import android.app.Activity
import android.os.Bundle
import android.view.View
import android.view.WindowManager
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature

// build.gradle: implementation("androidx.webkit:webkit:1.11.0")
// Manifest: <uses-permission android:name="android.permission.INTERNET"/>
// Para Android TV: adicione <category android:name="android.intent.category.LEANBACK_LAUNCHER"/>
// e <uses-feature android:name="android.software.leanback" android:required="false"/>
// Coloque xcloud-enhancer.user.js em app/src/main/assets/

class MainActivity : Activity() {
    private lateinit var web: WebView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        web = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false
            settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            // UA de desktop: o xCloud libera a interface completa e resoluções maiores
            settings.userAgentString =
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
                "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0"
            webViewClient = WebViewClient()
        }

        // Injeta o script ANTES do JS da página (equivalente ao @run-at document-start)
        if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            val js = assets.open("xcloud-enhancer.user.js").bufferedReader().readText()
            WebViewCompat.addDocumentStartJavaScript(web, js, setOf("https://www.xbox.com"))
        }

        setContentView(web)
        web.loadUrl("https://www.xbox.com/play")
    }

    // Tela cheia imersiva (útil em celular e TV)
    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) window.decorView.systemUiVisibility =
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or View.SYSTEM_UI_FLAG_FULLSCREEN or
            View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
    }

    override fun onBackPressed() {
        if (web.canGoBack()) web.goBack() else super.onBackPressed()
    }
}
