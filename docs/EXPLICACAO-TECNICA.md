# xCloud Enhancer 1.0 — explicação técnica

> Os nomes de classes, campos JSON e headers abaixo vêm do que se sabe do site e do projeto better-xcloud.
> A Microsoft muda isso sem aviso. Tudo que depende deles está marcado com **(validar)** e é fácil de ajustar.

## 1. Como injetar o painel no Hub sem quebrar a interface

**Princípio:** nunca altere nem remova nós do React; apenas *adicione* um elemento irmão e reponha-o se o React o apagar.

1. O script roda em `document-start`, antes do app. Só depois (a cada 600 ms, `hubScan()`) ele procura o container do menu do jogo com `[class*="StreamMenu"]` **(validar)**. Usar `[class*=...]` em vez de nomes exatos sobrevive aos hashes do CSS Modules (`StreamMenu-module__menu___a1b2c`).
2. Achando o container, cria um `<button data-xce>` com a **mesma `className` do primeiro botão nativo** — assim herda fonte, foco e animação da Microsoft — e o anexa ao mesmo pai.
3. O React pode re-renderizar e apagar o botão; por isso `hubScan()` verifica `el.querySelector('[data-xce]')` e o recoloca. Isso é mais robusto que um `MutationObserver` sozinho e não cria laço de re-render.
4. A existência do container também é o sinal de **"Hub aberto"** (`state.hubOpen`): mostra as estatísticas (modo "Só com o Hub aberto") e esconde os controles de toque.
5. Durante o jogo **não existe nenhum elemento do plugin na tela**: o ⚙ é escondido enquanto há stream, os controles de toque só aparecem se você ativar, e o painel abre pelo botão do Hub, por **View + Menu** (segure ~1 s) ou por `Ctrl+Shift+X`.
6. O painel vive em **Shadow DOM**: o CSS do plugin não vaza para o xCloud e o CSS do xCloud não afeta o plugin.

**Se o botão não aparecer:** os seletores mudaram. Em Avançado, toque em *Descobrir elementos do Hub* com o Hub aberto; ele lista classes candidatas. Copie a que corresponde ao menu em *Interface → Seletor CSS do Hub*. No app (build debug) abra `chrome://inspect` no PC para inspecionar a página ao vivo.

## 2. Região sem VPN do sistema

**Por que a VPN falhou:** ela muda o IP de *tudo* — login, tokens e streaming. O servidor de identidade vê um país, a conta pertence a outro, e a sessão é recusada.

**O que o plugin faz:** separa as chamadas.

| Chamada | Tratamento |
|---|---|
| Login, tokens (`*.xboxlive.com`, `login.live.com`) | **Intocada** — continua saindo da sua rede/região real |
| `POST …/v5/sessions/cloud/play` | O *host* é trocado pelo `baseUri` da região escolhida (a lista vem da resposta de `/v2/login/user`, campo `offeringSettings.regions`) **(validar)** |
| Polling `…/sessions/cloud/{id}/…` | Segue para o host que a própria resposta da sessão indicar |
| Vídeo/áudio (WebRTC) | Negociado entre você e o datacenter da sessão |

Troca de host é exatamente o que o seletor de região do better-xcloud faz. No painel *Rede* há ping por região e botão "Usar".

**O que NÃO foi implementado, de propósito**
- **Forjar cabeçalhos de geolocalização** (`X-Gip-GeoLocation` etc.) para o servidor achar que você está em outro país. Isso contorna a verificação de região/licenciamento do serviço, pode levar a bloqueio da conta e não é necessário para escolher o datacenter. `MS-CV` é só um vetor de correlação de logs, não afeta fila nem região.
- **Medir "tempo de fila" de todas as regiões:** só dá para saber a fila de uma região criando uma sessão nela. Isso gastaria vagas de outros jogadores. O painel mede **ping**, que é seguro.
- **Anti-AFK com entradas falsas:** burla o encerramento por inatividade, que existe para liberar o servidor. Em vez disso há **tela sempre ligada** (Wake Lock) e o jogo continua sob as regras normais.
- **Re-enfileirar sem limites:** a opção "Repetir se a criação da sessão falhar" só repete erros 5xx/429, com espera crescente (10 s, 20 s, 40 s…) e no máximo 5 vezes. Dentro do hook, a resposta final é entregue ao app, que continua o fluxo normal.

