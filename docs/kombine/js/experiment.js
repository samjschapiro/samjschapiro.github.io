/* ============================================================================
   Kombine — human GENERATION experiment (association / analogy / blending).
   Follows the llm_creativity_mech_interp template conventions (jsPsych 7.3.4,
   consent -> instructions -> trials -> completion, Prolific params + data POST).
   Unlike the AUT rating template, participants PRODUCE artifacts (structured
   generation), so trials are survey-html-form with custom builders, not sliders.
   ========================================================================== */

// --- deployment constants (fill in after deploying the backend + Prolific study) ---
const COMPLETION_URL = '';        // e.g. 'https://app.prolific.com/submissions/complete?cc=XXXXXXXX'
const DATA_SUBMISSION_URL = '';   // e.g. an API Gateway /submitData URL; '' => debug (show data, no POST)

let jsPsych;
let participantId, isProlificParticipant = false, isDebugMode = true, prolificCompletionURL = null;

function initializeParticipant() {
  const p = new URLSearchParams(window.location.search).get('PROLIFIC_PID');
  if (p) { isProlificParticipant = true; participantId = p; prolificCompletionURL = COMPLETION_URL; isDebugMode = false; }
  else { isDebugMode = true; participantId = `DEBUG_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`; }
}

/* ------------------------------------------------------------------ helpers */
function esc(s) { return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
// analogy cells are auto-growing textareas: size each to fit its wrapped content (call after any render).
function growAnalogyCells(root) {
  (root || document).querySelectorAll('.an-tri textarea').forEach(el => {
    el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px';
  });
}
// "I can't think of one" opt-out for a hard analogy cell (wired by wireAnalogy: disables + blanks the field).
function skipBox(name) { return `<label class="kb-skip"><input type="checkbox" name="skip_${name}"> I can't think of one</label>`; }

const EXAMPLES = {
  association: `<div style="max-width:520px;">
      <div class="kb-triple kb-thead"><span class="tnum"></span>
        <span class="thd">entity</span><span class="thd">relation</span><span class="thd">entity</span></div>
      <div class="kb-triple"><span class="tnum">1</span>
        <input type="text" value="rubber" readonly><input type="text" value="stores" readonly><input type="text" value="elastic energy" readonly></div>
      <div class="kb-triple"><span class="tnum">2</span>
        <input type="text" value="elastic energy" readonly><input type="text" value="drives" readonly><input type="text" value="a spring" readonly></div>
      <div class="kb-triple"><span class="tnum">3</span>
        <input type="text" value="a spring" readonly><input type="text" value="is inside" readonly><input type="text" value="a pogo stick" readonly></div>
    </div>`,
  analogy: `<div style="max-width:760px;">
      <div class="an-colhead"><span class="col"><span class="kb-chip a">a river</span></span><span class="col"><span class="kb-chip b">a highway</span></span></div>
      <div class="an-rowwrap"><div class="an-row">
        <div class="an-tri aside"><textarea rows="1" readonly>a river</textarea><textarea rows="1" readonly>carries</textarea><textarea rows="1" readonly>water</textarea></div>
        <div class="an-tri bside"><textarea rows="1" readonly>a highway</textarea><textarea rows="1" readonly>carries</textarea><textarea rows="1" readonly>cars</textarea></div>
      </div></div>
      <div class="an-rowwrap"><div class="an-row">
        <div class="an-tri aside"><textarea rows="1" readonly>a tributary</textarea><textarea rows="1" readonly>joins</textarea><textarea rows="1" readonly>a river</textarea></div>
        <div class="an-tri bside"><textarea rows="1" readonly>an on-ramp</textarea><textarea rows="1" readonly>joins</textarea><textarea rows="1" readonly>a highway</textarea></div>
      </div></div>
      <hr class="an-divider">
      <p class="kb-ask" style="margin:6px 0;">Then <b>invent</b>: take a fact true on one side and carry it across to coin a new concept on the other.</p>
      <div class="an-rowwrap"><div class="an-row">
        <div class="an-tri aside"><textarea rows="1" readonly>a floodplain</textarea><textarea rows="1" readonly>absorbs</textarea><textarea rows="1" readonly>overflow</textarea></div>
        <div class="an-tri bside"><textarea rows="1" readonly>a runoff lane</textarea><textarea rows="1" readonly>absorbs</textarea><textarea rows="1" readonly>overflow</textarea></div>
      </div></div>
    </div>`,
  blending: `<div style="max-width:820px;">
      <div class="kb-pair"><span class="kb-chip a">Democracy</span><span class="kb-tween">+</span><span class="kb-chip b">Banking</span></div>
      <div class="kb-field"><label>Blended concept</label><input type="text" value="Liquid Franchise" readonly></div>
      <div class="kb-field"><label>Generic space (shared schema)</label><input type="text" value="a system that allocates fungible units of power" readonly></div>
      <div class="an-colhead"><span class="col">true of an input</span><span class="bl-arrowhead"></span><span class="col">in the blend</span></div>
      <div class="an-rowwrap"><div class="an-row">
        <div class="an-tri aside"><textarea rows="1" readonly>Democracy</textarea><textarea rows="1" readonly>allocates</textarea><textarea rows="1" readonly>votes</textarea></div>
        <span class="bl-arrow">&rarr;</span>
        <div class="an-tri newc"><textarea rows="1" readonly>Liquid Franchise</textarea><textarea rows="1" readonly>allocates</textarea><textarea rows="1" readonly>vote-shares</textarea></div>
      </div><div class="bl-tagrow"><span class="bl-tag u">from Democracy [u]</span></div></div>
      <div class="an-rowwrap"><div class="an-row">
        <div class="an-tri bside"><textarea rows="1" readonly>credit</textarea><textarea rows="1" readonly>can be</textarea><textarea rows="1" readonly>traded</textarea></div>
        <span class="bl-arrow">&rarr;</span>
        <div class="an-tri newc"><textarea rows="1" readonly>vote-shares</textarea><textarea rows="1" readonly>can be</textarea><textarea rows="1" readonly>traded</textarea></div>
      </div><div class="bl-tagrow"><span class="bl-tag v">from Banking [v]</span></div></div>
      <hr class="an-divider">
      <p class="kb-ask" style="margin:6px 0;">Emergent &mdash; true of the blend, neither input alone:</p>
      <div class="an-rowwrap"><div class="an-row">
        <div class="an-tri emergent"><textarea rows="1" readonly>a citizen</textarea><textarea rows="1" readonly>can liquidate</textarea><textarea rows="1" readonly>their political personhood</textarea></div>
      </div></div>
    </div>`
};

const EYE = { association: 'assoc', analogy: 'analogy', blending: 'blend' };

function header(stim, index, total) {
  const pct = ((index + 1) / total) * 100;
  return `<div class="kb-progress">Item ${index + 1} of ${total}</div>
    <div style="height:3px;background:#e0dde6;border-radius:2px;margin:6px 0 18px;">
      <div style="width:${pct}%;height:100%;background:#007bff;border-radius:2px;"></div></div>`;
}

function exampleBlock(task) {
  return `<details class="kb-example"><summary>See a worked example</summary>
    <div class="body">${EXAMPLES[task]}</div></details>`;
}

/* ------------------------------------------------------------- trial builders */
function trialHTML(stim, index, total) {
  const t = stim.task;
  let body = `${header(stim, index, total)}<div class="kb-eyebrow ${EYE[t]}">${t}</div>`;
  if (t === 'association') {
    body += `<div class="kb-pair"><span class="kb-chip a">${esc(stim.u)}</span>
        <span class="kb-tween">to</span><span class="kb-chip b">${esc(stim.v)}</span></div>
      <p class="kb-ask">Build a path of <b>triples</b> (entity, relation, entity) from <b>${esc(stim.u)}</b> to <b>${esc(stim.v)}</b>: start at <b>${esc(stim.u)}</b>, each triple's second entity is the next triple's first entity, and the last triple ends at <b>${esc(stim.v)}</b>. Try to use surprising, original, and unusual relations and concepts in this chain, rather than generic ones that other participants would pick.</p>
      <div class="kb-path" id="pathHost"></div>
      <div class="kb-add"><button type="button" id="addStep">+ add a triple</button></div>`;
  } else if (t === 'analogy') {
    body += `<div class="kb-pair"><span class="kb-chip a">${esc(stim.u)}</span>
        <span class="kb-tween">::</span><span class="kb-chip b">${esc(stim.v)}</span></div>
      <p class="kb-ask">Build a path of <b>triples</b> in each domain &mdash; one about <b>${esc(stim.u)}</b> (left), one about <b>${esc(stim.v)}</b> (right) &mdash; sharing the <b>same relation</b> at each row, so the left triple maps to the right one. Then, below the line, <b>invent</b> a new triple carried across the mapping. Try to use surprising, original, and unusual relations and concepts, rather than generic ones that other participants would pick.</p>
      <div id="mapHost"></div>`;
  } else { // blending — fuse two entities into one new concept by projecting structure from each input
    body += `<div class="kb-pair"><span class="kb-chip a">${esc(stim.u)}</span>
        <span class="kb-tween">+</span><span class="kb-chip b">${esc(stim.v)}</span></div>
      <p class="kb-ask">Fuse <b>${esc(stim.u)}</b> and <b>${esc(stim.v)}</b> into a single <b>new concept</b> that projects structure from <b>both</b>. Name it and the shared schema; then, for each row, take a triple true of one input and carry it into the blend. Below the line, add structure that emerges only in the blend (true of <b>neither</b> input alone). Try to be surprising and original, not generic.</p>
      <div class="kb-field"><label>Name the blended concept</label>
        <input type="text" name="blend_name" required placeholder="a short name for the new fused concept"></div>
      <div class="kb-field"><label>Generic space — the shared schema <b>both</b> ${esc(stim.u)} and ${esc(stim.v)} fit</label>
        <input type="text" name="generic_space" required placeholder="e.g. a system that allocates fungible units of power"></div>
      <div id="blendHost"></div>`;
  }
  body += exampleBlock(t);
  const wrap = (t === 'analogy' || t === 'blending') ? 1040 : 660;   // projection rows need a wide canvas
  return `<div style="text-align:left; max-width:${wrap}px; margin:0 auto;">${body}</div>`;
}

// association path builder (dynamic add/remove), wired after the form loads
function wireAssociation(stim) {
  let rows = [{ head: stim.u, rel: '', tail: '' }];   // each row is one triple (head, relation, tail)
  const host = document.getElementById('pathHost');
  // Read current input values back into state before any re-render, so adding/removing a triple
  // never wipes text already typed.
  function sync() {
    rows.forEach((s, i) => {
      const hd = host.querySelector(`[name="tri_head_${i}"]`);
      const rl = host.querySelector(`[name="tri_rel_${i}"]`);
      const tl = host.querySelector(`[name="tri_tail_${i}"]`);
      if (hd) s.head = hd.value;
      if (rl) s.rel = rl.value;
      if (tl) s.tail = tl.value;
    });
  }
  function draw() {
    // persistent column labels so participants know which cell is entity / relation / entity even after
    // the placeholders disappear on typing.
    let h = `<div class="kb-triple kb-thead"><span class="tnum"></span>
        <span class="thd">entity</span><span class="thd">relation</span><span class="thd">entity</span>
        ${rows.length > 1 ? '<span class="thd-x"></span>' : ''}</div>`;
    rows.forEach((s, i) => {
      h += `<div class="kb-triple"><span class="tnum">${i + 1}</span>
        <input type="text" name="tri_head_${i}" required placeholder="entity" value="${esc(s.head || '')}">
        <input type="text" name="tri_rel_${i}" required placeholder="relation" value="${esc(s.rel || '')}">
        <input type="text" name="tri_tail_${i}" required placeholder="entity" value="${esc(s.tail || '')}">
        ${rows.length > 1 ? `<button type="button" class="kb-x" data-rm="${i}">&times;</button>` : ''}</div>`;
    });
    host.innerHTML = h;
    host.querySelectorAll('[data-rm]').forEach(b =>
      b.addEventListener('click', () => { sync(); rows.splice(+b.dataset.rm, 1); draw(); }));
  }
  draw();
  document.getElementById('addStep').addEventListener('click', () => {
    sync();
    rows.push({ head: rows.length ? rows[rows.length - 1].tail : stim.u, rel: '', tail: '' });  // new head = previous tail
    draw();
  });
}

// Analogy: each "I can't think of one" checkbox disables + blanks its field, so that hard cell is no
// longer required and the participant can still submit.
function wireAnalogy() {
  document.querySelectorAll('input[name^="skip_"]').forEach(cb => {
    const input = document.querySelector(`[name="${cb.name.slice(5)}"]`);
    if (!input) return;
    const apply = () => { input.disabled = cb.checked; if (cb.checked) input.value = ''; };
    cb.addEventListener('change', apply);
    apply();
  });
}

// Analogy: a FULL triple in each domain per row (u-triple left, v-triple right) sharing the same
// relation, then an invention triple (source -> image) below a divider -- the benchmark's structure.
function wireAnalogyPaths(stim) {
  const F = ['ah', 'ar', 'at', 'bh', 'br', 'bt'];
  let map = [{ ah: stim.u, ar: '', at: '', bh: stim.v, br: '', bt: '' }];   // mapping: u-triple | v-triple
  let inv = [{ ah: '', ar: '', at: '', bh: '', br: '', bt: '' }];           // invention: source triple | image triple
  let invSkip = false;
  const host = document.getElementById('mapHost');
  function syncArr(prefix, arr) {
    arr.forEach((s, i) => F.forEach(f => {
      const el = host.querySelector(`[name="${prefix}_${f}_${i}"]`);
      if (el) s[f] = el.value;
    }));
  }
  function sync() {
    syncArr('map', map); syncArr('inv', inv);
    map.forEach((s, i) => { const cb = host.querySelector(`[name="skip_map_${i}"]`); if (cb) s.skip = cb.checked; });
    const sk = host.querySelector('[name="skip_invention"]');
    if (sk) invSkip = sk.checked;
  }
  function tri(prefix, i, s, side, disabled) {
    const k = side === 'a' ? ['ah', 'ar', 'at'] : ['bh', 'br', 'bt'];
    const attr = disabled ? ' disabled' : ' required';
    const cell = (kk, ph) => `<textarea rows="1" name="${prefix}_${kk}_${i}"${attr} placeholder="${ph}">${esc(s[kk])}</textarea>`;
    return `<div class="an-tri ${side === 'a' ? 'aside' : 'bside'}">${cell(k[0], 'entity')}${cell(k[1], 'relation')}${cell(k[2], 'entity')}</div>`;
  }
  function row(prefix, i, s, arr, disabled) {
    const rm = arr.length > 1 ? `<button type="button" class="kb-x an-rmbtn" data-rm="${prefix}:${i}">&times;</button>` : '<span class="an-rmbtn"></span>';
    // map rows get a per-step "don't know" opt-out (this task is hard); the invention has its own skip below.
    const dk = prefix === 'map'
      ? `<label class="kb-skip an-dk"><input type="checkbox" name="skip_map_${i}"${disabled ? ' checked' : ''}> I can&rsquo;t think of an analogy</label>` : '';
    return `<div class="an-rowwrap"><div class="an-row">${tri(prefix, i, s, 'a', disabled)}${tri(prefix, i, s, 'b', disabled)}
      ${rm}</div>${dk}</div>`;
  }
  function draw() {
    let h = `<div class="an-colhead"><span class="col"><span class="kb-chip a">${esc(stim.u)}</span></span>
      <span class="col"><span class="kb-chip b">${esc(stim.v)}</span></span><span class="an-rmbtn"></span></div>`;
    // persistent entity / relation / entity labels over each side's triple cells
    h += `<div class="an-row an-subhead"><div class="an-tri anlbl"><span>entity</span><span>relation</span><span>entity</span></div>` +
         `<div class="an-tri anlbl"><span>entity</span><span>relation</span><span>entity</span></div><span class="an-rmbtn"></span></div>`;
    map.forEach((s, i) => h += row('map', i, s, map, !!s.skip));
    h += `<div class="kb-add"><button type="button" id="addMapStep">+ add a step to both paths</button></div>`;
    h += `<hr class="an-divider">`;
    h += `<p class="kb-ask">Now <b>invent</b>: a true triple about a concept on one side, and its counterpart carried across to the other.</p>`;
    inv.forEach((s, i) => h += row('inv', i, s, inv, invSkip));
    h += `<div class="kb-add"><button type="button" id="addInv"${invSkip ? ' disabled' : ''}>+ add another</button></div>`;
    h += `<label class="kb-skip"><input type="checkbox" name="skip_invention"${invSkip ? ' checked' : ''}> I can't think of an invention</label>`;
    host.innerHTML = h;
    host.querySelectorAll('[data-rm]').forEach(b => b.addEventListener('click', () => {
      sync(); const [pre, idx] = b.dataset.rm.split(':'); (pre === 'map' ? map : inv).splice(+idx, 1); draw();
    }));
    host.querySelector('#addMapStep').addEventListener('click', () => { sync(); map.push({ ah: '', ar: '', at: '', bh: '', br: '', bt: '' }); draw(); });
    host.querySelector('#addInv').addEventListener('click', () => { sync(); inv.push({ ah: '', ar: '', at: '', bh: '', br: '', bt: '' }); draw(); });
    host.querySelector('[name="skip_invention"]').addEventListener('change', () => { sync(); draw(); });
    host.querySelectorAll('[name^="skip_map_"]').forEach(cb => cb.addEventListener('change', () => { sync(); draw(); }));
    growAnalogyCells(host);   // size each cell to its wrapped content, and keep it sized as they type
    host.querySelectorAll('.an-tri textarea').forEach(t =>
      t.addEventListener('input', () => { t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }));
  }
  draw();
}

// Blend: project a triple true of one input (source) into the blended space (image), tagged u|v, plus
// emergent structure true of neither input. Mirrors the analogy side-by-side format and the paper table.
function wireBlend(stim) {
  const host = document.getElementById('blendHost');
  let proj = [{ from: 'u', sh: stim.u, sr: '', st: '', ih: '', ir: '', it: '' },
              { from: 'v', sh: stim.v, sr: '', st: '', ih: '', ir: '', it: '' }];
  let emer = [{ h: '', r: '', t: '' }];
  let emerSkip = false;
  const PF = ['sh', 'sr', 'st', 'ih', 'ir', 'it'];
  function sync() {
    proj.forEach((s, i) => PF.forEach(f => { const el = host.querySelector(`[name="p_${f}_${i}"]`); if (el) s[f] = el.value; }));
    emer.forEach((s, i) => ['h', 'r', 't'].forEach(f => { const el = host.querySelector(`[name="e_${f}_${i}"]`); if (el) s[f] = el.value; }));
    const sk = host.querySelector('[name="skip_emergent"]'); if (sk) emerSkip = sk.checked;
  }
  function ptri(i, s, which) {
    const cls = which === 'src' ? (s.from === 'u' ? 'aside' : 'bside') : 'newc';
    const keys = which === 'src' ? ['sh', 'sr', 'st'] : ['ih', 'ir', 'it'];
    const ph = which === 'src' ? ['an input entity', 'relation', 'entity'] : ['the blend', 'relation', 'entity'];
    const cell = (kk, p) => `<textarea rows="1" name="p_${kk}_${i}" required placeholder="${p}">${esc(s[kk])}</textarea>`;
    return `<div class="an-tri ${cls}">${cell(keys[0], ph[0])}${cell(keys[1], ph[1])}${cell(keys[2], ph[2])}</div>`;
  }
  function etri(i, s) {
    const attr = emerSkip ? ' disabled' : ' required';
    const cell = (kk, p) => `<textarea rows="1" name="e_${kk}_${i}"${attr} placeholder="${p}">${esc(s[kk])}</textarea>`;
    return `<div class="an-tri emergent">${cell('h', 'the blend')}${cell('r', 'relation')}${cell('t', 'entity')}</div>`;
  }
  function draw() {
    let h = `<p class="kb-ask" style="margin:14px 0 6px;">Project structure into the blend &mdash; each row: a triple true of an input, carried into the blend:</p>`;
    h += `<div class="an-colhead"><span class="col">true of an input</span><span class="bl-arrowhead"></span><span class="col">in the blend</span><span class="an-rmbtn"></span></div>`;
    h += `<div class="an-row an-subhead"><div class="an-tri anlbl"><span>entity</span><span>relation</span><span>entity</span></div>` +
         `<span class="bl-arrow" style="visibility:hidden">&rarr;</span>` +
         `<div class="an-tri anlbl"><span>entity</span><span>relation</span><span>entity</span></div><span class="an-rmbtn"></span></div>`;
    proj.forEach((s, i) => {
      const rm = proj.length > 1 ? `<button type="button" class="kb-x an-rmbtn" data-rm="p:${i}">&times;</button>` : '<span class="an-rmbtn"></span>';
      h += `<div class="an-rowwrap"><div class="an-row">${ptri(i, s, 'src')}<span class="bl-arrow" title="projects to">&rarr;</span>${ptri(i, s, 'img')}${rm}
        <input type="hidden" name="p_from_${i}" value="${s.from}"></div>
        <div class="bl-tagrow"><span class="bl-tag ${s.from}">from ${esc(s.from === 'u' ? stim.u : stim.v)} [${s.from}]</span></div></div>`;
    });
    h += `<div class="kb-add"><button type="button" id="addPU">+ project from ${esc(stim.u)}</button> <button type="button" id="addPV">+ project from ${esc(stim.v)}</button></div>`;
    h += `<hr class="an-divider">`;
    h += `<p class="kb-ask" style="margin:6px 0;">Emergent structure &mdash; true of the blend but of <b>neither</b> input alone:</p>`;
    h += `<div class="an-row an-subhead"><div class="an-tri anlbl"><span>entity</span><span>relation</span><span>entity</span></div><span class="an-rmbtn"></span></div>`;
    emer.forEach((s, i) => {
      const rm = emer.length > 1 ? `<button type="button" class="kb-x an-rmbtn" data-rm="e:${i}">&times;</button>` : '<span class="an-rmbtn"></span>';
      h += `<div class="an-rowwrap"><div class="an-row">${etri(i, s)}${rm}</div></div>`;
    });
    h += `<div class="kb-add"><button type="button" id="addE"${emerSkip ? ' disabled' : ''}>+ add emergent structure</button></div>`;
    h += `<label class="kb-skip"><input type="checkbox" name="skip_emergent"${emerSkip ? ' checked' : ''}> I can't think of emergent structure</label>`;
    host.innerHTML = h;
    host.querySelectorAll('[data-rm]').forEach(b => b.addEventListener('click', () => {
      sync(); const [p, idx] = b.dataset.rm.split(':'); (p === 'p' ? proj : emer).splice(+idx, 1); draw();
    }));
    host.querySelector('#addPU').addEventListener('click', () => { sync(); proj.push({ from: 'u', sh: stim.u, sr: '', st: '', ih: '', ir: '', it: '' }); draw(); });
    host.querySelector('#addPV').addEventListener('click', () => { sync(); proj.push({ from: 'v', sh: stim.v, sr: '', st: '', ih: '', ir: '', it: '' }); draw(); });
    host.querySelector('#addE').addEventListener('click', () => { sync(); emer.push({ h: '', r: '', t: '' }); draw(); });
    host.querySelector('[name="skip_emergent"]').addEventListener('change', () => { sync(); draw(); });
    growAnalogyCells(host);
    host.querySelectorAll('.an-tri textarea').forEach(t => t.addEventListener('input', () => { t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }));
  }
  draw();
}

function makeTrial(stim, index, total) {
  return {
    type: jsPsychSurveyHtmlForm,
    html: trialHTML(stim, index, total),
    button_label: index === total - 1 ? 'Submit last one' : 'Submit & continue',
    data: { phase: 'task', task: stim.task, stimulus_id: stim.id, u: stim.u, v: stim.v || null },
    on_load: () => {
      document.body.classList.toggle('an-trial', stim.task === 'analogy' || stim.task === 'blending');   // wide canvas for side-by-side triples
      if (stim.task === 'association') wireAssociation(stim);
      else if (stim.task === 'analogy') wireAnalogyPaths(stim);
      else if (stim.task === 'blending') wireBlend(stim);
      // the worked example lives in a collapsed <details>; size its cells when it is opened
      document.querySelectorAll('details.kb-example').forEach(d => d.addEventListener('toggle', () => growAnalogyCells(d)));
    },
    on_finish: (data) => { data.clean = tidy(stim, data.response); }
  };
}

// reshape the flat form response into a tidy per-task record
function tidy(stim, r) {
  const base = { task: stim.task, inferences: (r.inferences || '').trim() };
  if (stim.task === 'association') {
    const rows = [];
    Object.keys(r).forEach(k => {
      const m = k.match(/^tri_head_(\d+)$/); if (!m) return;
      const i = m[1];
      rows.push({ index: +i, head: (r['tri_head_' + i] || '').trim(),
        relation: (r['tri_rel_' + i] || '').trim(), tail: (r['tri_tail_' + i] || '').trim() });
    });
    rows.sort((a, b) => a.index - b.index);
    return { ...base, u: stim.u, v: stim.v, triples: rows.map(({ head, relation, tail }) => ({ head, relation, tail })) };
  }
  if (stim.task === 'analogy') {
    const collect = (prefix) => {
      const arr = [];
      Object.keys(r).forEach(k => {
        const m = k.match(new RegExp('^' + prefix + '_ah_(\\d+)$')); if (!m) return;
        const i = m[1];
        arr[+i] = {
          a: [r[prefix + '_ah_' + i], r[prefix + '_ar_' + i], r[prefix + '_at_' + i]].map(x => (x || '').trim()),
          b: [r[prefix + '_bh_' + i], r[prefix + '_br_' + i], r[prefix + '_bt_' + i]].map(x => (x || '').trim())
        };
      });
      return arr.filter(Boolean);
    };
    const mapRows = collect('map'), invRows = collect('inv');
    const path_a = mapRows.map(t => ({ head: t.a[0], relation: t.a[1], tail: t.a[2] }));
    const path_b = mapRows.map(t => ({ head: t.b[0], relation: t.b[1], tail: t.b[2] }));
    const projection = invRows.map(t => ({ source: t.a, image: t.b }));
    const skipped = {};
    if (r.skip_invention) skipped.invention = true;
    const mapSteps = Object.keys(r).filter(k => /^skip_map_\d+$/.test(k) && r[k])
      .map(k => +k.match(/\d+/)[0]).sort((a, b) => a - b);
    if (mapSteps.length) skipped.map_steps = mapSteps;   // steps the participant marked "I don't know"
    return { ...base, u: stim.u, v: stim.v, path_a, path_b, projection,
      projected: invRows[0] ? invRows[0].a[0] : '', invention: invRows[0] ? invRows[0].b[0] : '', skipped };
  }
  // blending: projection rows (source triple -> blended-space triple, tagged u|v) + emergent triples
  const projRows = [];
  Object.keys(r).forEach(k => { const m = k.match(/^p_from_(\d+)$/); if (!m) return; const i = m[1];
    projRows[+i] = { from: r['p_from_' + i],
      source: [r['p_sh_' + i], r['p_sr_' + i], r['p_st_' + i]].map(x => (x || '').trim()),
      triple: [r['p_ih_' + i], r['p_ir_' + i], r['p_it_' + i]].map(x => (x || '').trim()) };
  });
  const emerRows = [];
  Object.keys(r).forEach(k => { const m = k.match(/^e_h_(\d+)$/); if (!m) return; const i = m[1];
    emerRows[+i] = { from: 'emergent',
      triple: [r['e_h_' + i], r['e_r_' + i], r['e_t_' + i]].map(x => (x || '').trim()) };
  });
  const structure = [...projRows.filter(Boolean), ...emerRows.filter(Boolean)];
  const skipped = r.skip_emergent ? { emergent: true } : {};
  return { ...base, u: stim.u, v: stim.v, blend_name: (r.blend_name || '').trim(),
    generic_space: (r.generic_space || '').trim(), structure, skipped };
}

/* ------------------------------------------------------------------ ID screen */
// Prolific participants are identified by the URL, so they never see this. Everyone else types an ID
// (the only key their data is stored under), validated here rather than silently accepting a blank.
function createIdScreen() {
  return {
    type: jsPsychSurveyHtmlForm,
    html: `<div style="max-width:560px;margin:0 auto;text-align:left;">
      <h1 style="text-align:center;color:#333;">Creativity Study</h1>
      <p style="color:#555;">Before you begin, please enter the participant ID you were given.</p>
      <div class="kb-field">
        <label for="pid">Participant ID</label>
        <input type="text" id="pid" name="participant_id" autocomplete="off" spellcheck="false"
               placeholder="e.g. KB-014" value="${isDebugMode ? esc(debugId()) : ''}">
        <span style="font-size:13px;color:#888;">Letters, numbers, hyphens and underscores; at least 3 characters. If you don't have one, ask the researcher &mdash; your data cannot be matched without it.</span>
      </div>
      <div class="kb-field">
        <label for="pid2">Confirm participant ID</label>
        <input type="text" id="pid2" name="participant_id_confirm" autocomplete="off" spellcheck="false"
               value="${isDebugMode ? esc(debugId()) : ''}">
      </div>
      ${isDebugMode ? '<p style="color:#888;font-size:13px;font-style:italic;">Debug mode &mdash; your raw data is shown at the end.</p>' : ''}
      <div id="idError" style="color:#c0392b;font-size:14px;min-height:18px;"></div>
    </div>`,
    button_label: 'Begin',
    data: { phase: 'id' },
    on_load: () => { window.scrollTo(0, 0); wireIdValidation(); },
    on_finish: (data) => { participantId = (data.response.participant_id || '').trim(); data.participant_id = participantId; }
  };
}

let _debugId = null;
function debugId() {
  if (!_debugId) _debugId = `DEBUG-${Date.now().toString(36)}`;
  return _debugId;
}

function wireIdValidation() {
  const form = document.querySelector('#jspsych-survey-html-form');
  const error = document.getElementById('idError');
  form.addEventListener('submit', (e) => {
    const id = form.querySelector('#pid').value.trim();
    const confirmed = form.querySelector('#pid2').value.trim();
    let msg = '';
    if (!/^[A-Za-z0-9_-]{3,64}$/.test(id)) {
      msg = 'Please enter a valid participant ID (at least 3 characters: letters, numbers, hyphens, underscores).';
    } else if (id !== confirmed) {
      msg = 'The two IDs do not match. Please check and re-enter.';
    }
    if (!msg) return;
    e.preventDefault(); e.stopPropagation();
    error.textContent = msg;
  }, true);
}

/* ---------------------------------------------------------- consent / frames */
function createConsentScreen() {
  return {
    type: jsPsychInstructions,
    pages: [
      `<div style="width: 800px; font-size: 16px; text-align: left; margin: 0 auto; padding: 40px 0;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="color: #333; font-size: 24px; margin-bottom: 10px;">Creativity Evaluation Study</h1>
                    <p style="color: #666; font-size: 16px;">Research Consent Form</p>
                </div>
                <p style="margin: 0 0 24px; padding: 16px 20px; background: #fff6e0; border: 1px solid #e8c85a; border-left: 5px solid #e0a800; border-radius: 6px; font-size: 16px;">
                    <strong>🏆 Bonus:</strong> The most creative responses earn extra pay. If your responses rank in the
                    <strong>top 10% most creative</strong> across all participants, you will receive an <strong>additional $15 bonus</strong>.
                    So take your time and be as original as you can.</p>
                <p>Dear Participant,</p>
                <p>Thank you for your interest in our research! We are researchers interested in understanding how people evaluate creative ideas.</p>
                <p><strong>Study Purpose:</strong> We are conducting research on how people make creative connections between ideas — linking distant concepts, drawing analogies, and fusing ideas into new concepts. This helps us understand what makes ideas creative and how to measure creativity.</p>
                <p><strong>What You Will Do:</strong> You will be shown 15 short prompts. For each, you will type a creative response — connecting two ideas with a chain, drawing an analogy, or fusing two ideas into a new concept. The study takes approximately 12-18 minutes.</p>
                <p><strong>Data We Collect:</strong> We will collect the following data during this study:
                <br>• Your typed responses for each prompt
                <br>• Your Prolific ID for compensation and data management
                <br>• Timestamps of your responses
                <br>• Basic technical information (browser type, screen resolution)
                <br>We do NOT collect any personally identifiable information beyond your Prolific ID.</p>
                <p><strong>Data Use and Storage:</strong> Your data will be:
                <br>• Stored securely on encrypted servers for up to 7 years for research purposes
                <br>• Used to validate automated creativity scoring methods
                <br>• Potentially shared in anonymized form with other researchers or made publicly available for scientific transparency
                <br>• Processed under legitimate research interest as permitted by GDPR and data protection laws</p>
                <p><strong>Your Rights:</strong> Your participation is completely voluntary. You may:
                <br>• Refuse to participate without penalty
                <br>• Withdraw from the study at any time by closing your browser
                <br>• Request deletion of your data by contacting us via Prolific messaging with your Prolific ID within 30 days of participation
                <br>• Contact your local data protection authority with any concerns</p>
                <p><strong>Risks and Benefits:</strong> There are no risks beyond those of normal computer use. Your participation contributes to research on understanding creativity. You will be compensated according to Prolific's standard rate.</p>
                <p><strong>Contact:</strong> For questions about this study, contact the research team via Prolific messaging. For questions about your rights as a participant, contact your local research ethics committee or data protection authority.</p>
                <p style="margin-top: 30px; padding: 20px; background: #f0f8ff; border-left: 4px solid #007bff;">
                    <strong>Informed Consent Statement:</strong><br>
                    I understand the information provided above about this research study. I understand:
                    <br>• The purpose of the study and what I will be asked to do
                    <br>• What data will be collected and how it will be used
                    <br>• My rights including the ability to withdraw at any time
                    <br>• How my data will be stored and potentially shared
                    <br><br>
                    I am 18 years of age or older and voluntarily agree to participate in this study.
                </p>
            </div>`
    ],
    show_clickable_nav: true,
    button_label_next: "I Consent and Agree to Participate",
    on_finish: function() {
      window.consentData = {
        participant_id: participantId,
        consent_timestamp: new Date().toISOString(),
        consent_given: true,
        consent_version: (window.EXPERIMENT_CONFIG || {}).consent_version || 'kombine_gen_v1'
      };
    }
  };
}

const TASK_INTRO = {
  association: { color: '#1976d2', title: 'Association — build a chain',
    desc: 'Build a path of <b>triples</b> (entity, relation, entity) from one entity to another. Try to use surprising, original, and unusual relations and concepts in this chain, rather than generic ones that other participants would pick.' },
  analogy: { color: '#f57c00', title: 'Analogy — find the parallel, then invent',
    desc: 'Name the relationship two ideas share and what each maps to, then use the analogy to invent a new idea in the other domain.' },
  blending: { color: '#388e3c', title: 'Blend — fuse two into one',
    desc: 'Fuse two ideas into a single new concept that borrows structure from both, then say what emerges that neither had alone.' }
};

// The description for a task, shown immediately before that task's block of items (not all up front).
function createTaskIntro(task, n) {
  const t = TASK_INTRO[task];
  return {
    type: jsPsychInstructions, show_clickable_nav: true, button_label_next: `Start the ${task} prompts`,
    pages: [
      `<div style="max-width:${task === 'analogy' ? 820 : 720}px;margin:0 auto;text-align:left;"><h3 style="color:${t.color}">${t.title}</h3>
        <p>${t.desc}</p>
        <div style="color:#666;margin-top:8px;">${EXAMPLES[task]}</div>
        <p style="margin-top:16px;color:#888;font-size:14px;">Next: ${n} ${task} ${n === 1 ? 'prompt' : 'prompts'}.</p></div>`
    ],
    on_load: () => growAnalogyCells()   // size the worked-example cells shown on this intro page
  };
}

function createCompletionScreen() {
  return {
    type: jsPsychInstructions, show_clickable_nav: true,
    button_label_next: isProlificParticipant ? 'Return to Prolific' : 'View data',
    pages: [`<div style="max-width:600px;margin:0 auto;text-align:center;"><h1>Thank you!</h1>
      <p>You've completed all 15 prompts.</p>
      ${isProlificParticipant ? '<p>Click below to return to Prolific.</p>' : '<p><strong>Debug mode:</strong> your data is shown next.</p>'}</div>`],
    on_finish: () => { if (isProlificParticipant && prolificCompletionURL) setTimeout(() => { window.location.href = prolificCompletionURL; }, 1000); }
  };
}

function createDataDisplayScreen() {
  return {
    type: jsPsychInstructions, show_clickable_nav: true, button_label_next: 'Finish',
    pages: [() => `<div style="max-width:860px;margin:0 auto;text-align:left;"><h2>Debug — collected data</h2>
      <textarea readonly style="width:100%;height:340px;font:12px ui-monospace,monospace;">${esc(JSON.stringify(exportExperimentData(), null, 2))}</textarea></div>`]
  };
}

/* ------------------------------------------------------------- data plumbing */
function exportExperimentData() {
  const trials = jsPsych.data.get().filter({ phase: 'task' }).values();
  return {
    experiment: (window.EXPERIMENT_CONFIG || {}).experiment_name || 'kombine_generation',
    participant_id: participantId,
    is_prolific: isProlificParticipant,
    consent_version: (window.EXPERIMENT_CONFIG || {}).consent_version,
    submitted_at: new Date().toISOString(),
    responses: trials.map(t => ({ ...t.clean, rt: t.rt, stimulus_id: t.stimulus_id }))
  };
}

async function submitDataToServer(data) {
  if (!DATA_SUBMISSION_URL) return { status: 'skipped' };
  try {
    const res = await fetch(DATA_SUBMISSION_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ experiment: data.experiment, participantId, data })
    });
    return { status: res.ok ? 'ok' : 'error' };
  } catch (e) { return { status: 'error', error: String(e) }; }
  finally { try { localStorage.setItem('kombine_' + participantId, JSON.stringify(data)); } catch (e) {} }
}

