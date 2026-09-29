const $ = (sel, el = document) => el.querySelector(sel);

const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const NOTE_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const BEAM_LEVEL = { Eighth: 1, "16th": 2, "32nd": 3, "64th": 4 };
const DRUM_ROWS = [
  { key: "cy", label: "Pr", test: /crash|ride|china|splash|cymbal|bell|cowbell/i },
  { key: "hh", label: "HH", test: /hi-hat/i },
  { key: "sn", label: "Cx", test: /snare/i },
  { key: "tt", label: "Tom", test: /tom/i },
  { key: "bd", label: "Bb", test: /kick/i },
];

const state = { track: 0 };
let model;

function loadPref() {
  try {
    const t = localStorage.getItem("cr.track");
    if (t !== null) state.track = Number(t);
  } catch (e) { /* sem storage, segue o padrão */ }
}

function savePref() {
  try { localStorage.setItem("cr.track", String(state.track)); } catch (e) { /* idem */ }
}

async function getJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Falha ao carregar ${path}`);
  return res.json();
}

const barTicks = time => {
  const [num, den] = time.split("/").map(Number);
  return num * 3840 / den;
};

function buildModel(song, score) {
  const tempoAt = [];
  let tempo = null;
  score.bars.forEach((b, i) => {
    if (b.tempo) tempo = b.tempo;
    tempoAt[i] = tempo;
  });

  const sections = [];
  score.bars.forEach((b, i) => {
    if (b.section != null || i === 0) sections.push({ raw: b.section || "Início", start: i });
  });
  sections.forEach((s, k) => {
    s.n = k + 1;
    s.end = (k + 1 < sections.length ? sections[k + 1].start : score.bars.length) - 1;
    s.len = s.end - s.start + 1;
    s.label = (song.sectionNames || {})[s.raw] || s.raw;
    s.color = (song.colors || {})[s.raw] || "#999";
    s.tempo = tempoAt[s.start];
    s.tempoChange = k === 0 || tempoAt[s.start] !== tempoAt[s.start - 1];
    s.lyrics = (song.lyrics || {})[s.n] || [];
    s.note = (song.notes || {})[s.n];
  });

  const barKeys = score.tracks.map(t => t.bars.map(b => JSON.stringify(b)));
  const tempos = tempoAt.filter(Boolean);
  return { song, score, sections, tempoAt, barKeys, minTempo: Math.min(...tempos), maxTempo: Math.max(...tempos) };
}

// Primeira seção anterior com o mesmo nome e exatamente as mesmas notas nessa trilha.
function sameAs(s, track) {
  const keys = model.barKeys[track];
  return model.sections.find(p => p.n < s.n && p.raw === s.raw && p.len === s.len &&
    keys.slice(p.start, p.end + 1).every((k, i) => k === keys[s.start + i]));
}

function isSilent(s, track) {
  return model.score.tracks[track].bars.slice(s.start, s.end + 1).every(bar => bar.every(b => !b.n));
}

const range = s => (s.len === 1 ? `${s.start + 1}` : `${s.start + 1}–${s.end + 1}`);

/* ---------- Cabeçalho, mapa, faixa ---------- */

function renderHead() {
  const { song, score } = model;
  const bpm = model.minTempo === model.maxTempo ? `${model.minTempo}` : `${model.minTempo}–${model.maxTempo}`;
  const lineup = (song.lineup || []).map(p => `${esc(p.name)} <small>(${esc(p.role)})</small>`).join(" · ");
  $("#song-head").innerHTML = `
    <h1>${esc(score.title)}</h1>
    <p class="by">${esc(score.artist)} · ${esc(score.album || "")}</p>
    <ul class="facts">
      <li><span class="k">Tom</span><span class="v">${esc(song.key)} <small>${esc(song.keyNote || "")}</small></span></li>
      <li><span class="k">Andamento</span><span class="v">${bpm} bpm</span></li>
      <li><span class="k">Compassos</span><span class="v">${score.bars.length} <small>· ${model.sections.length} seções</small></span></li>
      <li><span class="k">Referência</span><span class="v">${esc(song.reference || "")}</span></li>
      <li><span class="k">Formação</span><span class="v">${lineup}</span></li>
    </ul>
    ${song.tuningNote ? `<p class="note" style="margin-top:12px">${esc(song.tuningNote)}</p>` : ""}`;
}

function mapRow(s) {
  return `<a class="row" href="#s${s.n}" data-n="${s.n}" style="--c:${s.color}">
    <span class="num">${s.n}</span>
    <span class="name">${esc(s.label)}</span>
    <span class="len">${s.len}</span>
    <span class="meta">${s.tempoChange ? `<b>${s.tempo} bpm</b>` : ""}${range(s)}</span>
  </a>`;
}

function renderMap() {
  const { sections, song } = model;
  const groups = song.groups || [];
  let html = "";
  let i = 0;
  while (i < sections.length) {
    const g = groups.find(g => g.from === sections[i].n);
    if (!g) { html += mapRow(sections[i]); i++; continue; }
    html += `<div class="grp"><span class="times">×${g.times}</span>`;
    for (let u = g.from; u <= g.to; u += g.unit) {
      html += `<div class="unit">`;
      for (let n = u; n < u + g.unit && n <= g.to; n++) html += mapRow(sections[n - 1]);
      html += `</div>`;
    }
    html += `</div>`;
    i = g.to;
  }
  $("#map").innerHTML = html;
}

function renderStrip() {
  $("#strip").innerHTML = model.sections.map(s =>
    `<a href="#s${s.n}" data-n="${s.n}" style="--c:${s.color};--w:${s.len}" title="#${s.n} ${esc(s.label)} · ${s.len} comp."></a>`
  ).join("");
}

function renderTrackSelect() {
  const labels = model.song.tracks || model.score.tracks.map(t => t.name);
  const opts = labels.map((l, i) => [i, l]).concat([[-1, "Só letra"]]);
  if (state.track >= labels.length) state.track = 0;
  $("#track-select").innerHTML = opts.map(([i, l]) =>
    `<button role="tab" data-t="${i}" aria-selected="${i === state.track}">${esc(l)}</button>`
  ).join("");
}

/* ---------- Tab em SVG ---------- */

function drumRow(track, art) {
  const name = track.articulations[art] || "";
  const idx = DRUM_ROWS.findIndex(r => r.test.test(name));
  return idx === -1 ? 0 : idx;
}

function renderBarBeats(track, bi, x0, barW, ys, drums) {
  const bar = track.bars[bi];
  const total = barTicks(model.score.bars[bi].time);
  const left = x0 + 13;
  const right = x0 + barW - 14;
  const lastY = ys[ys.length - 1];
  const stemTop = lastY + 8;
  const stemBot = stemTop + 17;
  let svg = "";
  const items = [];
  let tick = 0;

  for (const beat of bar) {
    const x = left + (tick / total) * (right - left);
    const rest = !beat.n;
    items.push({ x, tick, beat, rest });
    if (!rest) {
      const anns = [];
      for (const n of beat.n) {
        if (drums) {
          const r = drumRow(track, n.a);
          const y = ys[r];
          if (r <= 1) {
            svg += `<path class="cym" d="M${x - 3.2} ${y - 3.2}L${x + 3.2} ${y + 3.2}M${x - 3.2} ${y + 3.2}L${x + 3.2} ${y - 3.2}"/>`;
          } else {
            svg += `<circle class="hit" cx="${x}" cy="${y}" r="3.6"/>`;
          }
          continue;
        }
        const y = ys[ys.length - 1 - n.s];
        let label = n.x ? "x" : String(n.f);
        if (n.tie) label = `(${label})`;
        if (n.slide) label += "/";
        svg += `<text class="fret${n.tie ? " tie" : ""}" x="${x}" y="${y}">${label}</text>`;
        if (n.pm && !anns.includes("PM")) anns.push("PM");
        if (n.acc && !anns.includes(">")) anns.push(">");
        if (n.hopo && !anns.includes("H")) anns.push("H");
      }
      if (anns.length) svg += `<text class="ann" x="${x - 5}" y="${ys[0] - 8}">${anns.join(" ")}</text>`;
    }
    tick += beat.d;
  }

  // Hastes, colchetes e pontos de aumento
  for (const it of items) {
    if (it.rest || it.beat.v === "Whole") continue;
    const bottom = it.beat.v === "Half" ? stemTop + 8 : stemBot;
    svg += `<line class="stem" x1="${it.x}" y1="${stemTop}" x2="${it.x}" y2="${bottom}"/>`;
    if (it.beat.dots) svg += `<circle class="dot" cx="${it.x + 4}" cy="${stemTop + 9}" r="1.4"/>`;
  }

  // Agrupa colcheias e semicolcheias por tempo (semínima) pra desenhar as barras
  const groups = [];
  let cur = [];
  for (const it of items) {
    const level = BEAM_LEVEL[it.beat.v] || 0;
    const beatNo = Math.floor(it.tick / 960);
    const prev = cur[cur.length - 1];
    if (!it.rest && level && prev && Math.floor(prev.tick / 960) === beatNo) {
      cur.push(it);
    } else {
      if (cur.length) groups.push(cur);
      cur = !it.rest && level ? [it] : [];
    }
  }
  if (cur.length) groups.push(cur);

  for (const g of groups) {
    const lv = it => BEAM_LEVEL[it.beat.v];
    if (g.length === 1) {
      for (let l = 0; l < lv(g[0]); l++) {
        const y = stemBot - l * 4.5;
        svg += `<line class="stem" x1="${g[0].x}" y1="${y}" x2="${g[0].x + 6}" y2="${y - 5}"/>`;
      }
      continue;
    }
    svg += `<line class="beam" x1="${g[0].x}" y1="${stemBot}" x2="${g[g.length - 1].x}" y2="${stemBot}"/>`;
    for (let l = 1; l < 4; l++) {
      const y = stemBot - l * 4.5;
      g.forEach((it, k) => {
        if (lv(it) <= l) return;
        const next = g[k + 1];
        const prev = g[k - 1];
        if (next && lv(next) > l) {
          svg += `<line class="beam" x1="${it.x}" y1="${y}" x2="${next.x}" y2="${y}"/>`;
        } else if (!(prev && lv(prev) > l)) {
          const dx = next ? 6 : -6;
          svg += `<line class="beam" x1="${it.x}" y1="${y}" x2="${it.x + dx}" y2="${y}"/>`;
        }
      });
    }
  }

  // Quiálteras: número centralizado em cada bloco
  let chunk = [];
  for (const it of items) {
    const t = it.beat.tuplet;
    if (!t) { chunk = []; continue; }
    chunk.push(it);
    if (chunk.length === t[0]) {
      const cx = (chunk[0].x + chunk[chunk.length - 1].x) / 2;
      svg += `<text class="tuplet" x="${cx}" y="${stemBot + 11}">${t[0]}</text>`;
      chunk = [];
    }
  }
  return svg;
}

function renderTab(trackIdx, start, end, width) {
  const track = model.score.tracks[trackIdx];
  const drums = track.kind === "drums";
  const lines = drums ? DRUM_ROWS.length : track.tuning.length;
  const gutter = 22;
  // Largura mínima do compasso depende de quantas notas ele tem: riff de semínima cabe em pouco espaço.
  let densest = 1;
  for (let b = start; b <= end; b++) densest = Math.max(densest, track.bars[b].length);
  const minBar = Math.max(140, densest * 19 + 30);
  const perRow = Math.max(1, Math.min(4, Math.floor((width - gutter) / minBar)));
  const barW = (width - gutter) / perRow;
  const gap = drums ? 10 : 12;
  const top = 30;
  const ys = Array.from({ length: lines }, (_, i) => top + i * gap);
  const height = ys[lines - 1] + 44;
  const names = drums ? DRUM_ROWS.map(r => r.label) : track.tuning.slice().reverse().map(p => NOTE_NAMES[p % 12]);
  let out = "";

  for (let b = start; b <= end; b += perRow) {
    const barIdx = [];
    for (let k = b; k <= Math.min(end, b + perRow - 1); k++) barIdx.push(k);
    const rowW = gutter + barIdx.length * barW;
    let svg = "";
    ys.forEach((y, i) => {
      svg += `<line class="str" x1="${gutter}" y1="${y}" x2="${rowW}" y2="${y}"/>`;
      svg += `<text class="drumlbl" x="${gutter - 5}" y="${y}">${names[i]}</text>`;
    });
    barIdx.forEach((bi, j) => {
      const x0 = gutter + j * barW;
      const bar = model.score.bars[bi];
      svg += `<line class="barline" x1="${x0}" y1="${ys[0]}" x2="${x0}" y2="${ys[lines - 1]}"/>`;
      svg += `<text class="barnum" x="${x0 + 2}" y="${ys[0] - 18}">${bi + 1}</text>`;
      if (bar.tempo && (bi === 0 || model.tempoAt[bi - 1] !== bar.tempo)) {
        svg += `<text class="tempo" x="${x0 + 22}" y="${ys[0] - 18}">♩ = ${bar.tempo}</text>`;
      }
      svg += renderBarBeats(track, bi, x0, barW, ys, drums);
    });
    svg += `<line class="barline" x1="${rowW}" y1="${ys[0]}" x2="${rowW}" y2="${ys[lines - 1]}"/>`;
    out += `<svg class="tab" viewBox="0 0 ${width} ${height}" role="img" aria-label="Compassos ${barIdx[0] + 1} a ${barIdx[barIdx.length - 1] + 1}">${svg}</svg>`;
  }
  return out;
}

/* ---------- Seções ---------- */

function lyricsHTML(lines) {
  if (!lines.length) return "";
  return `<div class="lyrics">${lines.map(l =>
    `<p>${esc(l).replace(" — ", ' <span class="dash">—</span> ')}</p>`).join("")}</div>`;
}

function renderSections() {
  const container = $("#sections");
  const lyricsMode = state.track === -1;
  document.body.classList.toggle("mode-lyrics", lyricsMode);
  const width = Math.max(260, container.clientWidth - 40);

  container.innerHTML = model.sections.map(s => {
    let body = lyricsHTML(s.lyrics);
    if (!lyricsMode) {
      if (s.note) body += `<p class="note">${esc(s.note)}</p>`;
      if (isSilent(s, state.track)) {
        if (!s.note)
        body += `<p class="empty-msg">Pausa: ${s.len} ${s.len === 1 ? "compasso" : "compassos"} sem tocar.</p>`;
      } else {
        const twin = sameAs(s, state.track);
        const tab = renderTab(state.track, s.start, s.end, width);
        body += twin
          ? `<details class="same"><summary>Mesma tab do <a href="#s${twin.n}">#${twin.n} ${esc(twin.label)}</a>. Mostrar</summary>${tab}</details>`
          : tab;
      }
    }
    return `<article class="section${s.lyrics.length ? "" : " empty"}" id="s${s.n}" data-n="${s.n}" style="--c:${s.color}">
      <header class="sec-head">
        <span class="num">#${s.n}</span>
        <h3>${esc(s.label)}</h3>
        <span class="info">${s.len} ${s.len === 1 ? "compasso" : "compassos"} · c. ${range(s)}</span>
        <span class="bpm${s.tempoChange && s.n > 1 ? " change" : ""}">${s.tempo} bpm</span>
      </header>
      <div class="sec-body">${body}</div>
    </article>`;
  }).join("") + `<p class="foot">Tab: ${esc(model.score.tabber || "")} (Guitar Pro). Letra e estrutura: Covenant Rites.</p>`;
  updateActive();
}

