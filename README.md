# Covenant Rites · Charts

Página estática com o material de estudo do setlist: mapa da estrutura, tab por instrumento e letra, tudo alinhado por seção.

## Como está organizado

- `index.html`, `style.css`, `app.js`: a página. Sem build, sem dependência.
- `data/setlist.json`: evento e lista de músicas (o seletor do topo lê daqui).
- `data/songs/<id>.json`: o que é escrito à mão por música: tom, referência, formação, nome dos instrumentos, cores das seções, colchetes de repetição do mapa, letra por seção e observações.
- `data/scores/<id>.json`: gerado a partir do Guitar Pro. Não editar à mão.
- `gp/`: arquivos Guitar Pro originais.
- `tools/gp2json.py`: extrator do `.gp` (Guitar Pro 7/8) pro JSON de `data/scores/`.

## Adicionar uma música

1. Colocar o `.gp` em `gp/<id>.gp`.
2. `python tools/gp2json.py gp/<id>.gp data/scores/<id>.json`
3. Criar `data/songs/<id>.json` seguindo o de Circle of the Tyrants. A letra é indexada pelo número da seção (o `#` que aparece no mapa).
4. Adicionar a música em `data/setlist.json`.

## Rodar local

A página carrega os JSON via `fetch`, então precisa de servidor (abrir o arquivo direto do disco não funciona): `python -m http.server 8765` na raiz e abrir `http://localhost:8765`.
