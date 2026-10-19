/* Kombine project page: sortable per-task leaderboard, results carousel, BibTeX copy.
 * Data (SCORES, ORGS) comes from data.js. */

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]
));

// ------------------------------------------------------------------ leaderboard

/* Columns per view. The first column is the view's ranking and also draws the bar. */
const INVENTION_COLS = (t) => [
  { key: `${t}.composite`, label: "Composite", get: (r) => r[t].composite },
  { key: `${t}.utility`, label: "Utility", get: (r) => r[t].utility },
  { key: `${t}.surprise`, label: "Surprise", get: (r) => r[t].surprise },
  { key: `${t}.orig_base`, label: "Orig. (base)", get: (r) => r[t].orig_base },
  { key: `${t}.orig_emrg`, label: "Orig. (invention)", get: (r) => r[t].orig_emrg },
  { key: `${t}.emrg_integ`, label: "Integration", get: (r) => r[t].emrg_integ },
  { key: `${t}.emrg_util`, label: "Inv. utility", get: (r) => r[t].emrg_util },
];

const VIEWS = {
  overall: [
    { key: "overall", label: "Overall", get: (r) => r.overall },
    { key: "association", label: "Association", get: (r) => r.association.composite },
    { key: "analogy", label: "Analogy", get: (r) => r.analogy.composite },
    { key: "blending", label: "Blending", get: (r) => r.blending.composite },
  ],
  association: [
    { key: "association.composite", label: "Composite", get: (r) => r.association.composite },
    { key: "association.utility", label: "Utility", get: (r) => r.association.utility },
    { key: "association.surprise", label: "Surprise", get: (r) => r.association.surprise },
    { key: "association.originality", label: "Originality", get: (r) => r.association.originality },
  ],
  analogy: INVENTION_COLS("analogy"),
  blending: INVENTION_COLS("blending"),
};

let view = "overall";
let sortKey = null;      // null = the view's ranking column
let sortAsc = false;

function orgMark(org) {
  const o = ORGS[org];
  if (!o) return `<span class="mark mark-initial" style="background:#8c8c8c">?</span>`;
  if (o.path) {
    return `<span class="mark" style="color:${o.color}" title="${esc(o.name)}">
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="${o.path}"/></svg></span>`;
  }
  const initial = org === "human" ? "H" : o.name[0].toUpperCase();
  return `<span class="mark mark-initial" style="background:${o.color}" title="${esc(o.name)}">${initial}</span>`;
}

function renderLeaderboard() {
  const cols = VIEWS[view];
  const head = cols[0];
  const ranked = SCORES.slice().sort((a, b) => head.get(b) - head.get(a));
  const rankOf = new Map(ranked.map((r, i) => [r.model, i + 1]));

  let rows = ranked;
  if (sortKey === "model") {
    rows = SCORES.slice().sort((a, b) => (sortAsc ? 1 : -1) * a.model.localeCompare(b.model));
  } else if (sortKey) {
    const col = cols.find((c) => c.key === sortKey);
    rows = SCORES.slice().sort((a, b) => (sortAsc ? 1 : -1) * (col.get(a) - col.get(b)));
  }
  const max = Math.max(...SCORES.map(head.get));

  $("#lb-table thead tr").innerHTML =
    `<th class="num" data-sort="rank">#</th><th data-sort="model">Model</th>` +
    cols.map((c) => `<th class="num" data-sort="${c.key}">${c.label}</th>`).join("");
  const th = $(`#lb-table th[data-sort="${sortKey || head.key}"]`);
  th.classList.add("sorted");
  if (sortAsc) th.classList.add("asc");

  $("#lb-table tbody").innerHTML = rows.map((r) => {
    const human = r.org === "human";
    const color = ORGS[r.org]?.color || "#8c8c8c";
    return `<tr class="${human ? "human" : ""}">
      <td class="num">${rankOf.get(r.model)}</td>
      <td><span class="src-cell">${orgMark(r.org)}<span class="src-text">${human ? "Humans" : esc(r.model)}<span
        class="org">${esc(ORGS[r.org]?.name || r.org)}</span></span></span></td>
      ${cols.map((c, i) => {
        const v = c.get(r);
        const bar = i === 0
          ? `<span class="bar" style="width:${Math.max(2, (v / max) * 100)}%;background:${color}"></span>` : "";
        return `<td class="num">${v.toFixed(1)}${bar}</td>`;
      }).join("")}
    </tr>`;
  }).join("");
}

function initLeaderboard() {
  document.querySelectorAll(".lb-controls a[data-view]").forEach((a) => {
    a.addEventListener("click", () => {
      view = a.dataset.view;
      sortKey = null; sortAsc = false;
      document.querySelectorAll(".lb-controls li").forEach((li) => li.classList.toggle("is-active", li.contains(a)));
      renderLeaderboard();
    });
  });
  $("#lb-table thead").addEventListener("click", (e) => {
    const th = e.target.closest("th");
    if (!th) return;
    const key = th.dataset.sort;
    if (key === "rank") { sortKey = null; sortAsc = false; }   // back to the view's ranking
    else if (sortKey === key) sortAsc = !sortAsc;
    else { sortKey = key; sortAsc = key === "model"; }
    renderLeaderboard();
  });
  renderLeaderboard();
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

  // Swipe on touch screens.
  let x0 = null;
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

initLeaderboard();
initCarousel($("#results-carousel"));
initCopy();
