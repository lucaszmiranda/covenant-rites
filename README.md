# Covenant Rites · Setlist

Página única com o mapa de cada música do setlist: as partes em ordem, quantos compassos cada uma tem, o que repete e a letra no lugar certo. Feita pra fazer sentido pra todo mundo da formação, cantando ou tocando.

## Arquivos

- `index.html`, `style.css`, `app.js`: a página. Sem build, sem dependência.
- `data/setlist.json`: evento e ordem das músicas (vira os botões do topo).
- `data/songs/<id>.json`: uma música: tom, formação, cores e estrutura.
- `gp/`: arquivos Guitar Pro de referência, usados pra levantar a estrutura.

## Estrutura de uma música

`structure` é a lista de partes em ordem. Cada parte tem `name`, `bars` (compassos) e, se precisar, `bpm` (quando o andamento muda ali), `detail` e `lyrics`. Um bloco que repete é `{ "repeat": 2, "parts": [...] }`, e aí a letra de cada parte vem uma por passada. Circle of the Tyrants serve de modelo.

## Rodar local

A página carrega os JSON via `fetch`, então precisa de servidor: `python -m http.server 8765` na raiz e abrir `http://localhost:8765`.
