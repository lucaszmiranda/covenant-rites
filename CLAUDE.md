# covenant-rites

Página de setlist da banda Covenant Rites: o mapa de cada música pra banda consultar no ensaio, no celular ou notebook. Formato dos arquivos e como rodar local estão no [README](README.md).

O site publicado (https://lucaszmiranda.github.io/covenant-rites/, GitHub Pages) é o que a banda usa. Próximo show: 17/10/2026.

## Regras

- **Toda alteração vai pro GitHub na hora**: commit e push pra `origin main`, sem perguntar. Mudança só local não chega na banda.
- **Mapa linear e essencial.** De cima pra baixo, na ordem em que a música acontece. Repetição sempre desenrolada, cada passada escrita inteira; nada de colchete nem "×2". bpm só onde muda. Só o essencial: parte, compassos, letra no lugar. O Lucas já recusou versão com tab, bateria e número de compasso ("muito complicado") e versão com repetição colapsada.
- Visual escuro, paleta lovecraftiana (verde-azulado, cor de osso). Nada de ocre ou marrom. Seções vizinhas com cores bem distintas.
- A página é pra vocalista que não estuda, guitarrista e baterista. Antes de enfeitar, confira que a leitura bate com a música.

## Detalhes que já custaram tempo

- **Cache:** `index.html` carrega `style.css?v=N` e `app.js?v=N`. Mudou CSS ou JS, sobe o N nos dois, senão o celular da banda continua com a versão velha.
- **Letra:** em parte sem repetição, `lyrics` é uma lista de estrofes (string). Dentro da estrofe, `\n` ou ` — ` quebram a linha. Em bloco `repeat`, `lyrics` é uma lista por passada, e cada passada é uma lista de estrofes.
- **Cor:** `colors` é por nome de parte. Parte que deve herdar a cor de outra usa `"color": "<nome da outra>"`.
- **Botão do setlist:** música só fica clicável com `"ready": true` em `data/setlist.json`. Hoje faltam Deathcrush (Mayhem) e The Return of Darkness and Evil (Behemoth).
- **Fonte da estrutura:** os .gp em `gp/`. O Guitar Pro é referência; a versão da banda manda (ex.: Black Metal ficou toda em 163 bpm de propósito, mesmo o .gp tendo 160 num trecho). Na dúvida sobre como a banda toca, pergunte.
- Existe um rascunhador automático de .gp pro formato deste repo em `C:\Users\lucas\github-projects\music-app-idea\prototipos\gp-import` (AlphaTab). Bom quando o .gp tem seções marcadas; sempre revisar o resultado à mão.
- Artifact espelho do site, público por link: https://claude.ai/artifact/3xzHWDiqp5AaFqQ15Aqq5s. Se for republicado, manter igual ao repo.

## Projeto vizinho

A ideia de transformar isto em produto vive em `C:\Users\lucas\github-projects\music-app-idea` (repo privado). Trabalho de produto vai lá, não aqui.
