# xCloud Enhancer 1.0.1 (Android / Android TV)

## IMPORTANTE: desinstale a versão antiga antes
Os builds antigos foram assinados com chaves diferentes e o Android não atualiza por cima. Desinstale uma vez; as próximas versões já atualizam normalmente.
Envie a pasta INTEIRA para o GitHub, inclusive `app/debug.keystore`.

## Gerar o APK
A) GitHub Actions: envie esta pasta para um repositório → aba Actions → "Build APK" → Run workflow → baixe o artefato `xcloud-enhancer-apk`.
B) Android Studio: abra a pasta → Build → Build APK(s).

## Conferir se está funcionando
Ao abrir o xCloud aparece, por 2 segundos, "xCloud Enhancer v1.0.1 ativo". Se aparecer um aviso vermelho, tire um print e envie.

## Abrir o painel
Fora do jogo: botão ⚙. Durante o jogo: botão do Hub, botão Voltar, toque com 3 dedos, segurar o topo da tela por 1 s, View + Menu, tecla Menu da TV.
O app abre em retrato ou paisagem, conforme a posição do aparelho.

Detalhes em `docs/EXPLICACAO-TECNICA.md`.