## 3. Entrada (teclado+mouse, giroscópio, toque)

Todos geram um **estado virtual** (17 botões + 4 eixos) que é mesclado em `navigator.getGamepads()`:
- Com controle físico: virtual é somado ao primeiro controle (botão = máximo, eixo = soma limitada).
- Sem controle: o plugin expõe um gamepad virtual padrão e dispara `gamepadconnected`.
- Painel aberto: todos os botões/eixos viram neutros; no app o Kotlin ainda consome as teclas do controle.

Curva e zona morta são **radiais** (aplicadas ao vetor do analógico, não por eixo).

## 4. WebGL

O vídeo é desenhado em um `<canvas>` posicionado sobre o `<video>` (que fica com `opacity:0`). Um shader único faz, nesta ordem: FXAA leve → CAS (contraste adaptativo, estilo FidelityFX) → correção de daltonismo → vibrance/saturação → contraste/brilho → gama. Proporção (manter/preencher/esticar) é feita pelas coordenadas de textura. O áudio e o `MediaRecorder` continuam usando o `<video>` original (clipes sem os filtros).

## 5. Lista de testes sugerida

1. Abrir o app, logar, conferir a lista de regiões (Rede).
2. Iniciar um jogo e abrir o Hub: o botão "⚙ Enhancer" aparece?
3. Ativar estatísticas "Só com o Hub aberto".
4. View + Menu (1 s) abre o painel; D-Pad/A/B navegam; o jogo não reage.
5. WebGL + CAS 5/10: imagem mais nítida? FPS estável?
6. Ativar teclado+mouse com mouse USB ou testar no PC.
7. Se o cartão da fila não mostrar posição: Avançado → log, e confira o JSON em `chrome://inspect → Network`.

## 6. Como abrir o painel durante o jogo (v1.0.1)

A detecção do Hub depende do site da Microsoft e pode falhar, então há caminhos que **não dependem dele** e não deixam nada na tela:

| Onde | Como |
|---|---|
| Hub | Botão "⚙ Enhancer" (detectado por classe e, se falhar, pelo texto do botão "Desconectar/Disconnect") |
| App Android | Botão **Voltar** (ou gesto de voltar) durante o jogo abre/fecha o painel |
| Celular/tablet | **Toque com 3 dedos** ou **segurar o topo da tela por 1 s** |
| Controle | **View + Menu** por 1 s (no app, tratado pelo Kotlin) |
| TV | Tecla **Menu** do controle remoto |
| Teclado | `Ctrl+Shift+X` |

## 7. Correção do "app diferente do PC"

O script chamava `MutationObserver.observe(document.documentElement)` ao carregar. No WebView do app a página ainda está vazia nesse momento (`documentElement` é `null`), o que lançava um erro e interrompia o script antes de montar o painel. No PC (Tampermonkey) a página já existia, por isso funcionava. Agora:
- nada depende de DOM no carregamento;
- se algo falhar, aparece um aviso vermelho na tela com o erro;
- ao iniciar aparece o aviso "xCloud Enhancer v1.0.1 ativo";
- se o aparelho não suportar injeção no início da página, o Kotlin injeta o script ao carregar (o script ignora a segunda injeção).

## 8. Assinatura do APK

O projeto agora traz `app/debug.keystore` e o Gradle assina sempre com ele. Antes, cada build no GitHub Actions gerava uma chave nova e o Android recusava atualizar por cima do app antigo. **Desinstale a versão antiga uma vez**; depois disso as próximas versões atualizam sem desinstalar. É uma chave de debug (senha `android`) para uso pessoal; não publique na Play Store com ela.

## 9. Região (v1.0.2): por que mudou o método

