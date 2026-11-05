/* Semantic distance tests project page: validity/specificity explorer, results carousel, BibTeX copy.
 * Data (DATA) comes from data.js. */

const $ = (sel, root = document) => root.querySelector(sel);

// ------------------------------------------------------------------ explorer

let metric = "v"; // "v" = validity, "s" = specificity

const stars = (p) => (p < 0.001 ? "***" : p < 0.01 ? "**" : p < 0.05 ? "*" : "");
const fmt = (r) => (r >= 0 ? "+" : "−") + Math.abs(r).toFixed(2).replace(/^0/, "");

// Diverging fill: blue for positive r, red for negative, white at 0 (RdBu-like, light enough for black text).
function fill(r) {
  const a = Math.min(Math.abs(r), 1);
  const [R, G, B] = r >= 0 ? [33, 102, 172] : [178, 24, 43];
  const mix = (c) => Math.round(255 - (255 - c) * a * 0.55);
  return `rgb(${mix(R)},${mix(G)},${mix(B)})`;
}

function renderExplorer() {
  const benches = DATA.constructs.flatMap((c) => c.benchmarks);
  const head = $("#vs-table thead");
  head.innerHTML =
    `<tr class="constructs"><th></th>${DATA.constructs
      .map((c) => `<th colspan="${c.benchmarks.length}">${c.name}</th>`).join("")}</tr>` +
    `<tr><th>Test</th>${benches.map((b) => `<th>${b}</th>`).join("")}</tr>`;

  $("#vs-table tbody").innerHTML = DATA.tests.map((t) => {
    const cells = benches.map((b) => {
      const c = (DATA.cells[t][b] || {})[metric];
      if (!c) return `<td class="cell na">&ndash;</td>`;
      const sig = c.p < 0.05;
      const tip = `${t} × ${b}: r = ${c.r.toFixed(3)}, p = ${c.p}, n = ${c.n}`;
      return `<td class="cell${sig ? " sig" : ""}" style="background:${fill(c.r)}" title="${tip}">` +
        `${fmt(c.r)}<sup>${stars(c.p)}</sup></td>`;
    }).join("");
    return `<tr><td class="test">${t}</td>${cells}</tr>`;
  }).join("");
}

function initExplorer() {
  document.querySelectorAll(".lb-controls [data-metric]").forEach((a) => {
    a.addEventListener("click", () => {
      metric = a.dataset.metric;
      document.querySelectorAll(".lb-controls li").forEach((li) => li.classList.remove("is-active"));
      a.parentElement.classList.add("is-active");
      renderExplorer();
    });
  });
  renderExplorer();
}

// ------------------------------------------------------------- per-model table

function orgMark(name) {
  const o = (typeof ORG_MARKS !== "undefined" && ORG_MARKS[name]) || null;
  if (!o) return "";
  const rule = o.evenodd ? ` fill-rule="evenodd" clip-rule="evenodd"` : "";
  return `<span class="mark" style="color:${o.color}" title="${name}">` +
    `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path${rule} d="${o.path}"/></svg></span>`;
}

let mSortCol = 1;      // 0 = model, 1.. = provider/test columns; default: DAT descending
let mSortAsc = false;

function renderModels() {
  const q = ($("#model-filter").value || "").trim().toLowerCase();
  const headers = ["Model", "Provider", ...MODEL_COLS];
  $("#model-table thead").innerHTML = `<tr>${headers.map((h, i) => {
    const key = i === 0 ? 0 : i === 1 ? -1 : i - 1;   // -1 = provider
    const cls = key === mSortCol ? `sorted${mSortAsc ? " asc" : ""}` : "";
    return `<th class="${cls}" data-k="${key}">${h}</th>`;
  }).join("")}</tr>`;

  const getKey = (r) => (mSortCol === 0 ? r.model : mSortCol === -1 ? r.provider
    : (r.vals[mSortCol - 1] ? r.vals[mSortCol - 1][0] : null));
  const rows = MODEL_ROWS
    .filter((r) => !q || r.model.toLowerCase().includes(q) || r.provider.toLowerCase().includes(q))
    .slice()
    .sort((a, b) => {
      const x = getKey(a), y = getKey(b);
      if (x === null && y === null) return 0;
      if (x === null) return 1;            // missing values always last
      if (y === null) return -1;
      const c = typeof x === "string" ? x.localeCompare(y) : x - y;
      return mSortAsc ? c : -c;
    });

  const digits = [2, 2, 2, 2, 3, 1];
  $("#model-table tbody").innerHTML = rows.map((r) => `<tr>
    <td class="model">${r.model}</td><td class="prov">${orgMark(r.provider)}${r.provider}</td>
    ${r.vals.map((v, j) => !v ? `<td class="num">&ndash;</td>`
      : `<td class="num">${v[0].toFixed(digits[j])}${v[1] !== null
          ? ` <span class="sem">&plusmn; ${v[1].toFixed(digits[j])}</span>` : ""}</td>`).join("")}
  </tr>`).join("");

  document.querySelectorAll("#model-table thead th").forEach((th) => {
    th.addEventListener("click", () => {
      const k = Number(th.dataset.k);
      if (k === mSortCol) mSortAsc = !mSortAsc;
      else { mSortCol = k; mSortAsc = k <= 0; }   // text columns sort A-Z first, scores high-first
      renderModels();
    });
  });
}

function initModels() {
  $("#model-filter").addEventListener("input", renderModels);
  renderModels();
}

// --------------------------------------------------------------------- carousel

function initCarousel(root) {
  const track = $(".carousel-track", root);
  const items = track.children;
  const dots = $(".carousel-dots", root);
  let index = 0;

  dots.innerHTML = Array.from(items, (_, i) =>
    `<button role="tab" aria-label="Figure ${i + 1}" data-i="${i}"></button>`).join("");

  const go = (i) => {
    index = (i + items.length) % items.length;
    track.style.transform = `translateX(-${index * 100}%)`;
    dots.querySelectorAll("button").forEach((b, j) => b.setAttribute("aria-selected", j === index));
    Array.from(items).forEach((it, j) => it.setAttribute("aria-hidden", j !== index));
  };
  $(".carousel-prev", root).addEventListener("click", () => go(index - 1));
  $(".carousel-next", root).addEventListener("click", () => go(index + 1));
  dots.addEventListener("click", (e) => { if (e.target.dataset.i) go(Number(e.target.dataset.i)); });
  root.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") go(index - 1);
    if (e.key === "ArrowRight") go(index + 1);
  });

  let x0 = null; // swipe on touch screens
  root.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  root.addEventListener("touchend", (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
    x0 = null;
  });
  go(0);
}

// ----------------------------------------------------------------------- bibtex

function initCopy() {
  const btn = $("#copyBibtex");
  btn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText($("#bibtexCitation").innerText.trim());
      btn.textContent = "Copied";
    } catch {
      btn.textContent = "Select & copy";
    }
    setTimeout(() => { btn.textContent = "Copy"; }, 1600);
  });
}

initExplorer();
initModels();
initCarousel($("#results-carousel"));
initCopy();
