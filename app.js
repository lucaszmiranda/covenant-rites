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

// Em "singers", cada nome tem uma cor ("#hex") ou { "photo", "color" }; com foto, o rosto entra no lugar do nome.
const singerInfo = n => {
  const v = (setlist.singers || {})[n];
  return typeof v === "string" ? { color: v } : v || {};
};

function singerHTML(who) {
  if (!who) return `<span class="who"></span>`;
  const names = who.split("/");
  const info = names.map(singerInfo);
  if (info.every(i => i.photo)) {
    return `<span class="who who-pics">${info.map((i, k) => `<img src="${esc(i.photo)}" alt="${esc(names[k])}" title="${esc(names[k])}">`).join("")}</span>`;
  }
  const color = info[0].color;
  return `<span class="who"${color ? ` style="--who:${color}"` : ""}>${names.map(esc).join("/<wbr>")}</span>`;
}

// Cada linha vira { who, mark, text }: quem canta segue valendo até o próximo "[Nome]", mesmo em outra parte.
function stanzaLines(s, flow) {
  return splitLines(s).map(l => {
    const m = l.match(SINGER);
    if (m) flow.who = m[1];
    return { who: flow.who, mark: !!m, text: l.replace(SINGER, "") };
  });
}

// Com um vocalista escolhido, só ficam as linhas dele (inclusive as que ele canta junto, "[A/B]").
// Aí a foto/nome só aparece quando muda quem canta na estrofe (sem repetir a cada linha).
function stanzaHTML(s, flow) {
  const pick = flow.opts.singer;
  let lines = stanzaLines(s, flow);
  if (pick) lines = lines.filter(l => l.who && l.who.split("/").includes(pick));
  if (!lines.length) return "";
  if (!flow.sung) return `<p>${lines.map(l => text(l.text)).join("<br>")}</p>`;
  return `<p class="sung">${lines.map((l, i) =>
    `${singerHTML((pick ? i === 0 || l.who !== lines[i - 1].who : l.mark) ? l.who : null)}<span>${text(l.text)}</span>`).join("")}</p>`;
}

const lyricsHTML = (stanzas, flow) => (stanzas || []).map(s => stanzaHTML(s, flow)).join("");

// Vocalistas da música, na ordem em que aparecem.
const singersOf = song => [...new Set(song.structure
  .flatMap(b => b.parts ? Array.from({ length: b.repeat }, (_, k) => b.parts.map(p => (p.lyrics || [])[k])) : [b.lyrics])
  .flat(2)
  .filter(Boolean)
  .flatMap(splitLines)
  .map(l => (l.match(SINGER) || [])[1])
  .filter(Boolean)
  .flatMap(n => n.split("/")))];

/* ---------- Estrutura ---------- */