/* ---------- Seção ativa ---------- */

let activeN = 0;
function updateActive() {
  const probe = 130;
  let n = 1;
  for (const el of document.querySelectorAll(".section")) {
    if (el.getBoundingClientRect().top <= probe) n = Number(el.dataset.n);
    else break;
  }
  if (n === activeN) return;
  activeN = n;
  document.querySelectorAll("[data-n].active").forEach(el => el.classList.remove("active"));
  document.querySelectorAll(`.row[data-n="${n}"], .strip a[data-n="${n}"]`).forEach(el => el.classList.add("active"));
  // Rola só o painel do mapa (scrollIntoView aqui cancelaria a rolagem suave da página)
  const row = $(`.row[data-n="${n}"]`);
  const wrap = $(".map-wrap");
  if (row && row.offsetParent) {
    const r = row.getBoundingClientRect();
    const w = wrap.getBoundingClientRect();
    if (r.top < w.top + 30) wrap.scrollTop -= w.top + 30 - r.top;
    else if (r.bottom > w.bottom - 10) wrap.scrollTop += r.bottom - w.bottom + 10;
  }
}

/* ---------- Início ---------- */

async function init() {
  loadPref();
  const setlist = await getJSON("data/setlist.json");
  $("#event").textContent = `Rito ${setlist.event}`;
  const id = new URLSearchParams(location.search).get("song") || setlist.songs[0].id;

  const select = $("#song-select");
  select.innerHTML = setlist.songs.map(s =>
    `<option value="${esc(s.id)}"${s.id === id ? " selected" : ""}>${esc(s.artist)} · ${esc(s.title)}</option>`).join("");
  select.addEventListener("change", () => { location.search = `?song=${encodeURIComponent(select.value)}`; });

  const [song, score] = await Promise.all([getJSON(`data/songs/${id}.json`), getJSON(`data/scores/${id}.json`)]);
  model = buildModel(song, score);
  document.title = `${score.title} · Covenant Rites`;

  renderHead();
  renderMap();
  renderStrip();
  renderTrackSelect();
  renderSections();
  if (location.hash) document.querySelector(location.hash)?.scrollIntoView({ block: "start", behavior: "instant" });

  $("#track-select").addEventListener("click", e => {
    const btn = e.target.closest("button");
    if (!btn) return;
    state.track = Number(btn.dataset.t);
    savePref();
    renderTrackSelect();
    const keep = activeN;
    renderSections();
    if (keep > 1) $(`#s${keep}`).scrollIntoView({ block: "start" });
  });

  let ticking = false;
  addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { updateActive(); ticking = false; });
  }, { passive: true });

  let lastW = $("#sections").clientWidth;
  let timer;
  addEventListener("resize", () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const w = $("#sections").clientWidth;
      if (w !== lastW) { lastW = w; renderSections(); }
    }, 150);
  });
}

init().catch(err => {
  $("#sections").innerHTML = `<p class="empty-msg">Não deu pra carregar os dados (${esc(err.message)}). Se abriu o arquivo direto do disco, precisa de um servidor local ou do GitHub Pages.</p>`;
});
