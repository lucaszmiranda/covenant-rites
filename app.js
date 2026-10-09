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
// "[Nome] " no começo da linha diz quem canta dali em diante; "*trecho*" (backing) sai sublinhado.
const SINGER = /^\[([^\]]+)\]\s*/;
const splitLines = s => s.split(/ — |\n/);
const text = l => esc(l).replace(/\*([^*]+)\*/g, "<em>$1</em>");

function singerHTML(l) {
  const m = l.match(SINGER);
  if (!m) return `<span class="who"></span>`;
  const color = (setlist.singers || {})[m[1]];
  return `<span class="who"${color ? ` style="--who:${color}"` : ""}>${m[1].split("/").map(esc).join("/<wbr>")}</span>`;
}

// Com cantor marcado, cada linha ganha a coluna do nome à esquerda (vazia quando segue o mesmo cantor).
const stanza = (s, sung) => sung
  ? `<p class="sung">${splitLines(s).map(l => `${singerHTML(l)}<span>${text(l.replace(SINGER, ""))}</span>`).join("")}</p>`
  : `<p>${splitLines(s).map(text).join("<br>")}</p>`;

const lyricsHTML = (lines, sung) => (lines && lines.length ? `<div class="lyrics">${lines.map(s => stanza(s, sung)).join("")}</div>` : "");

const hasSingers = song => song.structure
  .flatMap(b => b.parts || [b])
  .flatMap(p => (p.lyrics || []).flat())
  .some(s => splitLines(s).some(l => SINGER.test(l)));

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
    ${lyricsHTML(lyrics, flow.sung)}
  </div>`;
}

// Bloco que repete vira uma lista reta: cada passada desenhada inteira, em sequência.
function repeatHTML(song, block, flow) {
  return Array.from({ length: block.repeat }, (_, k) =>
    block.parts.map(p => partHTML(song, p, k, flow)).join("")).join("");
}

/* ---------- Infos da música (do README da banda) ---------- */

// "Formação" vem como "Nome (papel) • Nome (papel)"; cada pessoa vira uma linha que não quebra no meio.
function infoHTML(id) {
  const info = (setlist.songs.find(s => s.id === id) || {}).info;
  if (!info) return "";
  const value = (k, v) => k === "Formação"
    ? v.split(" • ").map(x => `<span class="member">${esc(x)}</span>`).join("")
    : esc(v);
  return `<dl class="info">${Object.entries(info).map(([k, v]) =>
    `<div><dt>${esc(k)}</dt><dd>${value(k, v)}</dd></div>`).join("")}</dl>`;
}

function renderSong(song) {
  const flow = { bpm: null, sung: hasSingers(song) };
  const blocks = song.structure.map(block =>
    (block.repeat ? repeatHTML(song, block, flow) : partHTML(song, block, null, flow))).join("");

  $("#song").innerHTML = `
    <section class="head">
      <h1>${esc(song.title)}</h1>
      <p class="artist">${esc(song.artist)}</p>
      ${infoHTML(song.id)}
    </section>
    <section class="structure">${blocks}</section>`;
  document.title = `${song.title} · Covenant Rites`;
}

/* ---------- Ordem do show ---------- */

// Lista reta do show: o que acontece antes de cada música ("before") e a música em si.
// Em nota, "**trecho**" sai em negrito e "*trecho*" em itálico.
const noteText = s => esc(s).replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/\*([^*]+)\*/g, "<i>$1</i>");

function renderShow() {
  const steps = setlist.songs.map((s, i) => `
    ${(s.before || []).length ? `<ul class="between">${s.before.map(n => `<li>${noteText(n)}</li>`).join("")}</ul>` : ""}
    <button class="show-song" data-id="${esc(s.id)}"${s.ready ? "" : " disabled"}>
      <span class="n">${i + 1}</span>
      <span><b>${esc(s.title)}</b> <small>${esc(s.artist)}</small></span>
    </button>`).join("");
  $("#show").innerHTML = `
    <summary>Ordem do show <small>${esc(setlist.event)}${setlist.start ? ` · início ${esc(setlist.start)}` : ""}</small></summary>
    <div class="show-body">${steps}</div>`;
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
  renderShow();

  $("#show").addEventListener("click", e => {
    const btn = e.target.closest(".show-song");
    if (!btn || btn.disabled) return;
    show(btn.dataset.id);
    $("#setlist").scrollIntoView({ behavior: "smooth" });
  });

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
