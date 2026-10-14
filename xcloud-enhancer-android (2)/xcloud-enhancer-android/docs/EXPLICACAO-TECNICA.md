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
