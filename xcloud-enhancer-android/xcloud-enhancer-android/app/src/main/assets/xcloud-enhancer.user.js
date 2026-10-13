// ==UserScript==
// @name         xCloud Enhancer (base)
// @namespace    local.xcloud.enhancer
// @version      0.1.0
// @description  Região, bitrate, stats, monitor de fila e notificações para o xCloud
// @match        https://www.xbox.com/*/play*
// @match        https://play.xbox.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  /* ---------- 1. Config persistente ---------- */
  const KEY = 'xce:config';
  const defaults = {
    region: 'auto',          // nome da região (ver lista capturada) ou 'auto'
    maxBitrateKbps: 0,       // 0 = não mexe
    showStats: true,
    notifySound: true,
    notifyBrowser: true,
    discordWebhook: '',      // https://discord.com/api/webhooks/...
    buttonMap: {},           // ex: { 0: 1, 1: 0 } troca A <-> B
  };
  const cfg = { ...defaults, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  const save = () => localStorage.setItem(KEY, JSON.stringify(cfg));

  const state = { regions: [], pc: null, queue: '—', status: '—' };

  /* ---------- 2. Hook de fetch: login, região e fila ---------- */
  const _fetch = window.fetch;
  window.fetch = async function (input, init) {
    let url = typeof input === 'string' ? input : input.url;

    // 2a. Troca de região: reescreve o host da criação de sessão
    if (/\/v5\/sessions\/cloud\/play/.test(url) && cfg.region !== 'auto') {
      const r = state.regions.find(x => x.name === cfg.region);
      if (r) {
        const target = new URL(r.baseUri);
        const u = new URL(url);
        u.host = target.host;
        url = u.toString();
        input = typeof input === 'string' ? url : new Request(url, input);
      }
    }

    const res = await _fetch.call(this, input, init);

    // 2b. Lê respostas sem consumir o body original
    try {
      if (/\/v2\/login\/user/.test(url)) {
        res.clone().json().then(j => {
          state.regions = j?.offeringSettings?.regions || [];
          console.log('[xce] regiões', state.regions.map(r => r.name));
        });
      } else if (/\/v5\/sessions\/cloud\//.test(url)) {
        res.clone().json().then(onSessionPayload).catch(() => {});
      }
    } catch (_) {}
    return res;
  };

  let notified = false;
  function onSessionPayload(j) {
    // Os nomes exatos dos campos variam: confira no DevTools > Network.
    state.status = j.state || state.status;
    const wait = j.waitTime ?? j.estimatedWaitTime ?? j.queuePosition;
    if (wait !== undefined) state.queue = String(wait);
    render();
    if (j.state === 'ReadyToConnect' && !notified) {
      notified = true;
      alertReady();
    }
    if (j.state === 'Provisioning' || j.state === 'WaitingForResources') notified = false;
  }

  /* ---------- 3. Hook de WebRTC: bitrate + captura do PeerConnection ---------- */
  const _setRemote = RTCPeerConnection.prototype.setRemoteDescription;
  RTCPeerConnection.prototype.setRemoteDescription = function (desc) {
    state.pc = this;
    if (cfg.maxBitrateKbps > 0 && desc?.sdp) {
      desc = { type: desc.type, sdp: capVideoBitrate(desc.sdp, cfg.maxBitrateKbps) };
    }
    return _setRemote.call(this, desc);
  };

  function capVideoBitrate(sdp, kbps) {
    // Insere/atualiza "b=AS" na seção de vídeo
    return sdp.replace(/(m=video[\s\S]*?\r\nc=IN [^\r\n]+\r\n)(b=AS:\d+\r\n)?/, `$1b=AS:${kbps}\r\n`);
  }

  /* ---------- 4. Mapeamento de botões ---------- */
  const _getGamepads = navigator.getGamepads.bind(navigator);
  navigator.getGamepads = () => Array.from(_getGamepads()).map(gp => {
    if (!gp || !Object.keys(cfg.buttonMap).length) return gp;
    const buttons = gp.buttons.map((_, i) => gp.buttons[cfg.buttonMap[i] ?? i]);
    return new Proxy(gp, { get: (t, p) => (p === 'buttons' ? buttons : Reflect.get(t, p)) });
  });

  /* ---------- 5. Stats em tempo real ---------- */
  setInterval(async () => {
    if (!cfg.showStats || !state.pc) return;
    const stats = await state.pc.getStats();
    let fps = 0, lost = 0, rtt = 0, jitter = 0;
    stats.forEach(s => {
      if (s.type === 'inbound-rtp' && s.kind === 'video') {
        fps = s.framesPerSecond || 0; lost = s.packetsLost || 0; jitter = s.jitter || 0;
      }
      if (s.type === 'candidate-pair' && s.state === 'succeeded' && s.currentRoundTripTime) {
        rtt = s.currentRoundTripTime * 1000;
      }
    });
    state.stats = `${fps} fps | ${rtt.toFixed(0)} ms | perda ${lost} | jitter ${(jitter * 1000).toFixed(1)} ms`;
    render();
  }, 1000);

  /* ---------- 6. Alertas ---------- */
  function alertReady() {
    if (cfg.notifySound) beep();
    if (cfg.notifyBrowser && Notification.permission === 'granted') {
      new Notification('xCloud', { body: 'Sua sessão está pronta!' });
    }
    if (cfg.discordWebhook) {
      _fetch(cfg.discordWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Sua sessão do xCloud está pronta.' }),
      }).catch(() => {});
    }
  }
  function beep() {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    o.connect(ctx.destination);
    o.frequency.value = 880;
    o.start();
    setTimeout(() => o.stop(), 400);
  }

  /* ---------- 7. Painel flutuante ---------- */
  let panel;
  function render() {
    if (!panel) return;
    panel.textContent =
      `Estado: ${state.status}\nFila: ${state.queue}\n` +
      (cfg.showStats ? (state.stats || 'stats: aguardando stream') : '');
  }
  document.addEventListener('DOMContentLoaded', () => {
    panel = document.createElement('pre');
    Object.assign(panel.style, {
      position: 'fixed', top: '8px', right: '8px', zIndex: 99999, margin: 0,
      padding: '8px 10px', font: '12px monospace', color: '#0f0',
      background: 'rgba(0,0,0,.65)', borderRadius: '6px', pointerEvents: 'none',
    });
    document.body.appendChild(panel);
    render();
    if (cfg.notifyBrowser && Notification.permission === 'default') Notification.requestPermission();
  });

  // Console: xce.set('region','BrazilSouth'); xce.set('maxBitrateKbps',8000)
  window.xce = { cfg, state, set: (k, v) => { cfg[k] = v; save(); } };
})();
