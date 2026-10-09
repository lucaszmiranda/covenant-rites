# Covenant Rites · Setlist

Página única com o mapa de cada música do setlist: as partes em ordem, quantos compassos cada uma tem, o que repete e a letra no lugar certo. Feita pra fazer sentido pra todo mundo da formação, cantando ou tocando.

## Arquivos

- `index.html`, `style.css`, `app.js`: a página. Sem build, sem dependência.
- `data/setlist.json`: evento, horário e ordem das músicas (vira os botões do topo e o bloco "Ordem do show"). Só fica clicável a música com `"ready": true`. Cada música pode ter `before` (o que acontece antes dela no show, uma linha por item, `**negrito**` e `*itálico*` valem) e `info` (Formação, Referência, Tom, Nota, copiados do README.docx da pasta do evento no Drive; aparecem no topo da música).
- `data/songs/<id>.json`: uma música: título, banda, cores e estrutura.
- `gp/`: arquivos Guitar Pro de referência, usados pra levantar a estrutura.

## Estrutura de uma música

`structure` é a lista de partes em ordem. Cada parte tem `name`, `bars` (compassos) e, se precisar, `bpm`, `color` (nome de outra parte pra herdar a cor) e `lyrics`. Um bloco que repete é `{ "repeat": 2, "parts": [...] }`, e aí a letra de cada parte vem uma por passada.

Na letra, `[Nome] ` no começo de uma linha diz quem canta dali em diante (ex.: `"[Lucas] Black metal"`, ou `[Felipe/Lucas]` pros dois). O nome aparece numa coluna à esquerda, na cor definida em `singers` no `data/setlist.json`. `*trecho*` é backing do outro vocalista e sai só sublinhado. Black Metal serve de modelo.

A página sempre desenha a música como lista reta, na ordem em que ela acontece: um bloco que repete aparece inteiro a cada passada, sem colchete nem "×2". O selo de bpm só aparece onde o andamento muda em relação ao que vinha tocando. Circle of the Tyrants serve de modelo.

## Rodar local

A página carrega os JSON via `fetch`, então precisa de servidor: `python -m http.server 8765` na raiz e abrir `http://localhost:8765`.
