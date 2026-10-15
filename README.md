# Covenant Rites · Setlist

Página única com o mapa de cada música do setlist: as partes em ordem, quantos compassos cada uma tem, o que repete e a letra no lugar certo. Feita pra fazer sentido pra todo mundo da formação, cantando ou tocando.

## Arquivos

- `index.html`, `style.css`, `app.js`: a página. Sem build, sem dependência.
- `data/setlist.json`: evento e ordem das músicas (vira os botões do topo e o bloco "Ordem do show"). Só fica clicável a música com `"ready": true`. `opening` são as linhas do começo do bloco "Ordem do show". Cada música pode ter `before` (blocos que vêm antes dela no show: texto, ou `{ title, artist, notes }` pra uma faixa como a intro), `notes` (linhas dentro do bloco da música; `**negrito**` e `*itálico*` valem em tudo) e `info` (Formação, Referência, Tom, Nota, copiados do README.docx da pasta do evento no Drive; aparecem no topo da música).
- `data/songs/<id>.json`: uma música: título, banda, cores e estrutura.
- `gp/`: arquivos Guitar Pro de referência, usados pra levantar a estrutura.

## Estrutura de uma música

`structure` é a lista de partes em ordem. Cada parte tem `name`, `bars` (compassos) e, se precisar, `bpm`, `color` (nome de outra parte pra herdar a cor) e `lyrics`. Um bloco que repete é `{ "repeat": 2, "parts": [...] }`, e aí a letra de cada parte vem uma por passada.

Na letra, `[Nome] ` no começo de uma linha diz quem canta dali em diante (ex.: `"[Lucas] Black metal"`, ou `[Felipe/Lucas]` pros dois). O nome aparece numa coluna à esquerda, na cor definida em `singers` no `data/setlist.json`. Se o cantor tiver foto (`"Luana": { "photo": "assets/singers/luana.jpg" }`), aparece um quadradinho com o rosto no lugar do nome; fotos ficam em `assets/singers/`, recortadas no rosto. `*trecho*` é backing do outro vocalista e sai só sublinhado. Black Metal serve de modelo.

A página sempre desenha a música como lista reta, na ordem em que ela acontece: um bloco que repete aparece inteiro a cada passada, sem colchete nem "×2". O selo de bpm só aparece onde o andamento muda em relação ao que vinha tocando. Circle of the Tyrants serve de modelo.

## Modos de leitura

Acima do mapa de cada música tem três controles. Apenas letra e Quem canta valem pra todas as músicas e ficam guardados no aparelho.

- **Apenas letra**: esconde as partes sem letra.
- **Quem canta** (só em música com mais de um vocalista): Todos, ou um vocalista. Escolhendo um, só sobram as linhas dele, incluindo as que ele canta junto (`[Felipe/Lucas]`). Com Apenas letra ligado junto, some também a parte em que ele não canta.
- **Tocar**: tela cheia, a parte da vez acesa com uma barrinha de progresso, e a página rolando no tempo (compassos × 4 × 60 / bpm, tudo em 4/4). Tocar numa parte faz a contagem seguir dali, pra ressincronizar com a banda. Com Apenas letra ligado, a próxima parte com letra fica esperando na linha enquanto as instrumentais passam. A tela não apaga enquanto toca (onde o navegador deixa).

## Rodar local

A página carrega os JSON via `fetch`, então precisa de servidor: `python -m http.server 8765` na raiz e abrir `http://localhost:8765`.