Trocar só o *host* da chamada `/sessions/cloud/play` deixava o restante do fluxo (token, corpo e consulta da sessão) apontando para a região original, e algumas regiões recusavam a sessão. O método **padrão** agora é o do better-xcloud: na resposta do login (`/v2/login/user`) o plugin marca a região escolhida como `isDefault`, e o próprio site usa essa região do começo ao fim. O método antigo continua disponível como "Alternativo".
Se a região escolhida falhar, o plugin tenta de novo na região original (opção "tentar a automática"). Um aviso mostra qual servidor foi usado ("Servidor da sessão: …").
Uma região pode falhar por estar cheia ou por não estar liberada para a sua conta/mercado; isso o plugin não consegue contornar.

## 10. Botão no Hub (v1.0.3)

Estrutura confirmada no site (saída de "Descobrir elementos do Hub"): o Hub é `div.Guide-module__guide___xxxx`, dentro de um `Dialog`. Na parte de baixo há uma barra de botões `Button-module__iconButtonBase` com os nomes "Notificações", "Abrir tela inteira", "Controle não detectado" e "Configurações".

- O plugin procura **somente dentro** da raiz do Hub e coloca seu ícone na barra, antes de "Configurações". Assim o cabeçalho da página inicial (que também tem "Notificações") nunca recebe o botão.
- Funciona com o Hub aberto no menu **e** durante o jogo. As estatísticas só aparecem durante o jogo.
- A janela "Tem certeza?" ao sair do jogo é ignorada.
- O ⚙ flutuante some enquanto o Hub está aberto (ele cobria o sino de Notificações) e durante o jogo.
- Ao clicar no ícone, o painel abre e o Hub é fechado (opção em Interface), porque o diálogo do Hub prende o foco do teclado/controle e atrapalharia a navegação do painel.

## 11. Atalhos, navegação e áudio (v1.0.4)

**Atalhos (app):** View + Menu apertados juntos abrem/fecham o painel (sem precisar segurar); no controle remoto da TV, o botão de detalhes ("i", `KEYCODE_INFO`) faz o mesmo.

**Navegação com o controle:** com o painel aberto, o Kotlin consome todos os botões (o jogo não recebe nada) e envia comandos ao JS (`xce.nav`): direcional, A, B e LB/RB (troca de aba). O direcional também é lido como eixo "hat" (alguns controles não mandam teclas). O foco de cada opção ganha destaque.

**Áudio:** o atraso do som tem duas fontes possíveis: o buffer do navegador e o caminho de áudio da TV (HDMI, processamento, ausência de Modo Jogo). O plugin só controla a primeira, via `RTCRtpReceiver.jitterBufferTarget`/`playoutDelayHint` nos receptores de áudio (Vídeo → Áudio), e mostra o buffer real em ms (campo `jitterBufferDelay / jitterBufferEmittedCount` do `getStats`). No app, o "silenciar ao sair da aba" fica desativado.

## 12. Áudio com 4 s de atraso (v1.0.5)

4 s não é buffer de rede (o jitter buffer fica em dezenas/centenas de ms): indica fila de saída de áudio do aparelho (caminho do `<video>` no WebView da TV). Duas saídas:
- **Web Audio:** o som sai do `<video>` (mudo) e toca por um `AudioContext({latencyHint:'interactive'})`, outro caminho de saída. O Chrome só entrega áudio remoto ao Web Audio se o stream também estiver ligado a um elemento de mídia, por isso há um `<audio>` mudo auxiliar.
- **Ressincronizar:** solta e religa `video.srcObject`, o que reinicia o renderizador de áudio e descarta o que estiver na fila.

## 13. Navegação e desempenho (v1.0.6)

**Navegação:** o plugin guarda o próprio cursor (índice do item) e pinta o destaque. Não depende do foco do navegador, que o Hub ou o jogo podiam tirar do painel. Direcional move, A confirma/ajusta, B fecha, LB/RB trocam de aba.

**Travamentos:** o painel e as estatísticas só redesenham quando o valor muda; o ping automático só roda com o painel aberto e fora do jogo (a cada 30 s); o filtro WebGL limita a 30 quadros por segundo e a 1280 px de largura; as estatísticas atualizam a cada 2 s.

## 14. Desempenho e bitrate (v1.0.7)

Sinais medidos pelo usuário na TV (Wi-Fi): ping 30 ms, bitrate ~1,2 Mb/s, buffer de áudio > 1200 ms. Ping baixo com bitrate baixo e buffer alto indica que o vídeo chega devagar ao aparelho, o que faz o navegador pedir menos ao servidor, e não um problema de rota.

