const $ = sel => document.querySelector(sel);

const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const cache = {};
let setlist;

async function getJSON(path) {
  const res = await fetch(path, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Falha ao carregar ${path}`);
  return res.json();
}

async function getSong(id) {
  if (!cache[id]) cache[id] = await getJSON(`data/songs/${id}.json`);
  return cache[id];
}

/* ---------- Letra ---------- */

// Cada item é uma estrofe: " — " ou quebra de linha viram linhas separadas, com respiro entre estrofes.
const line = l => `<p>${l.split(/ — |\n/).map(esc).join("<br>")}</p>`;

const lyricsHTML = lines => (lines && lines.length ? `<div class="lyrics">${lines.map(line).join("")}</div>` : "");

/* ---------- Estrutura ---------- */

// Tudo aparece na ordem em que a música acontece.
// O selo de bpm só aparece onde o andamento muda de fato em relação ao que vinha tocando.
function partHTML(song, part, pass, flow) {
  const color = song.colors[part.color || part.name] || "#999";
  const lyrics = pass == null ? part.lyrics : (part.lyrics || [])[pass];
  const changes = part.bpm && part.bpm !== flow.bpm;
  if (part.bpm) flow.bpm = part.bpm;
  return `<div class="part" style="--c:${color}">
    <div class="part-top">
      <span class="part-name">${esc(part.name)}${part.detail ? ` <small>${esc(part.detail)}</small>` : ""}</span>
      ${changes ? `<span class="bpm">${part.bpm} bpm</span>` : ""}
      <span class="bars"><b>${part.bars}</b>${part.bars === 1 ? "compasso" : "compassos"}</span>
    </div>
    ${lyricsHTML(lyrics)}
  </div>`;
}

// Bloco que repete vira uma lista reta: cada passada desenhada inteira, em sequência.
function repeatHTML(song, block, flow) {
  return Array.from({ length: block.repeat }, (_, k) =>
    block.parts.map(p => partHTML(song, p, k, flow)).join("")).join("");
}

function renderSong(song) {
  const flow = { bpm: null };
  const blocks = song.structure.map(block =>
    (block.repeat ? repeatHTML(song, block, flow) : partHTML(song, block, null, flow))).join("");

  $("#song").innerHTML = `
    <section class="head">
      <h1>${esc(song.title)}</h1>
      <p class="artist">${esc(song.artist)}</p>
    </section>
    <section class="structure">${blocks}</section>`;
  document.title = `${song.title} · Covenant Rites`;
}

/* ---------- Setlist ---------- */

function renderSetlist(currentId) {
  $("#setlist").innerHTML = setlist.songs.map(s =>
    `<button data-id="${esc(s.id)}" aria-current="${s.id === currentId}"${s.ready ? "" : " disabled title=\"Mapa ainda não montado\""}>${esc(s.title)}</button>`
  ).join("");
}

async function show(id) {
  renderSetlist(id);
  try {
    renderSong(await getSong(id));
  } catch (err) {
    $("#song").innerHTML = `<p class="error">Não deu pra carregar essa música (${esc(err.message)}).</p>`;
  }
  // A música escolhida vai no # do link (é o único pedaço de URL que sobrevive dentro de um artifact)
  try { history.replaceState(null, "", `#${id}`); } catch (e) { /* sem histórico, segue */ }
}

async function init() {
  setlist = await getJSON("data/setlist.json");

  $("#setlist").addEventListener("click", e => {
    const btn = e.target.closest("button");
    if (!btn) return;
    show(btn.dataset.id);
    scrollTo({ top: 0 });
  });

  const wanted = location.hash.slice(1) || new URLSearchParams(location.search).get("song");
  const ready = setlist.songs.filter(s => s.ready);
  const first = ready.some(s => s.id === wanted) ? wanted : ready[0].id;
  show(first);
}

init().catch(err => {
  $("#song").innerHTML = `<p class="error">Não deu pra carregar o setlist (${esc(err.message)}). Se abriu o arquivo direto do disco, precisa de um servidor local ou do GitHub Pages.</p>`;
});