/* ----------------------------------------------------------------- run it */
async function runExperiment() {
  try {
    initializeParticipant();
    const stimuli = window.STIMULI || [];
    const total = stimuli.length;
    const timeline = [];
    if (!isProlificParticipant) timeline.push(createIdScreen());   // ID page first (non-Prolific only)
    timeline.push(createConsentScreen());
    // Group by task so each task's description appears right before its own block
    // (association -> analogy -> blending), rather than all three up front.
    let idx = 0;
    ['association', 'analogy', 'blending'].forEach(task => {
      const items = stimuli.filter(s => s.task === task);
      if (!items.length) return;
      timeline.push(createTaskIntro(task, items.length));
      items.forEach(stim => { timeline.push(makeTrial(stim, idx, total)); idx++; });
    });
    timeline.push(createCompletionScreen());
    if (isDebugMode) timeline.push(createDataDisplayScreen());

    jsPsych = initJsPsych({
      display_element: 'jspsych-target',
      on_finish: async () => { await submitDataToServer(exportExperimentData()); }
    });
    await jsPsych.run(timeline);
  } catch (error) {
    console.error(error);
    document.body.innerHTML = `<div style="padding:40px;text-align:center;color:#c0392b;">
      <h1>Error loading experiment</h1><p>${esc(error.message)}</p></div>`;
  }
}

document.addEventListener('DOMContentLoaded', runExperiment);
