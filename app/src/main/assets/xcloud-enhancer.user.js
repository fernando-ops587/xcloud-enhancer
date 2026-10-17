// ==UserScript==
// @name         xCloud Enhancer
// @namespace    local.xcloud.enhancer
// @version      1.0.4
// @description  Hub nativo, WebGL, teclado+mouse, giroscópio, toque, perfis por jogo, clipes, fila e Android TV
// @match        https://www.xbox.com/*/play*
// @match        https://play.xbox.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(() => {
  'use strict';
  if (window.__xceLoaded) return;
  window.__xceLoaded = true;
  try {
  const VERSION = '1.0.4';
  const LS = 'xce:cfg', LSR = 'xce:regions', LSP = 'xce:profiles';
  const jget = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const IN_APP = () => !!window.XceNative;
  const native = (fn, ...a) => { try { return window.XceNative?.[fn]?.(...a); } catch (_) {} };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const clamp = (x, a = -1, b = 1) => Math.max(a, Math.min(b, x));

  /* ================= CONSTANTES ================= */
  const BTN = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'View', 'Menu', 'L3', 'R3', '↑', '↓', '←', '→'];
  const POS = [['tl', 'Topo esquerdo'], ['tr', 'Topo direito'], ['bl', 'Base esquerda'], ['br', 'Base direita']];
  const HUD_ITEMS = [['fps', 'FPS'], ['ping', 'Ping'], ['loss', 'Perda de pacotes'], ['jitter', 'Jitter'],
    ['bitrate', 'Bitrate'], ['res', 'Resolução'], ['decode', 'Tempo de decodificação'], ['audio', 'Buffer de áudio']];
  const KM_ACTIONS = [['up', 'Analógico ↑'], ['down', 'Analógico ↓'], ['left', 'Analógico ←'], ['right', 'Analógico →'],
    ['a', 'A'], ['b', 'B'], ['x', 'X'], ['y', 'Y'], ['lb', 'LB'], ['rb', 'RB'], ['l3', 'L3'], ['r3', 'R3'],
    ['view', 'View'], ['menu', 'Menu'], ['du', 'D-Pad ↑'], ['dd', 'D-Pad ↓'], ['dl', 'D-Pad ←'], ['dr', 'D-Pad →']];
  const KM_DEFAULT = { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', a: 'Space', b: 'KeyC', x: 'KeyR', y: 'KeyQ',
    lb: 'KeyG', rb: 'KeyF', l3: 'ShiftLeft', r3: 'KeyV', view: 'Tab', menu: 'Enter',
    du: 'ArrowUp', dd: 'ArrowDown', dl: 'ArrowLeft', dr: 'ArrowRight' };
  const KM_BTN = { a: 0, b: 1, x: 2, y: 3, lb: 4, rb: 5, l3: 10, r3: 11, view: 8, menu: 9, du: 12, dd: 13, dl: 14, dr: 15 };
  const SOUNDS = { beep: [[880, .15]], chime: [[880, .12], [1175, .12], [1568, .22]], alarm: [[988, .15], [0, .05], [988, .15], [0, .05], [988, .3]] };
  const PROFILE_KEYS = ['resolution', 'bitrate', 'codec', 'gl', 'cas', 'fxaa', 'gamma', 'vibrance', 'colorMode', 'brightness',
    'contrast', 'saturate', 'aspect', 'stretch', 'curve', 'deadzone', 'map', 'km', 'kmSens', 'kmAccel', 'kmDead', 'kmInvert',
    'keymap', 'gyro', 'gyroMode', 'gyroSens', 'gyroHold', 'touch', 'touchSize', 'touchOpacity', 'hudMode'];
  const TEMPLATES = {
    'Tiro (FPS)': { gl: true, cas: 8, fxaa: false, deadzone: 8, curve: 'aggressive', km: true, kmSens: 50 },
    'Corrida': { gl: true, vibrance: 30, gyro: true, gyroMode: 'steer', gyroHold: 'always' },
    'Aventura': { gl: true, cas: 5, fxaa: true, vibrance: 25, curve: 'linear', km: false, gyro: false },
  };

  /* ================= ESQUEMA DE CONFIGURAÇÕES ================= */
  const SCHEMA = [
    { id: 'video', icon: '🎬', title: 'Vídeo', items: [
      { k: 'resolution', t: 'select', def: 'auto', label: 'Resolução do stream',
        desc: 'Pede 720p ou 1080p ao servidor. 1440p depende da conta/servidor e não é garantido.',
        opts: [['auto', 'Automática'], ['720p', '720p'], ['1080p', '1080p']] },
      { k: 'bitrate', t: 'range', def: 0, min: 0, max: 30, step: 1, fmt: v => v ? `${v} Mbps` : 'Auto', label: 'Limite de bitrate', desc: '0 deixa o xCloud decidir.' },
      { k: 'codec', t: 'select', def: 'auto', label: 'Codec preferido', desc: 'Só vale se o aparelho suportar.',
        opts: [['auto', 'Automático'], ['H264', 'H.264'], ['VP9', 'VP9'], ['AV1', 'AV1'], ['H265', 'H.265 (HEVC)']] },
      { t: 'h', label: 'Pós-processamento (WebGL)' },
      { k: 'gl', t: 'toggle', def: false, label: 'Ativar shaders WebGL', desc: 'Usa a GPU para nitidez, cores e proporção. Em TVs fracas, deixe desligado.' },
      { k: 'cas', t: 'range', def: 0, min: 0, max: 10, step: 1, fmt: v => v ? v + '/10' : 'Desligada', label: 'Nitidez adaptativa (CAS)' },
      { k: 'fxaa', t: 'toggle', def: false, label: 'Anti-aliasing leve (estilo FXAA)', desc: 'Só no modo WebGL.' },
      { k: 'gamma', t: 'range', def: 100, min: 70, max: 140, step: 5, fmt: v => (v / 100).toFixed(2), label: 'Correção de gama' },
      { k: 'vibrance', t: 'range', def: 0, min: 0, max: 100, step: 5, fmt: v => v + '%', label: 'Vibrance (cores inteligentes)', desc: 'Realça cores apagadas sem estourar as vivas. Bom para OLED.' },
      { k: 'colorMode', t: 'select', def: 'none', label: 'Modo de cor / acessibilidade', desc: 'Daltonismo e contraste só no modo WebGL.',
        opts: [['none', 'Normal'], ['protan', 'Protanopia'], ['deutan', 'Deuteranopia'], ['tritan', 'Tritanopia'], ['contrast', 'Alto contraste'], ['night', 'Modo escuro (noturno)']] },
      { t: 'h', label: 'Áudio' },
      { k: 'audioLatency', t: 'select', def: 'auto', label: 'Atraso do áudio', desc: 'Reduz o buffer do áudio do stream. Se estalar, suba para Equilibrado ou Estável. O pill "Áudio" nas estatísticas mostra o buffer atual em ms.',
        opts: [['auto', 'Automático (não altera)'], ['low', 'Baixo atraso'], ['balanced', 'Equilibrado'], ['stable', 'Estável']] },
      { t: 'note', label: 'Som atrasado só na TV? Teste "Baixo atraso". Se o pill "Áudio" já mostrar pouco (menos de 40 ms), o atraso vem da TV ou do aparelho de som: ative o Modo Jogo e desligue efeitos de áudio nas configurações da TV.' },
      { t: 'h', label: 'Imagem' },
      { k: 'brightness', t: 'range', def: 100, min: 50, max: 150, step: 5, fmt: v => v + '%', label: 'Brilho' },
      { k: 'contrast', t: 'range', def: 100, min: 50, max: 150, step: 5, fmt: v => v + '%', label: 'Contraste' },
      { k: 'saturate', t: 'range', def: 100, min: 0, max: 200, step: 5, fmt: v => v + '%', label: 'Saturação' },
      { k: 'aspect', t: 'select', def: 'contain', label: 'Proporção da imagem',
        desc: '"Preencher" corta as bordas sem distorcer (ótimo em ultrawide e celulares 20:9).',
        opts: [['contain', 'Manter (barras pretas)'], ['cover', 'Preencher sem distorcer (corta)'], ['fill', 'Esticar']] },
      { k: 'stretch', t: 'range', def: 0, min: 0, max: 100, step: 5, fmt: v => v + '%', label: 'Esticar parcialmente', desc: 'Só com "Manter" + WebGL: reduz as barras com distorção leve.' },
    ]},
    { id: 'net', icon: '🌐', title: 'Rede', items: [
      { t: 'note', label: 'O login continua na sua região original. Só a criação da sessão de streaming é enviada ao datacenter escolhido.' },
      { k: 'region', t: 'select', def: 'auto', label: 'Região do servidor', desc: 'A lista aparece depois de abrir o xCloud logado. ★ = padrão da Microsoft.',
        opts: () => [['auto', 'Automática']].concat(state.regions.map(r => [r.name, r.name + (state.ping[r.name] ? ` · ${state.ping[r.name]} ms` : '') + (r.isDefault ? ' ★' : '')])) },
      { k: 'regionMode', t: 'select', def: 'login', label: 'Método de troca de região', desc: 'Se o jogo não entrar com a região escolhida, teste o outro método.',
        opts: [['login', 'Padrão (altera a lista de regiões do login)'], ['host', 'Alternativo (troca o servidor da sessão)']] },
      { k: 'fallbackAuto', t: 'toggle', def: true, label: 'Se a região escolhida falhar, tentar a automática', desc: 'Evita ficar preso quando uma região está cheia ou indisponível para a sua conta.' },
      { t: 'dash', label: 'Painel de regiões', desc: 'Ping em tempo real. Toque em "Usar" para trocar com 1 clique.' },
      { t: 'button', label: 'Medir agora', btn: 'Medir', run: () => pingRegions() },
      { k: 'autoPing', t: 'toggle', def: true, label: 'Medir ping automaticamente', desc: 'A cada 20 s enquanto esta aba ou o Hub estiverem abertos.' },
      { k: 'retries', t: 'range', def: 0, min: 0, max: 5, step: 1, fmt: v => v ? v + ' tentativas' : 'Desligado', label: 'Repetir se a criação da sessão falhar', desc: 'Só repete erros do servidor (5xx/429), com espera crescente. Não afeta a fila.' },
      { k: 'noTelemetry', t: 'toggle', def: false, label: 'Bloquear telemetria', desc: 'Se algo quebrar, desligue.' },
    ]},
    { id: 'queue', icon: '⏳', title: 'Fila e alertas', items: [
      { k: 'queuePanel', t: 'toggle', def: true, label: 'Cartão da fila', desc: 'Posição, tempo estimado e velocidade. Aparece só enquanto você espera.' },
      { k: 'notifySound', t: 'toggle', def: true, label: 'Som quando a sessão estiver pronta' },
      { k: 'soundType', t: 'select', def: 'chime', label: 'Som do alerta', opts: [['beep', 'Bipe'], ['chime', 'Sino'], ['alarm', 'Alarme']] },
      { k: 'soundVol', t: 'range', def: 40, min: 5, max: 100, step: 5, fmt: v => v + '%', label: 'Volume do alerta' },
      { k: 'notifyBrowser', t: 'toggle', def: true, label: 'Notificação do sistema', desc: 'No app usa a notificação nativa do Android.' },
      { k: 'webhook', t: 'text', def: '', label: 'Webhook do Discord', ph: 'https://discord.com/api/webhooks/...', desc: 'Envia o nome do jogo e a imagem. No navegador pode ser bloqueado pela política de segurança do site; no app funciona.' },
      { k: 'discordId', t: 'text', def: '', label: 'Seu ID do Discord (para marcar @você)', ph: '123456789012345678' },
      { t: 'button', label: 'Testar alertas', btn: 'Testar', run: () => alertReady(true) },
    ]},
    { id: 'hud', icon: '📊', title: 'Estatísticas', items: [
      { k: 'hudMode', t: 'select', def: 'hub', label: 'Quando mostrar', desc: 'Atalho Ctrl+Shift+S alterna entre sempre e desligado.',
        opts: [['hub', 'Só com o Hub/painel aberto'], ['always', 'Sempre'], ['off', 'Desligado']] },
      ...HUD_ITEMS.map(([id, name]) => ({ k: 'hud_' + id, t: 'toggle', def: id !== 'decode', label: name })),
      { k: 'hudPos', t: 'select', def: 'tl', label: 'Posição', opts: POS },
      { k: 'hudSize', t: 'select', def: 'm', label: 'Tamanho', opts: [['s', 'Pequeno'], ['m', 'Médio'], ['l', 'Grande']] },
      { k: 'hudOpacity', t: 'range', def: 85, min: 20, max: 100, step: 5, fmt: v => v + '%', label: 'Opacidade' },
    ]},
    { id: 'pad', icon: '🎮', title: 'Controle', items: [
      { t: 'h', label: 'Analógicos e botões' },
      { k: 'curve', t: 'select', def: 'linear', label: 'Curva de resposta', desc: 'Exponencial = mais preciso no centro. Agressiva = reage mais rápido.',
        opts: [['linear', 'Linear'], ['expo', 'Exponencial'], ['aggressive', 'Agressiva'], ['smooth', 'Suave']] },
      { k: 'deadzone', t: 'range', def: 0, min: 0, max: 30, step: 1, fmt: v => v + '%', label: 'Zona morta' },
      { k: 'combo', t: 'toggle', def: true, label: 'Abrir o painel com View + Menu (Start)', desc: 'Aperte os dois ao mesmo tempo. No painel: direcional navega, A confirma, B fecha, LB/RB trocam de aba. O jogo não recebe comandos enquanto o painel está aberto.' },
      { t: 'button', label: 'Predefinição: trocar A ↔ B', btn: 'Aplicar', run: () => set('map', { 0: 1, 1: 0 }) },
      { t: 'button', label: 'Predefinição: trocar X ↔ Y', btn: 'Aplicar', run: () => set('map', { ...cfg.map, 2: 3, 3: 2 }) },
      { k: 'map', t: 'remap', def: {}, label: 'Mapeamento de botões', desc: 'O que cada botão físico vai fazer.' },
      { t: 'h', label: 'Teclado + mouse' },
      { k: 'km', t: 'toggle', def: false, label: 'Emular controle com teclado e mouse', desc: 'Clique no jogo para capturar o mouse (Esc libera). Mouse = analógico direito; botão esquerdo = RT; direito = LT.' },
      { k: 'kmSens', t: 'range', def: 50, min: 5, max: 150, step: 5, fmt: v => v + '%', label: 'Sensibilidade do mouse' },
      { k: 'kmAccel', t: 'range', def: 0, min: 0, max: 100, step: 5, fmt: v => v + '%', label: 'Aceleração do mouse' },
      { k: 'kmDead', t: 'range', def: 8, min: 0, max: 30, step: 1, fmt: v => v + '%', label: 'Compensação da zona morta do jogo', desc: 'Pula a zona morta interna do jogo para a mira responder logo.' },
      { k: 'kmInvert', t: 'toggle', def: false, label: 'Inverter eixo Y do mouse' },
      { k: 'keymap', t: 'keymap', def: {}, label: 'Teclas', desc: 'Toque em uma tecla e pressione a nova.' },
      { t: 'h', label: 'Giroscópio (celular/tablet)' },
      { k: 'gyro', t: 'toggle', def: false, label: 'Usar giroscópio' },
      { k: 'gyroMode', t: 'select', def: 'aim', label: 'Modo', opts: [['aim', 'Mira (analógico direito)'], ['steer', 'Volante (analógico esquerdo)']] },
      { k: 'gyroHold', t: 'select', def: 'always', label: 'Ativar quando', opts: [['always', 'Sempre'], ['lt', 'Segurando LT'], ['rt', 'Segurando RT']] },
      { k: 'gyroSens', t: 'range', def: 50, min: 5, max: 200, step: 5, fmt: v => v + '%', label: 'Sensibilidade' },
      { k: 'gyroInvX', t: 'toggle', def: false, label: 'Inverter horizontal' },
      { k: 'gyroInvY', t: 'toggle', def: false, label: 'Inverter vertical' },
      { t: 'h', label: 'Controles de toque' },
      { k: 'touch', t: 'toggle', def: false, label: 'Mostrar controles na tela', desc: 'Só durante o jogo e escondidos quando o painel ou o Hub estão abertos.' },
      { k: 'touchSize', t: 'range', def: 100, min: 60, max: 160, step: 5, fmt: v => v + '%', label: 'Tamanho' },
      { k: 'touchOpacity', t: 'range', def: 55, min: 15, max: 100, step: 5, fmt: v => v + '%', label: 'Opacidade' },
      { k: 'haptic', t: 'toggle', def: true, label: 'Vibração ao tocar' },
    ]},
    { id: 'qol', icon: '🧩', title: 'Automação', items: [
      { t: 'h', label: 'Perfis por jogo' },
      { k: 'autoProfile', t: 'toggle', def: true, label: 'Carregar o perfil do jogo automaticamente' },
      { t: 'profiles', label: 'Perfil do jogo atual' },
      { t: 'h', label: 'Durante o jogo' },
      { k: 'introSec', t: 'range', def: 0, min: 0, max: 30, step: 1, fmt: v => v ? v + ' s' : 'Desligado', label: 'Pular introdução', desc: 'Pressiona A repetidamente nos primeiros segundos. Pode escolher opções de menu por engano.' },
      { k: 'wakeLock', t: 'toggle', def: true, label: 'Manter a tela ligada' },
      { k: 'bgMute', t: 'toggle', def: true, label: 'Silenciar ao sair da aba/janela', desc: 'Só no navegador (no app o Android já cuida disso).' },
      { t: 'h', label: 'Clipes e capturas' },
      { k: 'clips', t: 'toggle', def: false, label: 'Gravar buffer de clipe', desc: 'Grava continuamente na memória (usa CPU e RAM).' },
      { k: 'clipSec', t: 'select', def: '30', label: 'Janela do clipe', desc: 'O clipe salvo terá entre metade e o total desta janela.', opts: [['30', '30 s'], ['60', '60 s']] },
      { t: 'button', label: 'Salvar clipe agora (Ctrl+Shift+K)', btn: 'Salvar', run: () => saveClip() },
      { t: 'button', label: 'Capturar tela (Ctrl+Shift+P)', btn: 'Capturar', run: () => screenshot() },
      { t: 'h', label: 'Aparelho (app Android)' },
      { k: 'devBright', t: 'range', def: 0, min: 0, max: 100, step: 5, fmt: v => v ? v + '%' : 'Sistema', label: 'Brilho da tela', when: () => IN_APP() },
      { t: 'button', label: 'Testar vibração', btn: 'Vibrar', run: () => buzz(60), when: () => IN_APP() },
    ]},
    { id: 'ui', icon: '✨', title: 'Interface', items: [
      { k: 'accent', t: 'select', def: 'green', label: 'Cor de destaque', opts: [['green', 'Verde Xbox'], ['blue', 'Azul'], ['purple', 'Roxo'], ['orange', 'Laranja']] },
      { t: 'note', label: 'Durante o jogo não há botão na tela. Para abrir o painel: botão do Hub, botão Voltar do Android, toque com 3 dedos, segurar o topo da tela por 1 s, View + Menu (controle) ou Ctrl+Shift+X (teclado).' },
      { k: 'backOpens', t: 'toggle', def: true, label: 'Botão Voltar abre o painel durante o jogo (app)' },
      { k: 'gesture3', t: 'toggle', def: true, label: 'Toque com 3 dedos abre o painel', desc: 'Desligado automaticamente se os controles de toque estiverem ativos.' },
      { k: 'gestureTop', t: 'toggle', def: true, label: 'Segurar o topo da tela por 1 s abre o painel' },
      { k: 'closeGuide', t: 'toggle', def: true, label: 'Fechar o Hub do Xbox ao abrir o painel', desc: 'O Hub prende o foco do teclado/controle; fechá-lo deixa a navegação do painel funcionar.' },
      { k: 'gearOutside', t: 'toggle', def: true, label: 'Botão ⚙ nos menus e na fila (some quando o Hub está aberto e durante o jogo)' },
      { k: 'gearPos', t: 'select', def: 'bl', label: 'Posição do botão ⚙', opts: POS },
      { k: 'gearFade', t: 'toggle', def: true, label: 'Esmaecer o botão ⚙ quando parado' },
      { k: 'hubSelector', t: 'text', def: '', label: 'Seletor CSS do Hub (avançado)', ph: 'Deixe vazio para detectar automaticamente' },
      { k: 'autoFs', t: 'toggle', def: false, label: 'Tela cheia no primeiro toque', desc: 'Só no navegador.' },
      { t: 'button', label: 'Silenciar / ativar som', btn: 'Alternar', run: () => toggleMute() },
      { t: 'button', label: 'Tela cheia', btn: 'Alternar', run: () => toggleFs() },
      { k: 'css', t: 'area', def: '', label: 'CSS personalizado', ph: '.alguma-coisa { display:none }' },
    ]},
    { id: 'adv', icon: '🧰', title: 'Avançado', items: [
      { k: 'debug', t: 'toggle', def: false, label: 'Log de depuração no console' },
      { t: 'button', label: 'Descobrir elementos do Hub', desc: 'Lista no campo abaixo classes que parecem ser do menu do Xbox.', btn: 'Listar', run: () => { J().value = discover().join('\n') || 'Nada encontrado. Abra o Hub durante o jogo e tente de novo.'; } },
      { t: 'area', id: 'json', label: 'Exportar / importar', ph: 'Clique em Exportar, ou cole um JSON e clique em Importar.' },
      { t: 'button', label: 'Exportar configurações', btn: 'Exportar', run: () => { J().value = JSON.stringify(cfg, null, 1); } },
      { t: 'button', label: 'Importar configurações', btn: 'Importar', run: () => { try { Object.assign(cfg, JSON.parse(J().value)); save(); applyStyle(); refresh(); toast('Importado'); } catch { toast('JSON inválido'); } } },
      { t: 'button', label: 'Restaurar padrões', desc: 'Toque duas vezes.', btn: 'Restaurar', danger: true, run: b => {
          if (!b._c) { b._c = 1; b.textContent = 'Confirmar?'; setTimeout(() => { b._c = 0; b.textContent = 'Restaurar'; }, 3000); return; }
          Object.assign(cfg, defaults()); save(); applyStyle(); refresh(); toast('Padrões restaurados'); } },
      { t: 'note', label: `xCloud Enhancer v${VERSION} · projeto independente, sem relação com a Microsoft.` },
    ]},
  ];

  const defaults = () => { const d = {}; SCHEMA.forEach(s => s.items.forEach(i => { if (i.k) d[i.k] = i.def; })); return d; };
  const cfg = Object.assign(defaults(), jget(LS, {}));
  const save = () => localStorage.setItem(LS, JSON.stringify(cfg));
  const log = (...a) => cfg.debug && console.log('[xce]', ...a);

  const state = { regions: jget(LSR, []), ping: {}, pc: null, status: '', queue: null, eta: null, speed: null, samples: [], stats: {},
    open: false, ready: false, streaming: false, hubOpen: false, game: null, retry: 0 };
  const ui = { tab: 'video' };

  function set(k, v) {
    cfg[k] = v; save(); applyStyle(); renderHud(); renderQueue(); updateTouch();
    if (k === 'gl') glSync();
    if (k === 'clips') state.streaming && (cfg.clips ? clipStart() : clipStop());
    if (k === 'devBright') native('setBrightness', v / 100);
    if (['map', 'keymap', 'accent', 'gearPos', 'hudMode'].includes(k)) refresh();
  }
  function setMany(o) { Object.assign(cfg, o); save(); applyStyle(); glSync(); renderHud(); updateTouch(); refresh(); }

  /* ================= PERFIS POR JOGO ================= */
  const profiles = () => jget(LSP, {});
  const gameFromUrl = () => {
    const m = location.pathname.match(/\/launch\/([^/]+)\/([^/?#]+)/); const slug = m?.[1] || '';
    return { key: m?.[2] || slug || 'desconhecido', name: slug ? slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : (document.title || 'Jogo') };
  };
  function saveProfile() {
    if (!state.game) return toast('Abra um jogo primeiro');
    const p = profiles(), o = {}; PROFILE_KEYS.forEach(k => o[k] = cfg[k]);
    p[state.game.key] = { name: state.game.name, cfg: o }; localStorage.setItem(LSP, JSON.stringify(p)); toast('Perfil salvo'); refresh();
  }
  function loadProfile(key) {
    const p = profiles()[key]; if (!p) return false;
    setMany(p.cfg); toast('Perfil aplicado: ' + p.name); return true;
  }
  function deleteProfile() {
    if (!state.game) return; const p = profiles(); delete p[state.game.key]; localStorage.setItem(LSP, JSON.stringify(p)); toast('Perfil apagado'); refresh();
  }

  /* ================= HOOK: fetch / XHR / beacon / WebSocket ================= */
  const TELEMETRY = /(browser|mobile)\.events\.data\.microsoft\.com|arc\.msn\.com|dc\.services\.visualstudio\.com/i;
  const OS_BY_RES = { '720p': 'android', '1080p': 'windows' };
  const _fetch = window.fetch;
  let notified = false;

  window.fetch = async function (input, init) {
    let url = typeof input === 'string' ? input : (input?.url || String(input));
    const method = (init?.method || input?.method || 'GET').toUpperCase();
    if (cfg.noTelemetry && TELEMETRY.test(url)) return new Response('', { status: 204 });

    const isLogin = /\/v2\/login\/user/.test(url);
    const isPlay = /\/v5\/sessions\/cloud\/play/.test(url) && method === 'POST';
    if (isPlay) {
      let body = null; try { body = typeof init?.body === 'string' ? JSON.parse(init.body) : null; } catch (_) {}
      const g = gameFromUrl(); state.game = { key: body?.titleId || g.key, name: g.name };
      if (cfg.autoProfile && loadProfile(state.game.key)) log('perfil', state.game);
      state.samples = []; state.queue = null; state.eta = null; state.speed = null; state.retry = 0; notified = false; state.pc = null; state.stats = {}; prev = null;

      // Método alternativo: troca só o host desta chamada (o padrão altera a lista de regiões no login, ver patchLogin)
      if (cfg.region !== 'auto' && cfg.regionMode === 'host') {
        const reg = state.regions.find(x => x.name === cfg.region);
        if (reg) { const u = new URL(url); u.host = new URL(reg.baseUri).host; url = u.toString(); input = typeof input === 'string' ? url : new Request(url, input); }
      }
      if (cfg.resolution !== 'auto' && body?.settings) {
        body.settings.osName = OS_BY_RES[cfg.resolution]; init = { ...init, body: JSON.stringify(body) }; log('osName', body.settings.osName);
      }
      try { toast('Servidor da sessão: ' + new URL(url).host.split('.')[0]); } catch (_) {}
    }
    let res = isPlay ? await playWithRetry(input, init, this) : await _fetch.call(this, input, init);

    // Região escolhida falhou: tenta de novo na região automática (a original da Microsoft)
    if (isPlay && !res.ok && cfg.region !== 'auto' && cfg.fallbackAuto && state.origDefault) {
      try {
        const u = new URL(url), fb = new URL(state.origDefault).host;
        if (u.host !== fb) {
          u.host = fb; url = u.toString(); toast(`A região ${cfg.region} falhou (${res.status}). Tentando a automática…`);
          res = await _fetch.call(this, typeof input === 'string' ? url : new Request(url, input), init);
        }
      } catch (_) {}
    }
    if (isLogin) { const patched = await patchLogin(res); if (patched) return patched; }
    inspect(url, res);
    return res;
  };

  // Região (método padrão): o próprio site escolhe a região marcada como padrão na resposta do login.
  // Assim todo o fluxo (token, corpo e consulta da sessão) continua consistente, sem trocar nada "no meio".
  async function patchLogin(res) {
    let j; try { j = await res.clone().json(); } catch (_) { return null; }
    const regs = j?.offeringSettings?.regions; if (!regs?.length) return null;
    state.origDefault = (regs.find(r => r.isDefault) || regs[0]).baseUri;
    state.regions = regs.map(r => ({ ...r })); localStorage.setItem(LSR, JSON.stringify(state.regions)); refresh();
    if (cfg.region === 'auto' || cfg.regionMode !== 'login') return null;
    const t = regs.find(r => r.name === cfg.region); if (!t) return null;
    regs.forEach(r => { r.isDefault = r === t; }); log('login: região padrão →', t.name);
    return new Response(JSON.stringify(j), { status: res.status, statusText: res.statusText, headers: { 'Content-Type': 'application/json' } });
  }

  async function playWithRetry(input, init, ctx) {
    let n = 0;
    for (;;) {
      const res = await _fetch.call(ctx, input instanceof Request ? input.clone() : input, init);
      const retriable = res.status >= 500 || res.status === 429;
      if (res.ok || !retriable || n >= cfg.retries) return res;
      const ra = +res.headers.get('Retry-After') || 0, wait = Math.max(ra * 1000, 10000 * 2 ** n);
      state.retry = ++n; renderQueue(); toast(`Erro ${res.status}. Nova tentativa em ${Math.round(wait / 1000)} s (${n}/${cfg.retries})`);
      await sleep(wait);
    }
  }

  function inspect(url, res) {
    try { if (/\/v5\/sessions\/cloud\//.test(url)) res.clone().json().then(j => onSession(j)).catch(() => {}); } catch (_) {}
  }

  const _open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (m, u, ...r) { if (cfg.noTelemetry && TELEMETRY.test(String(u))) u = 'data:text/plain,'; return _open.call(this, m, u, ...r); };
  const _beacon = navigator.sendBeacon?.bind(navigator);
  if (_beacon) navigator.sendBeacon = (u, d) => (cfg.noTelemetry && TELEMETRY.test(String(u))) ? true : _beacon(u, d);

  const _WS = window.WebSocket;
  if (_WS) {
    const WS = function (...a) {
      const ws = new _WS(...a);
      ws.addEventListener('message', e => { if (typeof e.data === 'string' && e.data[0] === '{') { try { onSession(JSON.parse(e.data), true); } catch (_) {} } });
      return ws;
    };
    WS.prototype = _WS.prototype; ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'].forEach((k, i) => { WS[k] = i; });
    window.WebSocket = WS;
  }

  /* ================= FILA ================= */
  const PT = { Provisioning: 'Preparando', WaitingForResources: 'Na fila', ReadyToConnect: 'Sessão pronta', Provisioned: 'Conectando', Failed: 'Falhou', Queued: 'Na fila' };
  function dig(o, re, d = 0) {
    if (!o || typeof o !== 'object' || d > 4) return;
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === 'number' && re.test(k)) return v;
      if (v && typeof v === 'object') { const r = dig(v, re, d + 1); if (r !== undefined) return r; }
    }
  }
  function onSession(j, fromWs) {
    if (!j || typeof j !== 'object') return;
    log(fromWs ? 'ws' : 'sessão', j);
    if (!fromWs && typeof j.state === 'string') state.status = j.state;
    // Os nomes exatos dos campos podem mudar: confira no DevTools > Network e ajuste as expressões.
    const pos = dig(j, /queue.*pos|^position$|waitingposition/i), wait = dig(j, /wait.*(time|sec)|^eta$/i);
    if (pos !== undefined) {
      state.queue = pos; const now = Date.now(); state.samples.push([now, pos]); state.samples = state.samples.slice(-10);
      const [t0, p0] = state.samples[0], dt = (now - t0) / 1000, rate = state.samples.length > 2 && dt > 0 ? (p0 - pos) / dt : 0;
      state.speed = rate > 0 ? rate * 60 : null; state.eta = rate > 0 ? pos / rate : (wait ?? null);
    } else if (wait !== undefined) state.eta = wait;
    renderQueue();
    if (!fromWs) {
      if (j.state === 'ReadyToConnect' && !notified) { notified = true; alertReady(); }
      if (j.state === 'Failed') toast('A sessão falhou. Tente iniciar de novo.');
    }
  }
  const fmtTime = s => s == null ? '—' : s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.round((s % 3600) / 60)}min` : s >= 60 ? `${Math.round(s / 60)} min` : `${Math.round(s)} s`;

  /* ================= ALERTAS ================= */
  function alertReady(test) {
    const g = state.game?.name, msg = test ? 'Teste de alerta do xCloud Enhancer' : `${g ? g + ': s' : 'S'}ua sessão está pronta!`;
    if (cfg.notifySound) playSound();
    if (cfg.notifyBrowser) {
      if (IN_APP()) native('notify', 'xCloud', msg);
      else if ('Notification' in window) {
        const go = () => new Notification('xCloud', { body: msg });
        Notification.permission === 'granted' ? go() : Notification.requestPermission().then(p => p === 'granted' && go());
      }
    }
    discord(msg);
    if (test) toast('Alertas enviados');
  }
  function playSound() {
    try {
      const c = new (window.AudioContext || window.webkitAudioContext)(), g = c.createGain(); g.connect(c.destination); g.gain.value = cfg.soundVol / 250;
      let t = c.currentTime;
      for (const [f, d] of SOUNDS[cfg.soundType] || SOUNDS.beep) { if (f) { const o = c.createOscillator(); o.frequency.value = f; o.connect(g); o.start(t); o.stop(t + d); } t += d; }
      setTimeout(() => c.close(), (t - c.currentTime) * 1000 + 300);
    } catch (_) {}
  }
  function discord(msg) {
    if (!cfg.webhook) return;
    const img = document.querySelector('meta[property="og:image"]')?.content, id = cfg.discordId.trim();
    const json = JSON.stringify({ content: id ? `<@${id}>` : undefined, allowed_mentions: id ? { users: [id] } : { parse: [] },
      embeds: [{ title: state.game?.name || 'xCloud', description: msg, color: 0x3ddc84, image: img ? { url: img } : undefined }] });
    if (IN_APP()) native('postJson', cfg.webhook, json);
    else _fetch(cfg.webhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: json }).catch(() => toast('Webhook bloqueado pelo navegador. Use o app.'));
  }

  /* ================= PING DAS REGIÕES ================= */
  let pinging = false;
  async function pingRegions(silent) {
    if (!state.regions.length) return silent || toast('Abra o xCloud logado para carregar as regiões');
    if (pinging) return; pinging = true; silent || toast('Medindo…');
    await Promise.all(state.regions.map(async r => {
      let best = Infinity;
      for (let i = 0; i < 3; i++) {
        const t = performance.now();
        try { await _fetch(r.baseUri + '?xce=' + Math.random(), { mode: 'no-cors', cache: 'no-store' }); best = Math.min(best, performance.now() - t); } catch (_) {}
      }
      state.ping[r.name] = isFinite(best) ? Math.round(best) : 0;
    }));
    pinging = false; renderDash(); silent || toast('Ping atualizado');
  }
  setInterval(() => { if (cfg.autoPing && state.regions.length && ((state.open && ui.tab === 'net') || state.hubOpen)) pingRegions(true); }, 20000);

  /* ================= HOOK: WebRTC ================= */
  const pcs = new Set();
  const AUDIO_TARGET = { low: 0, balanced: 30, stable: 80 };
  // jitterBufferTarget / playoutDelayHint controlam quanto áudio o navegador guarda antes de tocar (menos = menos atraso)
  function applyAudioLatency() {
    const t = AUDIO_TARGET[cfg.audioLatency]; if (t == null) return;
    for (const pc of pcs) {
      if (pc.connectionState === 'closed') { pcs.delete(pc); continue; }
      try { for (const r of pc.getReceivers()) if (r.track?.kind === 'audio') {
        if ('jitterBufferTarget' in r && r.jitterBufferTarget !== t) r.jitterBufferTarget = t;
        if ('playoutDelayHint' in r && r.playoutDelayHint !== t / 1000) r.playoutDelayHint = t / 1000;
      } } catch (_) {}
    }
  }
  const capBitrate = (sdp, mbps) => !mbps ? sdp : sdp.replace(/(m=video[\s\S]*?\r\nc=IN [^\r\n]+\r\n)(b=AS:\d+\r\n)?/, `$1b=AS:${mbps * 1000}\r\n`);
  for (const fn of ['setLocalDescription', 'setRemoteDescription']) {
    const orig = RTCPeerConnection.prototype[fn];
    RTCPeerConnection.prototype[fn] = function (d, ...r) {
      state.pc = this; pcs.add(this);
      if (d?.sdp && cfg.bitrate) d = { type: d.type, sdp: capBitrate(d.sdp, cfg.bitrate) };
      return orig.call(this, d, ...r);
    };
  }
  const _addT = RTCPeerConnection.prototype.addTransceiver;
  RTCPeerConnection.prototype.addTransceiver = function (kind, ...r) {
    const t = _addT.call(this, kind, ...r);
    try {
      if ((kind === 'video' || kind?.kind === 'video') && cfg.codec !== 'auto' && t.setCodecPreferences) {
        const caps = RTCRtpReceiver.getCapabilities('video').codecs, want = caps.filter(c => c.mimeType.toLowerCase() === 'video/' + cfg.codec.toLowerCase());
        if (want.length) t.setCodecPreferences(want.concat(caps.filter(c => !want.includes(c))));
      }
    } catch (e) { log('codec', e); }
    return t;
  };

  /* ================= ENTRADA: teclado+mouse, giroscópio, toque, intro ================= */
  const km = { keys: new Set(), mb: 0, dx: 0, dy: 0, locked: false };
  const tc = { b: new Array(17).fill(0), ax: [0, 0, 0, 0], visible: false };
  const gy = { on: false, x: 0, y: 0, s: 0 };
  let introUntil = 0;

  document.addEventListener('pointerlockchange', () => {
    km.locked = !!document.pointerLockElement; if (!km.locked) { km.keys.clear(); km.mb = 0; }
  });
  window.addEventListener('mousemove', e => { if (km.locked) { km.dx += e.movementX; km.dy += e.movementY; } }, true);
  window.addEventListener('mousedown', e => {
    if (km.locked) { km.mb |= 1 << e.button; e.preventDefault(); return; }
    if (cfg.km && state.streaming && !state.open && !state.hubOpen && !e.composedPath().includes(host)) streamVideo()?.requestPointerLock?.();
  }, true);
  window.addEventListener('mouseup', e => { km.mb &= ~(1 << e.button); }, true);
  window.addEventListener('contextmenu', e => { if (km.locked) e.preventDefault(); }, true);

  window.addEventListener('devicemotion', e => {
    if (!cfg.gyro) return; const r = e.rotationRate, g = e.accelerationIncludingGravity; if (!r && !g) return; gy.on = true;
    const sg = (screen.orientation?.angle ?? 90) === 270 ? -1 : 1, k = cfg.gyroSens / 10000;
    // Em paisagem: giro em torno da vertical ≈ beta, da horizontal ≈ gamma (confira o sentido com as opções de inverter).
    const nx = clamp(-(r?.beta || 0) * sg * k * (cfg.gyroInvX ? -1 : 1)), ny = clamp((r?.gamma || 0) * sg * k * (cfg.gyroInvY ? -1 : 1));
    gy.x = gy.x * .4 + nx * .6; gy.y = gy.y * .4 + ny * .6;
    if (g) gy.s = clamp(sg * (g.y || 0) / 9.81 / .707 * (cfg.gyroSens / 50) * (cfg.gyroInvX ? -1 : 1));
  });

  function virtualInput() {
    const v = { b: new Array(17).fill(0), ax: [0, 0, 0, 0] }; let any = false;
    if (cfg.km && km.locked) {
      any = true; const m = { ...KM_DEFAULT, ...cfg.keymap }, k = a => km.keys.has(m[a]);
      let lx = (k('right') ? 1 : 0) - (k('left') ? 1 : 0), ly = (k('down') ? 1 : 0) - (k('up') ? 1 : 0); const n = Math.hypot(lx, ly); if (n > 1) { lx /= n; ly /= n; }
      v.ax[0] = lx; v.ax[1] = ly;
      for (const [a, i] of Object.entries(KM_BTN)) if (k(a)) v.b[i] = 1;
      if (km.mb & 1) v.b[7] = 1; if (km.mb & 2) v.b[6] = 1; if (km.mb & 4) v.b[11] = 1;
      const s = cfg.kmSens / 100, dz = cfg.kmDead / 100, mag = Math.hypot(km.dx, km.dy), acc = 1 + cfg.kmAccel / 100 * Math.min(mag / 40, 3);
      const f = d => { const o = clamp(d * s * acc / 10); return o ? Math.sign(o) * (dz + Math.abs(o) * (1 - dz)) : 0; };
      v.ax[2] = f(km.dx); v.ax[3] = f(km.dy) * (cfg.kmInvert ? -1 : 1); km.dx = km.dy = 0;
    }
    if (tc.visible) { any = true; tc.b.forEach((x, i) => { v.b[i] = Math.max(v.b[i], x); }); tc.ax.forEach((x, i) => { v.ax[i] += x; }); }
    if (Date.now() < introUntil) { any = true; if (Math.floor(Date.now() / 400) % 2 === 0) v.b[0] = 1; }
    return any ? v : null;
  }

  const curves = { linear: n => n, expo: n => n * n, aggressive: n => Math.pow(n, .6), smooth: n => n * n * (3 - 2 * n) };
  function stick(x, y) {
    const dz = cfg.deadzone / 100, m = Math.hypot(x, y); if (m <= dz || m === 0) return [0, 0];
    const n = (curves[cfg.curve] || curves.linear)(clamp((Math.min(m, 1) - dz) / (1 - dz), 0, 1)); return [x / m * n, y / m * n];
  }
  function composePad(gp, vin) {
    const real = gp ? Array.from(gp.buttons).map(b => b.value ?? (b.pressed ? 1 : 0)) : [];
    while (real.length < 17) real.push(0);
    let b = real.slice(); for (const [p, q] of Object.entries(cfg.map)) if (q !== '' && +p !== +q) b[q] = real[p];
    if (vin) b = b.map((x, i) => Math.max(x, vin.b[i] || 0));
    const ax = gp ? Array.from(gp.axes) : [0, 0, 0, 0];
    let [lx, ly] = stick(ax[0] || 0, ax[1] || 0), [rx, ry] = stick(ax[2] || 0, ax[3] || 0);
    if (vin) { lx += vin.ax[0]; ly += vin.ax[1]; rx += vin.ax[2]; ry += vin.ax[3]; }
    if (cfg.gyro && gy.on && (cfg.gyroHold === 'always' || b[cfg.gyroHold === 'lt' ? 6 : 7] > .5)) {
      if (cfg.gyroMode === 'aim') { rx += gy.x; ry += gy.y; } else lx += gy.s;
    }
    return { buttons: b.map(v => ({ pressed: v > .5, touched: v > 0, value: v })), axes: [clamp(lx), clamp(ly), clamp(rx), clamp(ry), ...ax.slice(4)] };
  }

  const NEUTRAL = Object.freeze({ pressed: false, touched: false, value: 0 });
  const vpad = { id: 'Xbox 360 Controller (XInput STANDARD GAMEPAD)', index: 0, connected: true, mapping: 'standard', timestamp: 0, buttons: [], axes: [0, 0, 0, 0], vibrationActuator: null, hapticActuators: [] };
  const rawPads = navigator.getGamepads.bind(navigator);
  const wrapPad = (gp, o) => new Proxy(gp, { get: (t, p) => p === 'buttons' ? o.buttons : p === 'axes' ? o.axes : Reflect.get(t, p) });

  navigator.getGamepads = () => {
    const list = Array.from(rawPads());
    if (state.open) return list.map(gp => gp && wrapPad(gp, { buttons: gp.buttons.map(() => NEUTRAL), axes: gp.axes.map(() => 0) }));
    const vin = virtualInput(), hasReal = list.some(Boolean);
    const idle = !vin && !cfg.deadzone && cfg.curve === 'linear' && !Object.keys(cfg.map).length && !(cfg.gyro && gy.on);
    if (idle) return list;
    if (!hasReal) {
      if (!vin) return list;
      Object.assign(vpad, composePad(null, vin), { timestamp: performance.now() });
      if (!vpad.announced) { vpad.announced = true; setTimeout(() => { const ev = new Event('gamepadconnected'); ev.gamepad = vpad; window.dispatchEvent(ev); }, 0); }
      return [vpad, null, null, null];
    }
    let first = true;
    return list.map(gp => { if (!gp) return gp; const o = composePad(gp, first ? vin : null); first = false; return wrapPad(gp, o); });
  };

  /* ================= ESTATÍSTICAS ================= */
  let prev = null, prevA = null;
  setInterval(async () => {
    const pc = state.pc;
    if (!pc || pc.connectionState === 'closed') { state.stats = {}; renderHud(); return; }
    try {
      const rep = await pc.getStats(), now = performance.now(), s = {};
      rep.forEach(x => {
        if (x.type === 'inbound-rtp' && x.kind === 'video') {
          s.fps = x.framesPerSecond; s.jitter = (x.jitter || 0) * 1000; s.res = x.frameWidth ? `${x.frameWidth}×${x.frameHeight}` : null;
          const rec = x.packetsReceived || 0, lost = x.packetsLost || 0;
          if (prev) {
            const dt = (now - prev.t) / 1000; s.bitrate = ((x.bytesReceived - prev.bytes) * 8) / dt / 1e6;
            const dr = rec - prev.rec, dl = lost - prev.lost; s.loss = dr + dl > 0 ? (dl / (dr + dl)) * 100 : 0;
            const df = (x.framesDecoded || 0) - prev.frames; s.decode = df > 0 ? ((x.totalDecodeTime - prev.dec) / df) * 1000 : null;
          }
          prev = { t: now, bytes: x.bytesReceived, rec, lost, frames: x.framesDecoded || 0, dec: x.totalDecodeTime || 0 };
        }
        if (x.type === 'inbound-rtp' && x.kind === 'audio' && x.jitterBufferEmittedCount) {
          if (prevA && x.jitterBufferEmittedCount > prevA.n) s.audio = ((x.jitterBufferDelay - prevA.d) / (x.jitterBufferEmittedCount - prevA.n)) * 1000;
          prevA = { d: x.jitterBufferDelay, n: x.jitterBufferEmittedCount };
        }
        if (x.type === 'candidate-pair' && x.state === 'succeeded' && x.currentRoundTripTime) s.ping = x.currentRoundTripTime * 1000;
      });
      state.stats = s;
    } catch (_) {}
    renderHud();
  }, 1000);

  /* ================= VÍDEO: CSS e WebGL ================= */
  const streamVideo = () => [...document.querySelectorAll('video')].find(v => v.srcObject instanceof MediaStream);
  const toggleMute = () => { const v = streamVideo(); if (v) { v.muted = !v.muted; toast(v.muted ? 'Som desligado' : 'Som ligado'); } else toast('Nenhum stream ativo'); };
  const toggleFs = () => { if (IN_APP()) return toast('O app já está em tela cheia'); document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.(); };
  const ACCENTS = { green: '#3ddc84', blue: '#4aa8ff', purple: '#a97cff', orange: '#ffa24a' };
  let styleEl;
  function applyStyle() {
    if (!styleEl) { styleEl = document.createElement('style'); (document.head || document.documentElement).append(styleEl); }
    const k = cfg.cas / 10 * 1.2, conv = document.getElementById('xce-conv');
    if (conv) conv.setAttribute('kernelMatrix', `0 ${-k} 0 ${-k} ${1 + 4 * k} ${-k} 0 ${-k} 0`);
    const f = `brightness(${cfg.brightness}%) contrast(${cfg.contrast}%) saturate(${cfg.saturate}%)` + (cfg.cas ? ' url(#xce-sharp)' : '');
    styleEl.textContent = (GLS.on ? 'video.xce-stream{opacity:0!important}' : `video.xce-stream{filter:${f};object-fit:${cfg.aspect === 'fill' ? 'fill' : cfg.aspect === 'cover' ? 'cover' : 'contain'}}`) + '\n' + (cfg.css || '');
    if (host) { host.style.setProperty('--ac', ACCENTS[cfg.accent] || ACCENTS.green); host.style.setProperty('--ts', cfg.touchSize / 100); host.style.setProperty('--to', cfg.touchOpacity / 100); }
  }

  const VS = 'attribute vec2 a;varying vec2 v;void main(){v=a*.5+.5;gl_Position=vec4(a,0.,1.);}';
  const FS = `precision highp float;varying vec2 v;uniform sampler2D t;uniform vec2 px,k;uniform float cas,fxaa,gam,vib,bri,con,sat,cb;
vec3 S(vec2 p){return texture2D(t,p).rgb;}
float L(vec3 c){return dot(c,vec3(.299,.587,.114));}
vec3 sim(vec3 c,float m){
 if(m<1.5)return vec3(dot(c,vec3(.567,.433,0.)),dot(c,vec3(.558,.442,0.)),dot(c,vec3(0.,.242,.758)));
 if(m<2.5)return vec3(dot(c,vec3(.625,.375,0.)),dot(c,vec3(.7,.3,0.)),dot(c,vec3(0.,.3,.7)));
 return vec3(dot(c,vec3(.95,.05,0.)),dot(c,vec3(0.,.433,.567)),dot(c,vec3(0.,.475,.525)));}
void main(){
 vec2 p=(v-.5)*k+.5;
 if(p.x<0.||p.x>1.||p.y<0.||p.y>1.){gl_FragColor=vec4(0.,0.,0.,1.);return;}
 vec3 e=S(p),n=S(p+vec2(0.,px.y)),s=S(p-vec2(0.,px.y)),w=S(p-vec2(px.x,0.)),ea=S(p+vec2(px.x,0.));
 vec3 c=e;
 if(fxaa>.5){float lc=L(e),ln=L(n),ls=L(s),lw=L(w),le=L(ea);
  float mn=min(lc,min(min(ln,ls),min(lw,le))),mx=max(lc,max(max(ln,ls),max(lw,le)));float r=mx-mn;
  if(r>max(.0312,mx*.125))c=mix(e,(n+s+w+ea)*.25,clamp(r*1.5,0.,.6));}
 if(cas>0.){vec3 mn=min(min(min(w,e),min(ea,n)),s),mx=max(max(max(w,e),max(ea,n)),s);
  vec3 amp=sqrt(clamp(min(mn,1.-mx)/max(mx,vec3(.0001)),0.,1.));float peak=-1./mix(8.,5.,cas);vec3 wt=amp*peak;
  c=clamp((n*wt+w*wt+ea*wt+s*wt+c)/(4.*wt+1.),0.,1.);}
 if(cb>.5&&cb<3.5){vec3 sm=sim(c,cb);vec3 er=c-sm;
  vec3 sh=cb<2.5?vec3(0.,.7*er.r+er.g,.7*er.r+er.b):vec3(er.r+.7*er.b,er.g+.7*er.b,0.);c=clamp(c+sh,0.,1.);}
 float mxc=max(c.r,max(c.g,c.b)),mnc=min(c.r,min(c.g,c.b));
 c=mix(vec3(L(c)),c,1.+vib*(1.-(mxc-mnc)));
 c=mix(vec3(L(c)),c,sat);
 c=(c-.5)*con+.5;c*=bri;
 if(cb>4.5)c*=vec3(1.,.93,.82);
 c=pow(clamp(c,0.,1.),vec3(1./gam));
 gl_FragColor=vec4(c,1.);}`;

  const GLS = { on: false };
  function glStart() {
    const v = streamVideo(); if (!v || GLS.on) return;
    try {
      const cv = document.createElement('canvas'); cv.id = 'xce-gl'; cv.style.cssText = 'position:fixed;pointer-events:none;background:#000';
      const gl = cv.getContext('webgl', { alpha: false, antialias: false }); if (!gl) throw new Error('sem WebGL');
      const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
      const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
      if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error('link');
      gl.useProgram(pr);
      const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(pr, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
      for (const [p, val] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, p, val);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      const u = {}; ['px', 'k', 'cas', 'fxaa', 'gam', 'vib', 'bri', 'con', 'sat', 'cb'].forEach(n => { u[n] = gl.getUniformLocation(pr, n); });
      v.parentNode.insertBefore(cv, v.nextSibling);
      Object.assign(GLS, { on: true, cv, gl, u, v, h: 0 }); applyStyle(); glFrame();
    } catch (e) { console.warn('[xce] WebGL indisponível', e); GLS.on = false; cfg.gl = false; save(); toast('WebGL indisponível neste aparelho'); applyStyle(); }
  }
  function glStop() {
    if (!GLS.on) return; GLS.on = false; GLS.cv?.remove(); applyStyle();
  }
  function glSync() { cfg.gl && state.streaming ? glStart() : glStop(); }
  function glFrame() {
    if (!GLS.on) return; const { v, gl, cv, u } = GLS;
    if (!v.isConnected || !v.srcObject) { glStop(); return; }
    const next = () => { GLS.h = v.requestVideoFrameCallback ? v.requestVideoFrameCallback(glFrame) : requestAnimationFrame(glFrame); };
    if (v.readyState < 2 || !v.videoWidth) return next();
    const r = v.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2), W = Math.min(2560, Math.round(r.width * dpr)), H = Math.round(W * r.height / (r.width || 1));
    Object.assign(cv.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; gl.viewport(0, 0, W, H); }
    const ca = r.width / r.height, va = v.videoWidth / v.videoHeight;
    const cont = ca > va ? [ca / va, 1] : [1, va / ca], cov = ca > va ? [1, va / ca] : [ca / va, 1]; let K;
    if (cfg.aspect === 'cover') K = cov; else if (cfg.aspect === 'fill') K = [1, 1]; else { const t = cfg.stretch / 100; K = [cont[0] + (1 - cont[0]) * t, cont[1] + (1 - cont[1]) * t]; }
    const cm = { none: 0, protan: 1, deutan: 2, tritan: 3, contrast: 4, night: 5 }[cfg.colorMode] || 0;
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, v);
    gl.uniform2f(u.px, 1 / v.videoWidth, 1 / v.videoHeight); gl.uniform2f(u.k, K[0], K[1]);
    gl.uniform1f(u.cas, cfg.cas / 10); gl.uniform1f(u.fxaa, cfg.fxaa ? 1 : 0); gl.uniform1f(u.gam, cfg.gamma / 100); gl.uniform1f(u.vib, cfg.vibrance / 100);
    gl.uniform1f(u.bri, cfg.brightness / 100 * (cm === 5 ? .8 : 1)); gl.uniform1f(u.con, cfg.contrast / 100 * (cm === 4 ? 1.3 : 1)); gl.uniform1f(u.sat, cfg.saturate / 100 * (cm === 4 ? 1.15 : 1)); gl.uniform1f(u.cb, cm);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); next();
  }

  /* ================= CLIPES E CAPTURA ================= */
  const clip = { recs: [], timer: 0 };
  const pickMime = () => ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find(m => window.MediaRecorder?.isTypeSupported(m));
  function clipStart() {
    clipStop(); const v = streamVideo(), mime = pickMime(); if (!cfg.clips || !v?.captureStream || !mime) return;
    const W = +cfg.clipSec * 1000;
    const make = () => { const mr = new MediaRecorder(v.captureStream(), { mimeType: mime, videoBitsPerSecond: 8e6 }), o = { mr, chunks: [], t0: Date.now(), mime };
      mr.ondataavailable = e => e.data.size && o.chunks.push(e.data); mr.start(1000); return o; };
    clip.recs = [make()]; clip.start2 = setTimeout(() => clip.recs.push(make()), W / 2);
    clip.timer = setInterval(() => { clip.recs = clip.recs.map(o => { if (Date.now() - o.t0 < W) return o; try { o.mr.stop(); } catch (_) {} return make(); }); }, 1000);
  }
  function clipStop() { clearInterval(clip.timer); clearTimeout(clip.start2); clip.recs.forEach(o => { try { o.mr.stop(); } catch (_) {} }); clip.recs = []; }
  async function saveClip() {
    if (!clip.recs.length) return toast('Ative "Gravar buffer de clipe" e inicie um jogo');
    const o = clip.recs.slice().sort((a, b) => a.t0 - b.t0)[0]; o.mr.requestData(); await sleep(200);
    await saveBlob(new Blob(o.chunks, { type: o.mime }), `xcloud-clipe-${Date.now()}.webm`); toast('Clipe salvo');
  }
  async function screenshot() {
    const v = streamVideo(); if (!v) return toast('Nenhum stream ativo');
    const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight; c.getContext('2d').drawImage(v, 0, 0);
    c.toBlob(async b => { await saveBlob(b, `xcloud-${Date.now()}.png`); toast('Captura salva'); }, 'image/png');
  }
  async function saveBlob(blob, name) {
    if (IN_APP()) {
      native('saveBegin', name, blob.type || 'application/octet-stream'); const CH = 768 * 1024;
      for (let i = 0; i < blob.size; i += CH) {
        const b64 = await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1]); fr.readAsDataURL(blob.slice(i, i + CH)); });
        native('saveChunk', b64);
      }
      native('saveEnd');
    } else { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); }
  }

  /* ================= AUTOMAÇÃO DO STREAM ================= */
  let wl = null, bgMuted = false;
  const buzz = ms => { if (IN_APP()) native('vibrate', ms); else navigator.vibrate?.(ms); };
  async function lockScreen() { try { if (cfg.wakeLock && navigator.wakeLock && !wl) { wl = await navigator.wakeLock.request('screen'); wl.addEventListener('release', () => { wl = null; }); } } catch (_) {} }
  document.addEventListener('visibilitychange', () => {
    const v = streamVideo();
    if (document.hidden && cfg.bgMute && !IN_APP() && v && !v.muted) { v.muted = true; bgMuted = true; }
    else if (!document.hidden) { if (bgMuted && v) v.muted = false; bgMuted = false; if (state.streaming) lockScreen(); }
  });
  function onStreamStart() {
    state.streaming = true; state.status = state.status || ''; lockScreen(); glSync(); cfg.clips && clipStart();
    if (cfg.introSec) introUntil = Date.now() + cfg.introSec * 1000;
    if (cfg.devBright) native('setBrightness', cfg.devBright / 100);
    updateGear(); renderQueue(); updateTouch(); applyStyle();
  }
  function onStreamEnd() {
    state.streaming = false; state.hubOpen = false; wl?.release?.(); wl = null; glStop(); clipStop(); introUntil = 0;
    updateGear(); updateTouch(); renderHud(); applyStyle();
  }
  setInterval(() => {
    const v = streamVideo(); if (v && !v.classList.contains('xce-stream')) v.classList.add('xce-stream');
    applyAudioLatency();
    const now = !!v && v.readyState > 0; if (now !== state.streaming) now ? onStreamStart() : onStreamEnd();
    hubScan();
  }, 600);

  /* ================= HUB NATIVO DO XBOX ================= */
  // O Hub (guia) do Xbox tem uma barra de ícones embaixo (notificações, microfone, controle, configurações).
  // O botão do plugin entra nessa barra, ao lado da engrenagem nativa. Os botões são achados pelo nome acessível
  // (aria-label/title), que não muda com os hashes de CSS. Sem a barra, cai para um botão abaixo de "Sair do jogo".
  const SETTINGS_RE = /^(configura|settings|ajustes)/i, NOTIF_RE = /^notifica/i;
  const HUB_BTN = /^(sair do jogo|desconectar|disconnect|encerrar sess|end session|quit game|exit stream)/i;
  const ICON = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h9M19 7h1M4 17h1M11 17h9"/><circle cx="16" cy="7" r="2.2"/><circle cx="8" cy="17" r="2.2"/></svg>';
  const label = b => String(b.getAttribute('aria-label') || b.getAttribute('title') || b.textContent || '').trim();
  const visible = e => e.getClientRects().length > 0;
  const inDialog = e => !!e.closest('[role="dialog"],[role="alertdialog"],[aria-modal="true"]');
  // A janela "Tem certeza?" (sair do jogo) também tem um botão "Sair do jogo": nunca injetar nela
  const isConfirm = e => { let p = e, n = 0; while (p && n++ < 6) { const t = p.textContent || ''; if (t.length < 700 && /tem certeza|are you sure/i.test(t)) return true; p = p.parentElement; } return false; };

  // Raiz do Hub (confirmada no site): div.Guide-module__guide___xxxx. Só procuramos botões DENTRO dela,
  // assim o cabeçalho da página inicial (também tem "Notificações") nunca recebe o botão por engano.
  const guideRoot = () => { const g = document.querySelector('[class*="Guide-module__guide"]'); return g && visible(g) ? g : null; };
  function closeGuide() {
    const g = document.querySelector('[class*="Guide-module__guide"]');
    const c = [...(g ? g.querySelectorAll('button') : [])].find(b => /^(fechar|close)$/i.test(label(b))); c?.click();
  }
  function findHub() {
    if (cfg.hubSelector) { const e = document.querySelector(cfg.hubSelector); if (e) return { el: e }; }
    const g = guideRoot(); if (!g) return null;
    const btns = [...g.querySelectorAll('button,[role="button"]')].filter(b => !b.dataset?.xce && visible(b));
    for (const re of [SETTINGS_RE, NOTIF_RE]) {
      const t = btns.find(b => { const l = label(b); return l && l.length < 30 && re.test(l) && !inDialog(b) && b.parentElement?.querySelectorAll('button,[role="button"]').length >= 2; });
      if (t) return { bar: t.parentElement, ref: t };
    }
    const s = btns.find(b => HUB_BTN.test(label(b)) && !isConfirm(b));
    return s ? { el: s.parentElement, ref: s } : { el: g };
  }
  function injectEntry(f) {
    const b = document.createElement('button'); b.type = 'button'; b.dataset.xce = '1'; b.setAttribute('aria-label', 'xCloud Enhancer'); b.title = 'xCloud Enhancer';
    if (f.bar) {
      b.className = f.ref.className; b.innerHTML = ICON; f.bar.insertBefore(b, f.ref);
      try { b.style.color = getComputedStyle(f.ref).color; } catch (_) {}
    } else if (f.ref) {
      b.textContent = '⚙ xCloud Enhancer';
      b.style.cssText = 'display:block;width:100%;margin:8px 0;padding:12px 16px;border-radius:6px;border:0;background:rgba(255,255,255,.14);color:#fff;font:600 14px system-ui;letter-spacing:.04em;text-transform:uppercase;cursor:pointer';
      f.ref.insertAdjacentElement('afterend', b);
    } else { b.textContent = '⚙ xCloud Enhancer'; b.style.cssText = 'margin:8px;padding:10px 16px;border-radius:10px;border:0;font:600 14px system-ui;cursor:pointer'; f.el.append(b); }
    b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); toggle(true); if (cfg.closeGuide) setTimeout(closeGuide, 60); });
  }
  function hubScan() {
    if (!root) return;
    const f = findHub(), guide = !!f, open = guide && state.streaming;
    if (guide !== state.guideOpen) { state.guideOpen = guide; updateGear(); }
    if (open !== state.hubOpen) { state.hubOpen = open; renderHud(); updateTouch(); log('hub', open, f?.bar ? 'barra de ícones' : f?.el?.className); }
    if (f && !(f.bar || f.el).querySelector('[data-xce]')) injectEntry(f);
  }
  function discover() {
    const out = new Set();
    document.querySelectorAll('[class*="Menu"],[class*="Guide"],[class*="Stream"],[role="dialog"],[role="menu"]').forEach(e => out.add(`${e.tagName.toLowerCase()}.${String(e.className).split(/\s+/).slice(0, 3).join('.')}`));
    document.querySelectorAll('button,[role="button"]').forEach(b => { if (visible(b) && !b.dataset?.xce) { const t = label(b); if (t && t.length < 40) out.add(`botão: "${t}" (${String(b.className).split(/\s+/)[0] || '-'})`); } });
    return [...out].slice(0, 80);
  }

  /* ================= INTERFACE (Shadow DOM) ================= */
  let host, root, hudEl, queueEl, gearEl, panelEl, bodyEl, toastEl, touchEl, dashEl, idleT;
  const J = () => root.querySelector('#json');
  const h = (tag, p = {}, ...kids) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(p)) {
      if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (['value', 'checked', 'disabled', 'textContent'].includes(k)) e[k] = v; else if (v !== undefined && v !== false) e.setAttribute(k, v);
    }
    kids.flat().forEach(c => c != null && c !== false && e.append(c.nodeType ? c : document.createTextNode(c)));
    return e;
  };

  const CSS = `
:host{all:initial;--ac:#3ddc84;--ts:1;--to:.55}
*{box-sizing:border-box;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.layer{position:fixed;inset:0;pointer-events:none;z-index:2147483647}
button,select,input,textarea{font:inherit;color:inherit}
.hud{position:fixed;display:flex;gap:6px;flex-wrap:wrap;max-width:70vw;pointer-events:none;padding:8px}
.hud.tl{top:0;left:0}.hud.tr{top:0;right:0;justify-content:flex-end}.hud.bl{bottom:0;left:0}.hud.br{bottom:0;right:0;justify-content:flex-end}
.pill{display:flex;flex-direction:column;align-items:center;min-width:54px;padding:5px 10px;border-radius:12px;background:rgba(14,16,20,.72);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.08);color:#fff}
.pill b{font-size:1.05em;font-weight:650;font-variant-numeric:tabular-nums}.pill i{font-style:normal;font-size:.62em;opacity:.6;letter-spacing:.06em;text-transform:uppercase}
.hud.s{font-size:11px}.hud.m{font-size:14px}.hud.l{font-size:18px}
.good{color:#5dffa0}.warn{color:#ffd24a}.bad{color:#ff6b6b}
.queue{position:fixed;top:14px;left:50%;transform:translateX(-50%);min-width:260px;padding:14px 18px;border-radius:18px;pointer-events:none;background:linear-gradient(160deg,rgba(20,24,30,.92),rgba(12,14,18,.92));border:1px solid color-mix(in srgb,var(--ac) 40%,transparent);color:#fff;box-shadow:0 10px 40px rgba(0,0,0,.45)}
.queue h4{margin:0 0 8px;font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--ac);display:flex;align-items:center;gap:8px}
.queue h4:before{content:"";width:8px;height:8px;border-radius:50%;background:var(--ac);animation:p 1.4s infinite}@keyframes p{50%{opacity:.25}}
.queue .big{font-size:28px;font-weight:700;font-variant-numeric:tabular-nums}.queue .sub{opacity:.65;font-size:13px;margin-top:2px}
.gear{position:fixed;width:48px;height:48px;border-radius:50%;border:1px solid rgba(255,255,255,.15);background:rgba(18,20,26,.8);backdrop-filter:blur(8px);color:#fff;font-size:22px;cursor:pointer;pointer-events:auto;margin:14px;transition:opacity .4s,transform .2s;display:grid;place-items:center}
.gear.tl{top:0;left:0}.gear.tr{top:0;right:0}.gear.bl{bottom:0;left:0}.gear.br{bottom:0;right:0}.gear.idle{opacity:.18}.gear:hover,.gear:focus-visible{transform:scale(1.08);opacity:1}.gear.off{display:none}
.scrim{position:fixed;inset:0;background:rgba(0,0,0,.5);opacity:0;pointer-events:none;transition:opacity .25s}.open .scrim{opacity:1;pointer-events:auto}
.panel{position:fixed;top:0;right:0;bottom:0;width:min(540px,100vw);display:flex;flex-direction:column;color:#eef1f5;pointer-events:auto;background:linear-gradient(180deg,#14171d,#0c0e12);border-left:1px solid rgba(255,255,255,.08);transform:translateX(105%);visibility:hidden;transition:transform .28s cubic-bezier(.2,.8,.2,1),visibility .28s}
.open .panel{transform:none;visibility:visible}
.head{display:flex;align-items:center;gap:12px;padding:16px 18px 10px}.head h2{margin:0;font-size:18px;flex:1}.head h2 span{color:var(--ac)}
.x{border:0;background:rgba(255,255,255,.07);width:36px;height:36px;border-radius:50%;cursor:pointer;font-size:16px}
.tabs{display:flex;gap:6px;padding:4px 14px 12px;overflow-x:auto;scrollbar-width:none}
.tab{border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.04);padding:8px 14px;border-radius:999px;cursor:pointer;white-space:nowrap;font-size:14px}
.tab.on{background:var(--ac);color:#06130b;border-color:transparent;font-weight:650}
.body{flex:1;overflow-y:auto;padding:4px 14px 24px;display:flex;flex-direction:column;gap:8px}
.sec{margin:14px 4px 2px;font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--ac);font-weight:650}
.note{font-size:12.5px;opacity:.7;padding:10px 12px;border-radius:12px;background:color-mix(in srgb,var(--ac) 10%,transparent);line-height:1.4}
.row{display:flex;align-items:center;gap:14px;padding:12px 14px;border-radius:14px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.05)}.row.col{flex-direction:column;align-items:stretch}
.txt{flex:1;min-width:0}.lbl{font-size:15px;font-weight:550}.dsc{font-size:12.5px;opacity:.6;margin-top:3px;line-height:1.35}
.ctl{display:flex;align-items:center;gap:10px}
.sw{position:relative;width:46px;height:26px;flex:none}.sw input{position:absolute;inset:0;opacity:0;margin:0;cursor:pointer;z-index:2}
.sw .k{position:absolute;inset:0;border-radius:99px;background:rgba(255,255,255,.18);transition:.2s}
.sw .k:after{content:"";position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;transition:.2s}
.sw input:checked+.k{background:var(--ac)}.sw input:checked+.k:after{transform:translateX(20px)}.sw input:focus+.k{outline:3px solid #fff;outline-offset:2px}
select,.inp{background:#1c2028;border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:8px 10px;max-width:220px}
.inp{width:100%;max-width:none}textarea.inp{min-height:84px;resize:vertical;font-family:ui-monospace,monospace;font-size:12px}
input[type=range]{accent-color:var(--ac);width:150px}.val{min-width:70px;text-align:right;font-size:13px;opacity:.85;font-variant-numeric:tabular-nums}
.btn{border:0;background:var(--ac);color:#06130b;font-weight:650;padding:9px 16px;border-radius:10px;cursor:pointer}.btn.danger{background:#ff6b6b;color:#200}.btn.ghost{background:rgba(255,255,255,.1);color:#fff}
:is(button,select,input,textarea):focus{outline:3px solid #fff;outline-offset:2px}
.row:focus-within{border-color:var(--ac);background:rgba(255,255,255,.09)}
.map{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:10px}
.map div{display:flex;align-items:center;gap:8px;justify-content:space-between;background:rgba(255,255,255,.04);padding:6px 10px;border-radius:10px;font-size:13px}.map select{padding:4px 6px;max-width:90px}.map button{min-width:80px;padding:5px 8px;border-radius:8px;border:1px solid rgba(255,255,255,.15);background:#1c2028;cursor:pointer;font-size:12px}
.dash{display:flex;flex-direction:column;gap:6px;margin-top:10px}.dr{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:10px;background:rgba(255,255,255,.04);font-size:13px}.dr.sel{outline:1px solid var(--ac)}
.dr .n{flex:1}.dr .bar{width:70px;height:6px;border-radius:9px;background:rgba(255,255,255,.1);overflow:hidden}.dr .bar i{display:block;height:100%;background:var(--ac)}.dr .ms{min-width:54px;text-align:right;font-variant-numeric:tabular-nums}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.toast{position:fixed;left:50%;bottom:26px;transform:translate(-50%,20px);background:#222a;backdrop-filter:blur(10px);color:#fff;padding:10px 18px;border-radius:99px;opacity:0;transition:.25s;pointer-events:none;border:1px solid rgba(255,255,255,.12);max-width:90vw;text-align:center}.toast.on{opacity:1;transform:translate(-50%,0)}
.touch{position:fixed;inset:0;pointer-events:none;opacity:var(--to);display:none}
.tb,.ts{position:absolute;pointer-events:auto;touch-action:none;user-select:none;-webkit-user-select:none}
.tb{width:calc(56px*var(--ts));height:calc(56px*var(--ts));border-radius:50%;background:rgba(255,255,255,.16);border:2px solid rgba(255,255,255,.4);display:grid;place-items:center;color:#fff;font-weight:700;font-size:calc(18px*var(--ts))}
.tb.sm{width:calc(46px*var(--ts));height:calc(46px*var(--ts));font-size:calc(14px*var(--ts))}.tb.wide{border-radius:14px;width:calc(70px*var(--ts));height:calc(40px*var(--ts));font-size:calc(14px*var(--ts))}.tb.p{background:var(--ac);color:#06130b}
.ts{width:calc(130px*var(--ts));height:calc(130px*var(--ts));border-radius:50%;background:rgba(255,255,255,.1);border:2px solid rgba(255,255,255,.3)}
.tk{position:absolute;left:50%;top:50%;width:46%;height:46%;margin:-23% 0 0 -23%;border-radius:50%;background:rgba(255,255,255,.4)}
.ts.l{left:4%;bottom:8%}.ts.r{right:30%;bottom:6%}
.tb.a{right:9%;bottom:12%}.tb.b{right:3%;bottom:24%}.tb.x{right:15%;bottom:24%}.tb.y{right:9%;bottom:36%}
.tb.lb{left:4%;top:7%}.tb.rb{right:4%;top:7%}.tb.lt{left:4%;top:21%}.tb.rt{right:4%;top:21%}
.tb.du{left:9%;bottom:62%}.tb.dd{left:9%;bottom:44%}.tb.dl{left:3.5%;bottom:53%}.tb.dr2{left:14.5%;bottom:53%}
.tb.vw{left:41%;bottom:6%}.tb.mn{left:52%;bottom:6%}
@media(orientation:portrait){.ts.l{left:3%;bottom:3%}.ts.r{right:3%;bottom:3%}.tb.a{right:12%;bottom:26%}.tb.b{right:4%;bottom:34%}.tb.x{right:20%;bottom:34%}.tb.y{right:12%;bottom:42%}
.tb.du{left:12%;bottom:42%}.tb.dd{left:12%;bottom:26%}.tb.dl{left:4%;bottom:34%}.tb.dr2{left:20%;bottom:34%}
.tb.lb{left:4%;top:5%}.tb.rb{right:4%;top:5%}.tb.lt{left:4%;top:13%}.tb.rt{right:4%;top:13%}.tb.vw{left:36%;bottom:3%}.tb.mn{left:52%;bottom:3%}}
@media(max-width:560px){.row{flex-wrap:wrap}input[type=range]{width:120px}}
`;

  function build() {
    host = h('div', { id: 'xce-root' }); root = host.attachShadow({ mode: 'open' });
    hudEl = h('div'); queueEl = h('div'); toastEl = h('div', { class: 'toast' }); bodyEl = h('div', { class: 'body' });
    gearEl = h('button', { class: 'gear', title: 'Configurações', onclick: () => toggle(true) }, '⚙');
    panelEl = h('div', { class: 'panel', role: 'dialog' },
      h('div', { class: 'head' }, h('h2', {}, 'xCloud ', h('span', {}, 'Enhancer')), h('button', { class: 'x', onclick: () => toggle(false), 'aria-label': 'Fechar' }, '✕')),
      h('div', { class: 'tabs', id: 'tabs' }), bodyEl);
    buildTouch();
    root.append(h('style', {}, CSS), h('div', { class: 'layer', id: 'layer' }, touchEl, hudEl, queueEl, gearEl, h('div', { class: 'scrim', onclick: () => toggle(false) }), panelEl, toastEl));
    (document.body || document.documentElement).append(host);
    const svg = h('div', { style: 'position:absolute;width:0;height:0;overflow:hidden' });
    svg.innerHTML = '<svg width="0" height="0"><filter id="xce-sharp"><feConvolveMatrix id="xce-conv" order="3" kernelMatrix="0 0 0 0 1 0 0 0 0" preserveAlpha="true"/></filter></svg>';
    document.body.append(svg);
    refresh(); applyStyle(); renderHud(); renderQueue(); updateGear(); wakeGear();
  }

  function refresh() {
    if (!root) return;
    const tabs = root.querySelector('#tabs'); tabs.replaceChildren();
    SCHEMA.forEach(s => tabs.append(h('button', { class: 'tab' + (s.id === ui.tab ? ' on' : ''), onclick: () => { ui.tab = s.id; refresh(); } }, s.icon + ' ' + s.title)));
    const sc = bodyEl.scrollTop; bodyEl.replaceChildren();
    SCHEMA.find(s => s.id === ui.tab).items.forEach(i => { const r = row(i); r && bodyEl.append(r); });
    bodyEl.scrollTop = sc; updateGear();
  }

  function row(i) {
    if (i.when && !i.when()) return null;
    if (i.t === 'h') return h('div', { class: 'sec' }, i.label);
    if (i.t === 'note') return h('div', { class: 'note' }, i.label);
    const left = h('div', { class: 'txt' }, h('div', { class: 'lbl' }, i.label), i.desc && h('div', { class: 'dsc' }, i.desc));
    let ctl;
    if (i.t === 'toggle') ctl = h('label', { class: 'sw' }, h('input', { type: 'checkbox', checked: !!cfg[i.k], onchange: e => set(i.k, e.target.checked) }), h('span', { class: 'k' }));
    else if (i.t === 'select') {
      const opts = typeof i.opts === 'function' ? i.opts() : i.opts;
      ctl = h('select', { onchange: e => set(i.k, e.target.value) }, opts.map(([v, l]) => h('option', { value: v, selected: String(v) === String(cfg[i.k]) }, l)));
      if (!opts.some(([v]) => String(v) === String(cfg[i.k]))) ctl.prepend(h('option', { value: cfg[i.k], selected: true }, cfg[i.k]));
    } else if (i.t === 'range') {
      const val = h('span', { class: 'val' }, i.fmt(cfg[i.k]));
      ctl = h('div', { class: 'ctl' }, h('input', { type: 'range', min: i.min, max: i.max, step: i.step, value: cfg[i.k], oninput: e => { val.textContent = i.fmt(+e.target.value); set(i.k, +e.target.value); } }), val);
    } else if (i.t === 'button') ctl = h('button', { class: 'btn' + (i.danger ? ' danger' : ''), onclick: e => i.run(e.target) }, i.btn);
    else if (i.t === 'text' || i.t === 'area') {
      const el = h(i.t === 'text' ? 'input' : 'textarea', { class: 'inp', id: i.id, placeholder: i.ph, value: i.k ? cfg[i.k] : '', ...(i.k ? { onchange: e => set(i.k, e.target.value) } : {}) });
      return h('div', { class: 'row col' }, left, el);
    } else if (i.t === 'remap') {
      const grid = h('div', { class: 'map' }, BTN.map((n, p) => h('div', {}, n,
        h('select', { onchange: e => { const m = { ...cfg.map }; e.target.value === '' ? delete m[p] : m[p] = +e.target.value; set('map', m); } },
          h('option', { value: '', selected: cfg.map[p] === undefined }, 'Padrão'), BTN.map((n2, q) => h('option', { value: q, selected: cfg.map[p] === q }, '→ ' + n2))))));
      return h('div', { class: 'row col' }, left, grid, h('div', { class: 'chips' }, h('button', { class: 'btn ghost', onclick: () => set('map', {}) }, 'Limpar mapeamento')));
    } else if (i.t === 'keymap') {
      const m = { ...KM_DEFAULT, ...cfg.keymap }, short = c => c.replace(/^Key|^Digit/, '').replace('Arrow', '');
      const grid = h('div', { class: 'map' }, KM_ACTIONS.map(([a, n]) => h('div', {}, n, h('button', { onclick: e => {
        e.target.textContent = '…';
        const once = ev => { ev.preventDefault(); ev.stopPropagation(); window.removeEventListener('keydown', once, true); if (ev.code !== 'Escape') set('keymap', { ...cfg.keymap, [a]: ev.code }); else refresh(); };
        window.addEventListener('keydown', once, true); } }, short(m[a])))));
      return h('div', { class: 'row col' }, left, grid, h('div', { class: 'chips' }, h('button', { class: 'btn ghost', onclick: () => set('keymap', {}) }, 'Restaurar teclas')));
    } else if (i.t === 'dash') {
      dashEl = h('div', { class: 'dash' }); renderDash(); return h('div', { class: 'row col' }, left, dashEl);
    } else if (i.t === 'profiles') {
      const p = state.game && profiles()[state.game.key];
      return h('div', { class: 'row col' }, left,
        h('div', { class: 'dsc' }, state.game ? `${state.game.name}${p ? ' · perfil salvo' : ' · sem perfil'}` : 'Nenhum jogo detectado ainda. Inicie um jogo para salvar um perfil.'),
        h('div', { class: 'chips' },
          h('button', { class: 'btn', onclick: saveProfile }, 'Salvar perfil deste jogo'), p && h('button', { class: 'btn danger', onclick: deleteProfile }, 'Apagar'),
          Object.keys(TEMPLATES).map(n => h('button', { class: 'btn ghost', onclick: () => { setMany(TEMPLATES[n]); toast('Modelo aplicado: ' + n); } }, 'Modelo: ' + n))));
    }
    return h('div', { class: 'row' }, left, ctl);
  }

  function renderDash() {
    if (!dashEl) return; dashEl.replaceChildren();
    if (!state.regions.length) { dashEl.append(h('div', { class: 'dsc' }, 'Regiões ainda não carregadas.')); return; }
    const max = Math.max(150, ...Object.values(state.ping));
    [{ name: 'auto', label: 'Automática' }, ...state.regions.map(r => ({ name: r.name, label: r.name }))].forEach(r => {
      const ms = state.ping[r.name];
      dashEl.append(h('div', { class: 'dr' + (cfg.region === r.name ? ' sel' : '') }, h('span', { class: 'n' }, r.label),
        r.name !== 'auto' && h('span', { class: 'bar' }, h('i', { style: `width:${ms ? Math.max(6, 100 - ms / max * 100) : 0}%` })),
        r.name !== 'auto' && h('span', { class: 'ms' }, ms ? ms + ' ms' : '—'),
        h('button', { class: 'btn ghost', onclick: () => { cfg.region = r.name; save(); renderDash(); toast('Região: ' + r.label); } }, cfg.region === r.name ? '✓' : 'Usar')));
    });
  }

  function buildTouch() {
    touchEl = h('div', { class: 'touch' });
    const btn = (cls, label, idx, extra = '') => {
      const b = h('div', { class: `tb ${cls} ${extra}` }, label);
      b.addEventListener('pointerdown', e => { e.preventDefault(); tc.b[idx] = 1; b.classList.add('p'); cfg.haptic && buzz(12); });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => b.addEventListener(t, () => { tc.b[idx] = 0; b.classList.remove('p'); }));
      touchEl.append(b);
    };
    const stk = (cls, ia) => {
      const base = h('div', { class: 'ts ' + cls }), knob = h('div', { class: 'tk' }); base.append(knob); let id = null, cx = 0, cy = 0;
      const R = () => base.getBoundingClientRect().width / 2;
      const move = e => { if (e.pointerId !== id) return; let dx = (e.clientX - cx) / R(), dy = (e.clientY - cy) / R(); const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; }
        tc.ax[ia] = dx; tc.ax[ia + 1] = dy; knob.style.transform = `translate(${dx * R() * .6}px,${dy * R() * .6}px)`; };
      base.addEventListener('pointerdown', e => { id = e.pointerId; base.setPointerCapture(id); const r = base.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; move(e); });
      base.addEventListener('pointermove', move);
      ['pointerup', 'pointercancel'].forEach(t => base.addEventListener(t, e => { if (e.pointerId !== id) return; id = null; tc.ax[ia] = tc.ax[ia + 1] = 0; knob.style.transform = ''; }));
      touchEl.append(base);
    };
    stk('l', 0); stk('r', 2);
    btn('a', 'A', 0); btn('b', 'B', 1); btn('x', 'X', 2); btn('y', 'Y', 3);
    btn('lb', 'LB', 4, 'wide'); btn('rb', 'RB', 5, 'wide'); btn('lt', 'LT', 6, 'wide'); btn('rt', 'RT', 7, 'wide');
    btn('du', '↑', 12, 'sm'); btn('dd', '↓', 13, 'sm'); btn('dl', '←', 14, 'sm'); btn('dr2', '→', 15, 'sm');
    btn('vw', '⧉', 8, 'sm'); btn('mn', '≡', 9, 'sm');
  }
  function updateTouch() {
    const on = !!(cfg.touch && state.streaming && !state.open && !state.hubOpen); tc.visible = on;
    if (touchEl) touchEl.style.display = on ? 'block' : 'none';
    if (!on) { tc.b.fill(0); tc.ax.fill(0); }
  }

  function renderHud() {
    if (!hudEl) return;
    const s = state.stats, show = cfg.hudMode === 'always' || (cfg.hudMode === 'hub' && (state.hubOpen || state.open)), on = show && state.pc && Object.keys(s).length;
    hudEl.className = on ? `hud ${cfg.hudPos} ${cfg.hudSize}` : ''; hudEl.style.opacity = cfg.hudOpacity / 100; hudEl.replaceChildren(); if (!on) return;
    const cls = (v, g, w) => v <= g ? 'good' : v <= w ? 'warn' : 'bad';
    const defs = {
      fps: () => s.fps != null && ['FPS', Math.round(s.fps), cls(60 - s.fps, 6, 20)],
      ping: () => s.ping != null && ['Ping', Math.round(s.ping) + ' ms', cls(s.ping, 40, 80)],
      loss: () => s.loss != null && ['Perda', s.loss.toFixed(1) + '%', cls(s.loss, .5, 2)],
      jitter: () => s.jitter != null && ['Jitter', s.jitter.toFixed(1) + ' ms', cls(s.jitter, 8, 20)],
      bitrate: () => s.bitrate != null && ['Bitrate', s.bitrate.toFixed(1) + ' Mb/s', ''],
      res: () => s.res && ['Res', s.res, ''],
      decode: () => s.decode != null && ['Decod.', s.decode.toFixed(1) + ' ms', cls(s.decode, 6, 12)],
      audio: () => s.audio != null && ['Áudio', Math.round(s.audio) + ' ms', cls(s.audio, 40, 100)],
    };
    HUD_ITEMS.forEach(([id]) => { if (!cfg['hud_' + id]) return; const d = defs[id](); if (d) hudEl.append(h('div', { class: 'pill' }, h('b', { class: d[2] }, d[1]), h('i', {}, d[0]))); });
  }

  function renderQueue() {
    if (!queueEl) return;
    const waiting = (/Waiting|Queued|Provisioning/.test(state.status) || state.retry) && !state.streaming && !state.pc;
    if (!cfg.queuePanel || !waiting) { queueEl.className = ''; queueEl.replaceChildren(); return; }
    queueEl.className = 'queue';
    queueEl.replaceChildren(h('h4', {}, state.retry ? `Tentativa ${state.retry}/${cfg.retries}` : (PT[state.status] || state.status)),
      h('div', { class: 'big' }, state.queue != null ? `Posição ${state.queue}` : 'Aguardando…'),
      h('div', { class: 'sub' }, `Estimado: ${fmtTime(state.eta)}` + (state.speed ? ` · ${state.speed.toFixed(1)} pos/min` : '')));
  }

  function toast(m) { if (!toastEl) return; toastEl.textContent = m; toastEl.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => toastEl.classList.remove('on'), 2000); }

  function updateGear() {
    if (!gearEl) return;
    const hide = state.streaming || state.guideOpen || !cfg.gearOutside;     // durante o jogo: nenhum botão flutuante
    gearEl.className = `gear ${cfg.gearPos}${hide ? ' off' : ''}${gearEl.classList.contains('idle') ? ' idle' : ''}`;
  }
  function wakeGear(hold) {
    if (!gearEl) return; gearEl.classList.remove('idle'); clearTimeout(idleT);
    if (cfg.gearFade && !hold) idleT = setTimeout(() => !state.open && gearEl.classList.add('idle'), 3500);
  }

  function toggle(v) {
    if (!root) return; state.open = v ?? !state.open; native('panel', state.open);
    root.querySelector('#layer').classList.toggle('open', state.open);
    if (state.open) { wakeGear(true); km.keys.clear(); if (document.pointerLockElement) document.exitPointerLock(); setTimeout(() => panelEl.querySelector('.tab.on')?.focus(), 300); }
    updateTouch(); renderHud();
  }

  /* ---- navegação por teclado / controle ---- */
  const focusables = () => [...panelEl.querySelectorAll('button,select,input,textarea')];
  function moveFocus(d) {
    const f = focusables(); let i = f.indexOf(root.activeElement); i = i < 0 ? 0 : clamp(i + d, 0, f.length - 1, 0); f[i]?.focus(); f[i]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
  function adjust(d) {
    const e = root.activeElement; if (!e) return;
    if (e.type === 'range') { e.value = +e.value + d * (+e.step || 1); e.dispatchEvent(new Event('input')); }
    else if (e.tagName === 'SELECT') { e.selectedIndex = clamp(e.selectedIndex + d, 0, e.options.length - 1); e.dispatchEvent(new Event('change')); }
  }
  // Comandos vindos do teclado, do controle (navegador) ou do Kotlin (app)
  function nav(cmd) {
    if (!state.open) return;
    if (cmd === 'down') moveFocus(1); else if (cmd === 'up') moveFocus(-1); else if (cmd === 'right') adjust(1); else if (cmd === 'left') adjust(-1);
    else if (cmd === 'ok') { const e = root.activeElement; if (e) e.tagName === 'SELECT' ? adjust(1) : e.click(); } else if (cmd === 'back') toggle(false);
    else if (cmd === 'tabprev' || cmd === 'tabnext') {
      const i = SCHEMA.findIndex(t => t.id === ui.tab), n = SCHEMA.length;
      ui.tab = SCHEMA[(i + (cmd === 'tabnext' ? 1 : n - 1)) % n].id; refresh();
      setTimeout(() => bodyEl.querySelector('button,select,input,textarea')?.focus(), 30);
    }
  }
  const cycleHud = () => { set('hudMode', cfg.hudMode === 'off' ? 'always' : 'off'); toast('Estatísticas: ' + (cfg.hudMode === 'off' ? 'desligadas' : 'ligadas')); };
  window.addEventListener('keydown', e => {
    if (e.ctrlKey && e.shiftKey) {
      const m = { KeyX: () => toggle(), KeyS: cycleHud, KeyK: saveClip, KeyP: screenshot }[e.code]; if (m) { e.preventDefault(); m(); return; }
    }
    if (km.locked && !state.open) { if (e.code !== 'Escape') { km.keys.add(e.code); e.preventDefault(); } return; }
    if (!state.open) return;
    if (e.key === 'Escape') { toggle(false); e.stopPropagation(); return; }
    const t = e.composedPath()[0], typing = (t?.tagName === 'INPUT' && !['range', 'checkbox'].includes(t.type)) || t?.tagName === 'TEXTAREA';
    if (typing) return;
    if (e.key === 'ArrowDown') { nav('down'); e.preventDefault(); e.stopPropagation(); } else if (e.key === 'ArrowUp') { nav('up'); e.preventDefault(); e.stopPropagation(); }
  }, true);
  window.addEventListener('keyup', e => { km.keys.delete(e.code); }, true);

  // No navegador: combo View+Menu e navegação via Gamepad API. No app, o Kotlin cuida disso (evita comandos duplicados).
  let latched = false, last = [];
  setInterval(() => {
    if (!state.ready || IN_APP()) return;
    const gp = [...rawPads()].find(g => g && g.buttons.length > 9); if (!gp) return; const b = i => gp.buttons[i]?.pressed;
    if (cfg.combo && b(8) && b(9)) { if (!latched) { latched = true; toggle(); } } else if (!b(8) && !b(9)) latched = false;
    if (state.open) {
      const edge = i => b(i) && !last[i];
      if (edge(13)) nav('down'); if (edge(12)) nav('up'); if (edge(15)) nav('right'); if (edge(14)) nav('left'); if (edge(0)) nav('ok'); if (edge(1)) nav('back'); if (edge(4)) nav('tabprev'); if (edge(5)) nav('tabnext');
    }
    last = gp.buttons.map(x => x.pressed);
  }, 50);

  // Gestos invisíveis para abrir o painel durante o jogo (não deixam nada na tela)
  let topT = 0;
  const cancelTop = () => clearTimeout(topT);
  window.addEventListener('touchstart', e => {
    if (!state.streaming || state.open) return;
    if (cfg.gesture3 && !tc.visible && e.touches.length === 3) { cancelTop(); toggle(true); return; }
    if (cfg.gestureTop && e.touches.length === 1) {
      const t = e.touches[0];
      if (t.clientY < 60 && Math.abs(t.clientX - window.innerWidth / 2) < 90) { cancelTop(); topT = setTimeout(() => toggle(true), 1000); }
    }
  }, { passive: true, capture: true });
  ['touchend', 'touchcancel'].forEach(ev => window.addEventListener(ev, cancelTop, { passive: true, capture: true }));

  const start = () => {
    if (state.ready) return; state.ready = true; build();
    if (cfg.debug) new MutationObserver(() => { if (state.streaming) log('DOM mudou', discover().slice(0, 8)); }).observe(document.documentElement, { childList: true, subtree: true });
    toast(`xCloud Enhancer v${VERSION} ativo`);
    ['pointermove', 'touchstart'].forEach(ev => window.addEventListener(ev, () => wakeGear(), { passive: true }));
    let fs = false; window.addEventListener('pointerdown', () => { if (cfg.autoFs && !fs && !IN_APP()) { fs = true; document.documentElement.requestFullscreen?.().catch(() => {}); } });
  };
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', start) : start();

  // API para o app Android e para testes
  window.xce = { cfg, state, set, nav, toggle: v => toggle(v), back: () => { if (state.open) { toggle(false); return true; } if (state.streaming && cfg.backOpens) { toggle(true); return true; } return false; },
    tab: id => { ui.tab = id; refresh(); }, tabId: () => ui.tab, discover };
  } catch (e) { fatal(e); }

  // Se algo der errado ao iniciar, mostra um aviso vermelho na tela (toque para fechar)
  function fatal(e) {
    console.error('[xce] erro fatal', e);
    const show = () => {
      const d = document.createElement('div');
      d.style.cssText = 'position:fixed;left:8px;right:8px;top:8px;z-index:2147483647;background:#7a1020;color:#fff;font:12px monospace;padding:8px 10px;border-radius:8px;white-space:pre-wrap';
      d.textContent = 'xCloud Enhancer: erro ao iniciar\n' + ((e && e.stack) || e); d.onclick = () => d.remove();
      (document.body || document.documentElement).append(d);
    };
    document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', show) : show();
  }
})();