Mudanças:
- **Perfil de sistema:** 720p não envia mais `osName: android`. Só 1080p altera o perfil (`windows`). Se o bitrate estava baixo porque o servidor entregava um perfil de celular, isso resolve.
- **Filtro CSS:** o `filter` no `<video>` só é aplicado quando algum valor foge do padrão. Com os padrões, o vídeo não recebe nenhum estilo do plug-in.
- **WebSocket:** o hook que fazia `JSON.parse` em cada mensagem foi removido. A fila continua sendo lida das respostas HTTP da sessão.
- **Loop principal:** de 600 ms para 1 s; no modo leve não roda nada além da detecção do jogo.
- **Modo leve (teste):** desliga, durante o jogo, o HUD, o filtro, o WebGL, o Hub e o hook do controle. View + Menu continua funcionando.

## 15. Atraso de áudio na TV (v1.0.8)

**Regressão da 1.0.7 (corrigida):** a 1.0.7 deixou de enviar `osName: android` para o 720p. Quem usava 720p passou a receber o perfil de PC (1080p). O buffer de áudio subiu de ~1200 para ~3000 ms na mesma TV. Voltou ao comportamento anterior.

**Por que o áudio acompanha o vídeo:** o Chrome sincroniza áudio e vídeo (lip-sync). Se o vídeo chega atrasado ao pipeline de decodificação/renderização, o buffer de áudio é aumentado para acompanhá-lo. Por isso um vídeo pesado demais para a TV também aumenta o atraso do som.

**Perfil leve (automático no app):** 720p, H.264 preferido e `jitterBufferTarget=0` no áudio. Só vale onde a opção estiver em Automático.

**Android:** composição do WebView na GPU (`LAYER_TYPE_HARDWARE`) e `WifiLock` em modo de baixa latência (evita que o rádio Wi-Fi entregue pacotes em rajadas).

**Diagnóstico nas estatísticas:** `Res`, `Codec`, `Decod.` (ms por quadro), `Perdidos` (quadros descartados por segundo), `Áudio` e `Bitrate`. Decodificação acima de ~16 ms ou muitos quadros perdidos indicam que o aparelho não dá conta do vídeo.

## 16. Versão final 1.1.0

**Estatísticas leves.** O relatório completo do `getStats()` é pesado (centenas de entradas, muita alocação). Agora o plug-in:
- consulta só o relatório pequeno do receptor de vídeo e/ou de áudio, e só se algum indicador daquele tipo estiver ligado;
- chama o relatório completo apenas para o ping, a cada 15 s, e só se o ping estiver ligado;
- amostra a cada 3 s, e só com o Hub/painel abertos (ou no modo "Sempre");
- atualiza o texto dos indicadores em vez de recriar a tela, sem desfoque (`backdrop-filter`) no HUD;
- vem com apenas FPS, Ping, Bitrate e Áudio ligados.

**Áudio na TV.** O app Android do better-xcloud (README oficial) limita a tela a 60 Hz e liga o ALLM. Ambos foram adicionados:
- `preferredRefreshRate = 60` e `preferredDisplayModeId` para o modo de 60 Hz na resolução atual. Imagem fora de compasso com a tela faz o navegador segurar o áudio para manter a sincronia com o vídeo;
- `setPreferMinimalPostProcessing(true)` (ALLM): a TV passa para o modo jogo, com menos processamento de imagem e som.
Também foi removida a camada de hardware do WebView adicionada na 1.0.8 (podia desligar a sobreposição de vídeo) e o WebView agora é destruído ao fechar o app (vazamento de memória).

**Diagnóstico de áudio.** O indicador mostra o buffer (`jitterBufferDelay/jitterBufferEmittedCount`) e o jitter de chegada dos pacotes de áudio. Buffer alto com jitter baixo aponta para o aparelho (saída de áudio/sincronia); jitter alto aponta para a rede.

**Ícone.** O ícone do app e o banner da Android TV usam a arte enviada, com versão adaptativa (círculo, quadrado arredondado e tema do Android 8+).