// Tudo aparece na ordem em que a música acontece.
// O selo de bpm só aparece onde o andamento muda de fato em relação ao que vinha tocando.
// "Apenas letra" esconde a parte que fica sem letra (depois do filtro de vocalista).
// O selo de bpm compara com a última parte que apareceu na tela.
// Parte escondida continua na página (invisível) porque o modo Tocar conta o tempo dela.
// Duração em segundos, tudo em 4/4: compassos × 4 tempos × 60 / bpm.
function partHTML(song, part, pass, flow) {
  const color = song.colors[part.color || part.name] || "#999";
  const lyrics = lyricsHTML(pass == null ? part.lyrics : (part.lyrics || [])[pass], flow);
  if (part.bpm) flow.bpm = part.bpm;
  const sec = (parseFloat(part.bars) || 0) * 240 / (flow.bpm || 120);
  const off = flow.opts.lyricsOnly && !lyrics;
  const changes = !off && flow.bpm && flow.bpm !== flow.shownBpm;
  if (!off) flow.shownBpm = flow.bpm;
  return `<div class="part${off ? " off" : ""}" data-sec="${sec}" style="--c:${color}">
    <div class="part-top">
      <span class="part-name">${esc(part.name)}${part.detail ? ` <small>${esc(part.detail)}</small>` : ""}</span>
      ${changes ? `<span class="bpm">${flow.bpm} bpm</span>` : ""}
      <span class="bars"><b>${part.bars}</b>${part.bars === 1 ? "compasso" : "compassos"}</span>
    </div>
    ${lyrics ? `<div class="lyrics">${lyrics}</div>` : ""}
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

/* ---------- Modos de leitura ---------- */

// "Apenas letra" e "quem canta" valem pra todas as músicas e ficam guardados no aparelho.
// Vocalista escolhido que não canta na música aberta não filtra nada nela.
let opts = { lyricsOnly: false, singer: null };
try { opts = { ...opts, ...JSON.parse(localStorage.getItem("cr-modes") || "{}") }; } catch (e) { /* sem storage, segue */ }
const saveOpts = () => { try { localStorage.setItem("cr-modes", JSON.stringify(opts)); } catch (e) { /* idem */ } };

function chipHTML(name, on) {
  const i = singerInfo(name);
  const face = i.photo
    ? `<img src="${esc(i.photo)}" alt="${esc(name)}">`
    : `<span${i.color ? ` style="color:${i.color}"` : ""}>${esc(name)}</span>`;
  return `<button class="chip${i.photo ? " pic" : ""}" data-singer="${esc(name)}" aria-pressed="${on}" title="${esc(name)}">${face}</button>`;
}

function modesHTML(singers, pick) {
  return `<div class="modes">
    <button class="chip play" data-mode="play">▶ Tocar</button>
    <button class="chip" data-mode="lyrics" aria-pressed="${opts.lyricsOnly}">Apenas letra</button>
    ${singers.length > 1 ? `<span class="modes-who">
      <button class="chip" data-singer="" aria-pressed="${!pick}">Todos</button>
      ${singers.map(n => chipHTML(n, n === pick)).join("")}
    </span>` : ""}
  </div>`;
}

let current;

function renderSong(song) {
  stopPlay();
  current = song;
  const singers = singersOf(song);
  const pick = singers.includes(opts.singer) ? opts.singer : null;
  const flow = { bpm: null, shownBpm: null, who: null, sung: singers.length > 0, opts: { lyricsOnly: opts.lyricsOnly, singer: pick } };
  const blocks = song.structure.map(block =>
    (block.repeat ? repeatHTML(song, block, flow) : partHTML(song, block, null, flow))).join("");

  $("#song").innerHTML = `
    <section class="head">
      <h1>${esc(song.title)}</h1>
      <p class="artist">${esc(song.artist)}</p>
      ${infoHTML(song.id)}
    </section>
    ${modesHTML(singers, pick)}
    <section class="structure">${blocks}</section>`;
  document.title = `${song.title} · Covenant Rites`;
}

/* ---------- Modo Tocar ---------- */

// Só o mapa, na largura toda da tela; a parte que está tocando fica acesa, colada no topo,
// e a página rola no tempo dos bpms. Parte mais alta que a tela vai subindo devagar enquanto dura.
// A banda não toca cravado no metrônomo: tocar numa parte faz a contagem seguir dali.
const TOP = 8;
let player = null;

const elapsed = () => player.pos + (player.running ? (performance.now() - player.since) / 1000 : 0);

function timeline() {
  let t = 0;
  return [...document.querySelectorAll(".structure .part")].map(el => {
    const start = t;
    t += +el.dataset.sec || 0;
    return { el, start, end: t };
  });
}

function setPos(sec) {
  player.pos = Math.max(0, sec);
  player.since = performance.now();
}

function tick() {
  if (!player) return;
  const parts = player.parts;
  const total = parts.length ? parts[parts.length - 1].end : 0;
  if (player.running && elapsed() >= total) { setPos(total); player.running = false; playerBar(); }
  const t = elapsed();
  let i = parts.findIndex(p => t < p.end);
  if (i < 0) i = parts.length - 1;
  // Parte escondida ("Apenas letra"): a próxima parte visível fica esperando na linha.
  let k = i;
  while (k < parts.length && parts[k].el.classList.contains("off")) k++;
  const cur = parts[k] || parts[i];
  const p = k === i ? Math.min(1, (t - cur.start) / (cur.end - cur.start || 1)) : 0;
  if (player.el !== cur.el) {
    if (player.el) player.el.classList.remove("now");
    cur.el.classList.add("now");
    player.el = cur.el;
  }
  // Se a pessoa rolou a tela com o dedo, deixa ela olhar por uns segundos antes de voltar a seguir.
  // A rolagem corre atrás do alvo com suavidade, então a troca de parte não dá tranco.
  const now = performance.now();
  if (now - player.touched > 2500) {
    const top = cur.el.getBoundingClientRect().top + scrollY - TOP;
    const target = top + p * Math.max(0, cur.el.offsetHeight - innerHeight * 0.6);
    const step = Math.min(1, (now - (player.last || now)) / 120);
    const y = Math.abs(target - scrollY) < 1 ? target : scrollY + (target - scrollY) * step;
    scrollTo(0, y);
  }
  player.last = now;
  player.raf = requestAnimationFrame(tick);
}

function playerBar() {
  let bar = $("#player");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "player";
    bar.className = "player-bar";
    document.body.append(bar);
    bar.addEventListener("click", e => {
      const btn = e.target.closest("button");
      if (!btn || !player) return;
      if (btn.dataset.act === "exit") return stopPlay();
      if (btn.dataset.act === "restart") { setPos(0); player.touched = 0; }
      if (btn.dataset.act === "toggle") togglePlay();
      playerBar();
    });
  }
  bar.innerHTML = player ? `
    <button data-act="restart" title="Voltar pro começo">⏮</button>
    <button data-act="toggle" class="main">${player.running ? "❚❚ Pausar" : "▶ Continuar"}</button>
    <button data-act="exit" title="Sair">✕</button>` : "";
}

function togglePlay() {
  setPos(elapsed());
  player.running = !player.running;
  if (player.running && elapsed() >= player.parts[player.parts.length - 1].end) setPos(0);
  playerBar();
}

async function startPlay() {
  document.body.classList.add("playing");
  player = { parts: timeline(), pos: 0, since: performance.now(), running: true, touched: 0, el: null };
  playerBar();
  tick();
  try { if (player) player.lock = await navigator.wakeLock.request("screen"); } catch (e) { /* sem wake lock, a tela pode apagar */ }
}

function stopPlay() {
  if (!player) return;
  cancelAnimationFrame(player.raf);
  if (player.el) player.el.classList.remove("now");
  if (player.lock) player.lock.release().catch(() => {});
  player = null;
  document.body.classList.remove("playing");
  playerBar();
}

/* ---------- Ordem do show ---------- */

// Tudo vira bloco, em sequência: o que vem antes de cada música ("before"), depois a música com as suas "notes".
// Bloco de "before" é texto (uma fala ou um momento) ou { title, artist, notes } (ex.: a faixa de intro).
// Em nota, "**trecho**" sai em negrito e "*trecho*" em itálico.
const noteText = s => esc(s).replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/\*([^*]+)\*/g, "<i>$1</i>");
const notesHTML = notes => (notes || []).length ? `<ul class="cue-notes">${notes.map(n => `<li>${noteText(n)}</li>`).join("")}</ul>` : "";

const cueHTML = c => typeof c === "string"
  ? `<div class="cue"><p>${noteText(c)}</p></div>`
  : `<div class="cue"><p><b>${esc(c.title)}</b>${c.artist ? ` <small>${esc(c.artist)}</small>` : ""}</p>${notesHTML(c.notes)}</div>`;

function renderShow() {
  const steps = setlist.songs.map((s, i) => `
    ${(s.before || []).map(cueHTML).join("")}
    <div class="show-song${s.ready ? " ready" : ""}" data-id="${esc(s.id)}">
      <p><span class="n">${i + 1}</span> <b>${esc(s.title)}</b> <small>${esc(s.artist)}</small></p>
      ${notesHTML(s.notes)}
    </div>`).join("");
  $("#show").innerHTML = `
    <summary>ORDEM DO SHOW</summary>
    <div class="show-body">${notesHTML(setlist.opening)}${steps}</div>`;
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

  // Bloco de música é div (não botão) pra dar pra selecionar o texto; clique que só selecionou texto não troca de música.
  $("#show").addEventListener("click", e => {
    const btn = e.target.closest(".show-song.ready");
    if (!btn || String(getSelection())) return;
    show(btn.dataset.id);
    $("#setlist").scrollIntoView({ behavior: "smooth" });
  });

  $("#song").addEventListener("click", e => {
    // Tocando: tocar numa parte faz a contagem seguir a partir dela.
    const part = player && e.target.closest(".part");
    if (part) {
      const p = player.parts.find(x => x.el === part);
      if (p) { setPos(p.start); player.touched = 0; }
      return;
    }
    const btn = e.target.closest(".modes button");
    if (!btn || !current) return;
    if (btn.dataset.mode === "play") return startPlay();
    if (btn.dataset.mode === "lyrics") opts.lyricsOnly = !opts.lyricsOnly;
    else opts.singer = btn.dataset.singer || null;
    saveOpts();
    renderSong(current);
  });

  $("#setlist").addEventListener("click", e => {
    const btn = e.target.closest("button");
    if (!btn) return;
    show(btn.dataset.id);
    scrollTo({ top: 0 });
  });

  for (const ev of ["wheel", "touchmove"]) addEventListener(ev, () => { if (player) player.touched = performance.now(); }, { passive: true });
  addEventListener("keydown", e => {
    if (!player) return;
    if (e.key === " ") { e.preventDefault(); togglePlay(); }
    if (e.key === "Escape") stopPlay();
  });

  const wanted = location.hash.slice(1) || new URLSearchParams(location.search).get("song");
  const ready = setlist.songs.filter(s => s.ready);
  const first = ready.some(s => s.id === wanted) ? wanted : ready[0].id;
  show(first);
}

init().catch(err => {
  $("#song").innerHTML = `<p class="error">Não deu pra carregar o setlist (${esc(err.message)}). Se abriu o arquivo direto do disco, precisa de um servidor local ou do GitHub Pages.</p>`;
});
