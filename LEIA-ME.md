# xCloud Enhancer 1.0.4 (Android / Android TV)

## Como ter CERTEZA de que está usando a versão nova
O APK correto se chama **xcloud-enhancer-1.0.4.apk**, o app aparece como **"xCloud Enhancer 1.0.4"** e, ao abrir, mostra um aviso com o número da versão.
Se o nome do APK ou o aviso não tiver 1.0.4, você está com um build antigo.

## Passo a passo (começo limpo, recomendado)
1. Descompacte o zip no computador. Dentro da pasta `xcloud-enhancer-android` estão `app`, `docs`, `.github`, `build.gradle.kts`...
2. No GitHub, crie um repositório NOVO (ou apague os arquivos do antigo).
3. Envie o CONTEÚDO da pasta (não o .zip e não a pasta inteira). Na raiz do repositório devem aparecer `app`, `.github`, `settings.gradle.kts`.
   Confira que existe `app/debug.keystore` e `.github/workflows/build.yml`.
4. Aba Actions → "Build APK" → Run workflow. No log, o passo "Versão do script" deve mostrar `Script versão 1.0.4`.
5. Baixe o artefato `xcloud-enhancer-1.0.4` (zip com o .apk) da execução MAIS RECENTE.
6. No celular/TV: DESINSTALE o app antigo e instale o .apk.

## Atualizações futuras (mais fáceis)
Se só o script mudar, basta substituir UM arquivo no GitHub:
`app/src/main/assets/xcloud-enhancer.user.js` → lápis (editar) → apagar tudo → colar o novo conteúdo → Commit. O Actions gera o APK novo.

## Abrir o painel
- Fora do jogo: botão ⚙. Durante o jogo: ícone do plug-in na barra de ícones do Hub (ao lado da engrenagem).
- **Controle (gamepad): apertar View e Menu (Start) ao mesmo tempo.**
- **Controle remoto da TV: botão de detalhes ("i").**
- Celular: botão Voltar, toque com 3 dedos ou segurar o topo da tela por 1 s.

## Navegar no painel com o controle
Direcional = mover · A = confirmar · B = fechar · LB/RB = trocar de aba. O jogo não recebe comandos enquanto o painel está aberto.

## Som atrasado na TV
Em Vídeo → Áudio, teste "Baixo atraso". O indicador "Áudio" nas estatísticas mostra o buffer em ms; se ele já for baixo, o atraso vem da TV (ative o Modo Jogo e desligue efeitos de áudio).
