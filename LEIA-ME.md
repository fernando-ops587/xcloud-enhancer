# xCloud Enhancer 1.1.2 (Android / Android TV)

## Instalar (começo limpo, recomendado)
1. Descompacte o zip. Dentro da pasta `xcloud-enhancer-android` estão `app`, `docs`, `.github`, `build.gradle.kts`...
2. No GitHub, crie um repositório NOVO (ou apague os arquivos do antigo) e envie o CONTEÚDO da pasta (não o .zip). Confira `app/debug.keystore` e `.github/workflows/build.yml`.
3. Actions → "Build APK" → Run workflow. No log, o passo "Versão do script" deve mostrar `Script versão 1.1.2`.
4. Baixe o artefato `xcloud-enhancer-1.1.2` (zip com o .apk) da execução mais recente.
5. DESINSTALE o app antigo e instale o .apk. Ao abrir, aparece "xCloud Enhancer 1.1.2".

Atualizações só do script: GitHub → `app/src/main/assets/xcloud-enhancer.user.js` → lápis → apagar tudo → colar o novo → Commit.

## Abrir o painel
- Fora do jogo: botão ⚙. Durante o jogo: ícone do plug-in na barra do Hub (ao lado da engrenagem).
- Controle: View + Menu juntos. Controle remoto da TV: botão de detalhes ("i"). Celular: botão Voltar, 3 dedos, ou segurar o topo da tela.
- No painel: direcional move, A confirma, B fecha, LB/RB trocam de aba.

## Perfis rápidos (Vídeo)
"Desempenho máximo" (720p, H.264, sem filtros — recomendado na TV), "Equilibrado" e "Qualidade".

## Estatísticas
Aparecem só com o Hub aberto. Por padrão só 4 indicadores leves: FPS, Ping, Bitrate e Áudio. Os demais pesam mais e ficam desligados.
O indicador "Áudio" mostra o buffer em ms e o jitter de chegada (j). Jitter alto = rede em rajadas.

## Áudio atrasado na TV (v1.1.2: agora igual ao better-xcloud)
- O app usa a identificação REAL do WebView (como o better-xcloud), e nada de resolução, codec ou áudio é forçado por padrão.
- Ao abrir, o app mostra "xCloud Enhancer 1.1.2 · WebView NN". **Se NN for menor que 110, o WebView da TV é antigo: atualize "Android System WebView" (e o Chrome) na loja de apps da TV.**
- Se o site não abrir, vá em Avançado → "Identificação do navegador" e teste "Windows + Edge" ou "Smart TV".
- Avançado → "Diagnosticar áudio (10 s)" mostra onde está o atraso e a versão do WebView.
