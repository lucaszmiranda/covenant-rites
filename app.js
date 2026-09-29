const $ = sel => document.querySelector(sel);

const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const cache = {};
let setlist;

async function getJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Falha ao carregar ${path}`);
  return res.json();
}

async function getSong(id) {
  if (!cache[id]) cache[id] = await getJSON(`data/songs/${id}.json`);
  return cache[id];
}

/* ---------- Letra ---------- */

const line = l => `<p>${esc(l).replace(" — ", ' <span class="dash">—</span> ')}</p>`;

// Numa parte que repete, a letra vem uma por passada. Se for igual em todas, mostra uma vez só.
function lyricsHTML(lyrics, inRepeat) {
  if (!lyrics || !lyrics.length) return "";
  const passes = inRepeat ? lyrics : [lyrics];
  const allSame = passes.every(p => JSON.stringify(p) === JSON.stringify(passes[0]));
  const shown = allSame ? [passes[0]] : passes;
  return `<div class="lyrics">${shown.map((p, i) => `
    <div class="pass">
      ${shown.length > 1 ? `<span class="pass-n">${i + 1}ª</span>` : ""}
      <div>${p.map(line).join("")}</div>
    </div>`).join("")}</div>`;
}

/* ---------- Estrutura ---------- */

function partHTML(song, part, inRepeat) {
  const color = song.colors[part.color || part.name] || "#999";
  return `<div class="part" style="--c:${color}">
    <div class="part-top">
      <span class="part-name">${esc(part.name)}${part.detail ? ` <small>${esc(part.detail)}</small>` : ""}</span>
      ${part.bpm ? `<span class="bpm">${part.bpm} bpm</span>` : ""}
      <span class="bars"><b>${part.bars}</b>${part.bars === 1 ? "compasso" : "compassos"}</span>
    </div>
    ${lyricsHTML(part.lyrics, inRepeat)}
  </div>`;
}

function renderSong(song) {
  const lineup = song.lineup.map(p => `${esc(p.name)} <small>(${esc(p.role)})</small>`).join(" · ");
  const blocks = song.structure.map(block => block.repeat
    ? `<div class="repeat"><span class="repeat-badge">Repete ${block.repeat}×</span>
         ${block.parts.map(p => partHTML(song, p, true)).join("")}
       </div>`
    : partHTML(song, block, false)
  ).join("");

  $("#song").innerHTML = `
    <section class="head">
      <h1>${esc(song.title)}</h1>
      <p class="artist">${esc(song.artist)}</p>
      <dl class="facts">
        <div><dt>Formação</dt><dd>${lineup}</dd></div>
        <div><dt>Referência</dt><dd>${esc(song.reference || "")}</dd></div>
        <div><dt>Tom</dt><dd>${esc(song.key)} <small>${esc(song.keyNote || "")}</small></dd></div>
      </dl>
    </section>
    <section class="structure">${blocks}</section>`;
  document.title = `${song.title} · Covenant Rites`;
}

/* ---------- Setlist ---------- */

function renderSetlist(currentId) {
  $("#setlist").innerHTML = setlist.songs.map((s, i) =>
    `<button data-id="${esc(s.id)}" aria-current="${s.id === currentId}"><span class="n">${i + 1}</span>${esc(s.title)}</button>`
  ).join("");
}

async function show(id) {
  renderSetlist(id);
  try {
    renderSong(await getSong(id));
  } catch (err) {
    $("#song").innerHTML = `<p class="error">Não deu pra carregar essa música (${esc(err.message)}).</p>`;
  }
  history.replaceState(null, "", `?song=${encodeURIComponent(id)}`);
}

async function init() {
  setlist = await getJSON("data/setlist.json");

  $("#setlist").addEventListener("click", e => {
    const btn = e.target.closest("button");
    if (!btn) return;
    show(btn.dataset.id);
    scrollTo({ top: 0 });
  });

  const wanted = new URLSearchParams(location.search).get("song");
  const first = setlist.songs.some(s => s.id === wanted) ? wanted : setlist.songs[0].id;
  show(first);
}

init().catch(err => {
  $("#song").innerHTML = `<p class="error">Não deu pra carregar o setlist (${esc(err.message)}). Se abriu o arquivo direto do disco, precisa de um servidor local ou do GitHub Pages.</p>`;
});
