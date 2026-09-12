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

// Progressive reveal: a later section (the analogy invention, the blend's new links) stays hidden AND
// disabled until `ready()` says the earlier parts are complete, so the browser neither validates nor
// submits its fields while hidden, and the participant works the task in order.
function gateSection(section, ready, allowEnable) {
  const ok = ready();
  section.hidden = !ok;
  section.querySelectorAll('textarea, input, button').forEach(el => {
    el.disabled = !ok || !allowEnable(el);
  });
  const hint = section.parentNode.querySelector('.kb-gate-hint');
  if (hint) hint.hidden = ok;
}
const GATE_HINT = (what) => `<p class="kb-gate-hint" style="color:#888;font-size:14px;margin:10px 0 0;">Once you have filled in the rows above, ${what} will appear here.</p>`;

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
  analogy: `<div style="max-width:880px;">
      <div class="an-colhead"><span class="col"><span class="kb-chip a">The blue whale</span></span><span class="col"><span class="kb-chip b">The mattress</span></span></div>
      <div class="an-rowwrap"><div class="an-row">
        <div class="an-tri aside"><textarea rows="1" readonly>The blue whale</textarea><textarea rows="1" readonly>is covered by</textarea><textarea rows="1" readonly>skin</textarea></div>
        <div class="an-tri bside"><textarea rows="1" readonly>The mattress</textarea><textarea rows="1" readonly>is covered by</textarea><textarea rows="1" readonly>sheets</textarea></div>
      </div></div>
      <div class="an-rowwrap"><div class="an-row">
        <div class="an-tri aside"><textarea rows="1" readonly>skin</textarea><textarea rows="1" readonly>hosts</textarea><textarea rows="1" readonly>barnacles</textarea></div>
        <div class="an-tri bside"><textarea rows="1" readonly>sheets</textarea><textarea rows="1" readonly>hosts</textarea><textarea rows="1" readonly>dust mites</textarea></div>
      </div></div>
      <div class="an-rowwrap"><div class="an-row">
        <div class="an-tri aside"><textarea rows="1" readonly>barnacles</textarea><textarea rows="1" readonly>feed on</textarea><textarea rows="1" readonly>plankton</textarea></div>
        <div class="an-tri bside"><textarea rows="1" readonly>dust mites</textarea><textarea rows="1" readonly>feed on</textarea><textarea rows="1" readonly>skin flakes</textarea></div>
      </div></div>
      <hr class="an-divider">
      <p class="kb-ask" style="margin:6px 0;">Then <b>invent a new idea</b> by taking an entity and a relation from one side, and carrying them over to the other. The arrow shows the direction, and the <b>shaded</b> cells are the invented concept, which can be on either side.</p>
      <div class="an-rowwrap"><div class="an-row">
        <div class="an-tri aside newc"><textarea rows="1" readonly>whale groomer drone</textarea><textarea rows="1" readonly>removes</textarea><textarea rows="1" readonly>barnacles</textarea></div>
        <span class="an-dirarrow" title="carried from the mattress side to the whale side">&larr;</span>
        <div class="an-tri bside"><textarea rows="1" readonly>vacuum cleaner</textarea><textarea rows="1" readonly>removes</textarea><textarea rows="1" readonly>dust mites</textarea></div>
      </div></div>
      <div class="an-rowwrap"><div class="an-row">
        <div class="an-tri aside newc"><textarea rows="1" readonly>whale groomer drone</textarea><textarea rows="1" readonly>cleans</textarea><textarea rows="1" readonly>skin</textarea></div>
        <span class="an-dirarrow">&larr;</span>
        <div class="an-tri bside"><textarea rows="1" readonly>vacuum cleaner</textarea><textarea rows="1" readonly>cleans</textarea><textarea rows="1" readonly>sheets</textarea></div>
      </div></div>
      <div class="kb-legend"><span class="sw"></span> invented concept</div>
    </div>`,
  blending: `<div style="max-width:860px;">
      <div class="kb-pair"><span class="kb-chip a">Democracy</span><span class="kb-tween">+</span><span class="kb-chip b">Banking</span></div>
      <div class="kb-field"><label>New concept</label><input type="text" value="Liquid Franchise" readonly></div>
      <div class="kb-field"><label>The abstract structure that both share</label><input type="text" value="a system that allocates fungible units of power" readonly></div>
      <div class="an-colhead"><span class="col">true of one of the two concepts, or of both</span><span class="bl-arrowhead"></span><span class="col">in the new concept</span></div>
      <div class="an-rowwrap"><div class="an-row">
        <div class="bl-src">
          <div class="an-tri aside"><textarea rows="1" readonly>Democracy</textarea><textarea rows="1" readonly>allocates</textarea><textarea rows="1" readonly>votes</textarea></div>
          <div class="an-tri bside"><textarea rows="1" readonly>Banking</textarea><textarea rows="1" readonly>allocates</textarea><textarea rows="1" readonly>credit</textarea></div>
        </div>
        <span class="bl-arrow">&rarr;</span>
        <div class="an-tri newc"><textarea rows="1" readonly>Liquid Franchise</textarea><textarea rows="1" readonly>allocates</textarea><textarea rows="1" readonly>vote-shares</textarea></div>
      </div><div class="bl-tagrow"><span class="bl-tag uv">from both Democracy and Banking</span></div></div>
      <div class="an-rowwrap"><div class="an-row">
        <div class="an-tri bside"><textarea rows="1" readonly>credit</textarea><textarea rows="1" readonly>can be</textarea><textarea rows="1" readonly>traded</textarea></div>
        <span class="bl-arrow">&rarr;</span>
        <div class="an-tri newc"><textarea rows="1" readonly>vote-shares</textarea><textarea rows="1" readonly>can be</textarea><textarea rows="1" readonly>traded</textarea></div>
      </div><div class="bl-tagrow"><span class="bl-tag v">from Banking</span></div></div>
      <hr class="an-divider">
      <p class="kb-ask" style="margin:6px 0;">Describe something that is true of your new concept but of <b>neither</b> original concept on its own</p>
      <div class="an-rowwrap"><div class="an-row">
        <div class="an-tri emergent"><textarea rows="1" readonly>a citizen</textarea><textarea rows="1" readonly>can liquidate</textarea><textarea rows="1" readonly>their own political personhood</textarea></div>
      </div></div>
      <div class="kb-legend"><span class="sw"></span> the new concept</div>
    </div>`
};

const EYE = { association: 'assoc', analogy: 'analogy', blending: 'blend' };

function header(stim, index, total) {
  const pct = ((index + 1) / total) * 100;
  return `<div class="kb-progress">Item ${index + 1} of ${total}</div>
    <div style="height:3px;background:#e0dde6;border-radius:2px;margin:6px 0 18px;">
      <div style="width:${pct}%;height:100%;background:#007bff;border-radius:2px;"></div></div>`;
}

// Hidden LLM traps (see EXPERIMENT_CONFIG.llm_traps). Visually hidden with the screen-reader-only pattern,
// so the text is in the accessibility tree and in innerText (what page-reading assistants consume) but is
// never painted. Deliberately NOT aria-hidden: that would remove it from exactly the channel an assistant reads.
// Each item gets its own trap word (words[k] for the k-th item in the session), so a participant who asks an
// assistant on several items does not keep seeing the same odd word.
function trapWord(index) {
  const w = ((window.EXPERIMENT_CONFIG || {}).llm_traps || {}).words || [];
  return w.length ? w[index % w.length] : '';
}
function trapInline(index) {
  const t = (window.EXPERIMENT_CONFIG || {}).llm_traps || {};
  return t.inline_instruction ? ` <span class="kb-hp">${esc(t.inline_instruction.replace('{word}', trapWord(index)))}</span>` : '';
}
function trapField(index) {
  const t = (window.EXPERIMENT_CONFIG || {}).llm_traps || {};
  if (!t.honeypot_label) return '';
  return `<div class="kb-hp"><label for="hp_note">${esc(t.honeypot_label.replace('{word}', trapWord(index)))}</label>
    <input type="text" id="hp_note" name="hp_note" tabindex="-1" autocomplete="off"></div>`;
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
      <p class="kb-ask">Build a chain of associations from <b>${esc(stim.u)}</b> to <b>${esc(stim.v)}</b>. Start at <b>${esc(stim.u)}</b> and add links, one row at a time, until the last link ends at <b>${esc(stim.v)}</b>. For each link, write the entity you are linking to and the relation that connects the two entities. Try to use surprising, original, and unusual relations and entities rather than generic ones that other participants would pick.${trapInline(index)}</p>
      <div class="kb-path" id="pathHost"></div>
      <div class="kb-add"><button type="button" id="addStep">+ add a link</button></div>`;
  } else if (t === 'analogy') {
    body += `<div class="kb-pair"><span class="kb-chip a">${esc(stim.u)}</span>
        <span class="kb-tween">::</span><span class="kb-chip b">${esc(stim.v)}</span></div>
      <p class="kb-ask">Form an analogy between <b>${esc(stim.u)}</b> and <b>${esc(stim.v)}</b>. In each row, write a link about <b>${esc(stim.u)}</b> on the left and the matching link about <b>${esc(stim.v)}</b> on the right, using the <b>same relation</b> on both sides, so that the entities on the left map to the entities on the right. Add rows to extend the analogy. Try to use surprising, original, and unusual relations and entities rather than generic ones that other participants would pick.${trapInline(index)}</p>
      <div id="mapHost"></div>`;
  } else { // blending — fuse two entities into one new concept by projecting structure from each input
    body += `<div class="kb-pair"><span class="kb-chip a">${esc(stim.u)}</span>
        <span class="kb-tween">+</span><span class="kb-chip b">${esc(stim.v)}</span></div>
      <p class="kb-ask">Blend <b>${esc(stim.u)}</b> and <b>${esc(stim.v)}</b> into one new concept. First, give your new concept a name. Then, describe the abstract structure that both <b>${esc(stim.u)}</b> and <b>${esc(stim.v)}</b> share, which is what lets them be blended. Be specific: &ldquo;both exist&rdquo; or &ldquo;both involve change&rdquo; does not count. Next, in each row, take a relationship that is true of <b>${esc(stim.u)}</b> and/or of <b>${esc(stim.v)}</b> on the left, and write what it becomes in your new concept on the right. Try to have at least one link in your new concept that comes from both. Once you finish that, the final step will appear below the line asking you to add links that are true of your new concept but of neither <b>${esc(stim.u)}</b> nor <b>${esc(stim.v)}</b> on its own. Try to make a blend that is surprising and original rather than one that other participants would pick.${trapInline(index)}</p>
      <label class="kb-skip" style="margin:0 0 10px;"><input type="checkbox" name="skip_blend"> I can't think of a blend</label>
      <div class="kb-field"><label>Name your new concept</label>
        <input type="text" name="blend_name" required placeholder="a short name for the new concept"></div>
      <div class="kb-field"><label>The abstract structure that <b>both</b> ${esc(stim.u)} and ${esc(stim.v)} share</label>
        <input type="text" name="generic_space" required placeholder="e.g. a system that allocates fungible units of power"></div>
      <div id="blendHost"></div>`;
  }
  body += exampleBlock(t) + trapField(index);
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
  let inv = [{ ah: '', ar: '', at: '', bh: '', br: '', bt: '', dir: '' }];  // invention row; dir 'ab' = left is true, right invented; 'ba' = the reverse
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
    inv.forEach((s, i) => { const d = host.querySelector(`[name="inv_dir_${i}"]:checked`); s.dir = d ? d.value : ''; });
    const sk = host.querySelector('[name="skip_invention"]');
    if (sk) invSkip = sk.checked;
  }
  function tri(prefix, i, s, side, disabled) {
    const k = side === 'a' ? ['ah', 'ar', 'at'] : ['bh', 'br', 'bt'];
    const attr = disabled ? ' disabled' : ' required';
    // on an invention row, the side the participant marked as invented is shaded gold
    const invented = prefix === 'inv' && ((side === 'a' && s.dir === 'ba') || (side === 'b' && s.dir === 'ab'));
    const cell = (kk, ph) => `<textarea rows="1" name="${prefix}_${kk}_${i}"${attr} placeholder="${ph}">${esc(s[kk])}</textarea>`;
    return `<div class="an-tri ${side === 'a' ? 'aside' : 'bside'}${invented ? ' newc' : ''}">${cell(k[0], 'entity')}${cell(k[1], 'relation')}${cell(k[2], 'entity')}</div>`;
  }
  // direction toggle for an invention row: two radio buttons drawn as arrows (required unless the invention is skipped)
  function dirToggle(i, s, disabled) {
    const attr = disabled ? ' disabled' : ' required';
    const opt = (v, arrow, title) => `<label title="${title}"><input type="radio" name="inv_dir_${i}" value="${v}"${s.dir === v ? ' checked' : ''}${attr}><span>${arrow}</span></label>`;
    return `<div class="an-dir">${opt('ab', '&rarr;', `the ${esc(stim.u)} link is true; the ${esc(stim.v)} one is invented`)}${opt('ba', '&larr;', `the ${esc(stim.v)} link is true; the ${esc(stim.u)} one is invented`)}</div>`;
  }
  function row(prefix, i, s, arr, disabled) {
    const rm = arr.length > 1 ? `<button type="button" class="kb-x an-rmbtn" data-rm="${prefix}:${i}">&times;</button>` : '<span class="an-rmbtn"></span>';
    // map rows get a per-step "don't know" opt-out (this task is hard); the invention has its own skip below.
    const dk = prefix === 'map'
      ? `<label class="kb-skip an-dk"><input type="checkbox" name="skip_map_${i}"${disabled ? ' checked' : ''}> I can&rsquo;t think of an analogy</label>` : '';
    const mid = prefix === 'inv' ? dirToggle(i, s, disabled) : '';
    return `<div class="an-rowwrap"><div class="an-row">${tri(prefix, i, s, 'a', disabled)}${mid}${tri(prefix, i, s, 'b', disabled)}
      ${rm}</div>${dk}</div>`;
  }
  function draw() {
    let h = `<div class="an-colhead"><span class="col"><span class="kb-chip a">${esc(stim.u)}</span></span>
      <span class="col"><span class="kb-chip b">${esc(stim.v)}</span></span><span class="an-rmbtn"></span></div>`;
    // persistent entity / relation / entity labels over each side's triple cells
    h += `<div class="an-row an-subhead"><div class="an-tri anlbl"><span>entity</span><span>relation</span><span>entity</span></div>` +
         `<div class="an-tri anlbl"><span>entity</span><span>relation</span><span>entity</span></div><span class="an-rmbtn"></span></div>`;
    map.forEach((s, i) => h += row('map', i, s, map, !!s.skip));
    h += `<div class="kb-add"><button type="button" id="addMapStep">+ add a row to extend the analogy</button></div>`;
    h += GATE_HINT('the invention step');
    h += `<div id="invSection" hidden><hr class="an-divider">`;
    h += `<p class="kb-ask">Now that you have formed the analogy, use it to <b>invent a new idea</b> by taking a known entity and relation from one side, and carrying them over to their corresponding roles on the other side. Click the arrow that points to the direction of your new invention.</p>`;
    inv.forEach((s, i) => h += row('inv', i, s, inv, invSkip));
    h += `<div class="kb-add"><button type="button" id="addInv"${invSkip ? ' disabled' : ''}>+ add another</button></div>`;
    h += `<label class="kb-skip"><input type="checkbox" name="skip_invention"${invSkip ? ' checked' : ''}> I can't think of an invention</label>`;
    h += `<div class="kb-legend"><span class="sw"></span> invented concept</div></div>`;
    host.innerHTML = h;
    host.querySelectorAll('[data-rm]').forEach(b => b.addEventListener('click', () => {
      sync(); const [pre, idx] = b.dataset.rm.split(':'); (pre === 'map' ? map : inv).splice(+idx, 1); draw();
    }));
    host.querySelector('#addMapStep').addEventListener('click', () => { sync(); map.push({ ah: '', ar: '', at: '', bh: '', br: '', bt: '' }); draw(); });
    host.querySelector('#addInv').addEventListener('click', () => { sync(); inv.push({ ah: '', ar: '', at: '', bh: '', br: '', bt: '', dir: '' }); draw(); });
    host.querySelector('[name="skip_invention"]').addEventListener('change', () => { sync(); draw(); });
    host.querySelectorAll('[name^="skip_map_"]').forEach(cb => cb.addEventListener('change', () => { sync(); draw(); }));
    host.querySelectorAll('[name^="inv_dir_"]').forEach(rb => rb.addEventListener('change', () => { sync(); draw(); }));   // re-shade the invented side
    growAnalogyCells(host);   // size each cell to its wrapped content, and keep it sized as they type
    host.querySelectorAll('.an-tri textarea').forEach(t =>
      t.addEventListener('input', () => { t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }));
    // The two sides of a row must use the same relation, so typing a relation on either side fills the
    // other side's relation cell as you type (the other cell stays editable; editing it mirrors back).
    host.querySelectorAll('textarea[name*="_ar_"], textarea[name*="_br_"]').forEach(t => {
      t.addEventListener('input', () => {
        const m = t.name.match(/^(map|inv)_(ar|br)_(\d+)$/); if (!m) return;
        const other = host.querySelector(`[name="${m[1]}_${m[2] === 'ar' ? 'br' : 'ar'}_${m[3]}"]`);
        if (other && !other.disabled && other.value !== t.value) {
          other.value = t.value; other.style.height = 'auto'; other.style.height = other.scrollHeight + 'px';
        }
      });
    });
    gate();
  }
  // The invention appears only once every mapping row is complete (all six cells filled) or skipped,
  // and at least one row is a real (unskipped) analogy: with no analogy there is nothing to carry over,
  // so the invention step (and its own skip box) never appears.
  const rowSkipped = (i) => { const cb = host.querySelector(`[name="skip_map_${i}"]`); return !!(cb && cb.checked); };
  const rowFilled = (i) => F.every(f => { const el = host.querySelector(`[name="map_${f}_${i}"]`); return el && el.value.trim(); });
  function noAnalogy() { return map.every((s, i) => rowSkipped(i)); }
  function mappingDone() { return !noAnalogy() && map.every((s, i) => rowSkipped(i) || rowFilled(i)); }
  function gate() {
    const sec = host.querySelector('#invSection');
    // when revealed, invention cells follow the skip box; the skip box itself is always enabled
    gateSection(sec, mappingDone, el => el.name === 'skip_invention' || !invSkip);
    const hint = host.querySelector('.kb-gate-hint');
    hint.textContent = noAnalogy()
      ? 'With no analogy there is no invention step; you can submit this item as it is.'
      : 'Once you have filled in the rows above, the invention step will appear here.';
  }
  host.addEventListener('input', gate);
  draw();
}

// Blend: project a triple true of one input (source) into the blended space (image), tagged u|v, plus
// emergent structure true of neither input. Mirrors the analogy side-by-side format and the paper table.
function wireBlend(stim) {
  const host = document.getElementById('blendHost');
  const form = host.closest('form') || document;
  // A link row: from = 'u' | 'v' | 'uv' | '' (not chosen yet). sh/sr/st = the source link true of one concept;
  // s2h/s2r/s2t = the second source link (a "both" row has one from each concept); ih/ir/it = the link in the
  // new concept they project into. Heads are prefilled with the concept name while the participant has not
  // typed over them.
  const blank = (from) => ({ from, sh: from === 'v' ? stim.v : from ? stim.u : '', sr: '', st: '',
                             s2h: from === 'uv' ? stim.v : '', s2r: '', s2t: '', ih: '', ir: '', it: '' });
  let proj = [blank('u'), blank('v')];
  let emer = [{ h: '', r: '', t: '' }];
  let emerSkip = false, blendSkip = false;
  const PF = ['sh', 'sr', 'st', 's2h', 's2r', 's2t', 'ih', 'ir', 'it'];
  const rowFields = (s) => s.from === 'uv' ? PF : ['sh', 'sr', 'st', 'ih', 'ir', 'it'];
  const untouched = (v) => !v || v === stim.u || v === stim.v;
  function sync() {
    proj.forEach((s, i) => {
      PF.forEach(f => { const el = host.querySelector(`[name="p_${f}_${i}"]`); if (el) s[f] = el.value; });
      const d = host.querySelector(`[name="p_from_${i}"]:checked`); const from = d ? d.value : '';
      if (from !== s.from) {          // source changed: re-prefill any head the participant has not typed over
        s.from = from;
        if (from === 'u' && untouched(s.sh)) s.sh = stim.u;
        if (from === 'v' && untouched(s.sh)) s.sh = stim.v;
        if (from === 'uv') { if (untouched(s.sh)) s.sh = stim.u; if (untouched(s.s2h)) s.s2h = stim.v; }
      }
    });
    emer.forEach((s, i) => ['h', 'r', 't'].forEach(f => { const el = host.querySelector(`[name="e_${f}_${i}"]`); if (el) s[f] = el.value; }));
    const sk = host.querySelector('[name="skip_emergent"]'); if (sk) emerSkip = sk.checked;
    const sb = form.querySelector('[name="skip_blend"]'); if (sb) blendSkip = sb.checked;
  }
  function ptri(i, s, which) {
    const cls = which === 'img' ? 'newc' : which === 'src2' ? 'bside' : (s.from === 'v' ? 'bside' : 'aside');
    const keys = which === 'src' ? ['sh', 'sr', 'st'] : which === 'src2' ? ['s2h', 's2r', 's2t'] : ['ih', 'ir', 'it'];
    const ph = which === 'img' ? ['your new concept', 'relation', 'entity'] : ['entity', 'relation', 'entity'];
    const attr = blendSkip ? ' disabled' : ' required';
    const cell = (kk, p) => `<textarea rows="1" name="p_${kk}_${i}"${attr} placeholder="${p}">${esc(s[kk])}</textarea>`;
    return `<div class="an-tri ${cls}">${cell(keys[0], ph[0])}${cell(keys[1], ph[1])}${cell(keys[2], ph[2])}</div>`;
  }
  // which concept this row's link comes from: radio pills (required unless the whole blend is skipped)
  function fromPicker(i, s) {
    const attr = blendSkip ? ' disabled' : ' required';
    const opt = (v, label) => `<label><input type="radio" name="p_from_${i}" value="${v}"${s.from === v ? ' checked' : ''}${attr}><span class="${v}">${label}</span></label>`;
    return `<div class="bl-from">This link comes from: ${opt('u', esc(stim.u))} ${opt('v', esc(stim.v))} ${opt('uv', 'Both')}</div>`;
  }
  function etri(i, s) {
    const attr = emerSkip ? ' disabled' : ' required';
    const cell = (kk, p) => `<textarea rows="1" name="e_${kk}_${i}"${attr} placeholder="${p}">${esc(s[kk])}</textarea>`;
    return `<div class="an-tri emergent">${cell('h', 'your new concept')}${cell('r', 'relation')}${cell('t', 'entity')}</div>`;
  }
  function draw() {
    let h = `<div class="an-colhead" style="margin-top:14px;"><span class="col">true of one of the two concepts, or of both</span><span class="bl-arrowhead"></span><span class="col">in your new concept</span><span class="an-rmbtn"></span></div>`;
    h += `<div class="an-row an-subhead"><div class="an-tri anlbl"><span>entity</span><span>relation</span><span>entity</span></div>` +
         `<span class="bl-arrow" style="visibility:hidden">&rarr;</span>` +
         `<div class="an-tri anlbl"><span>entity</span><span>relation</span><span>entity</span></div><span class="an-rmbtn"></span></div>`;
    proj.forEach((s, i) => {
      const rm = proj.length > 1 ? `<button type="button" class="kb-x an-rmbtn" data-rm="p:${i}"${blendSkip ? ' disabled' : ''}>&times;</button>` : '<span class="an-rmbtn"></span>';
      const src = s.from === 'uv' ? `<div class="bl-src">${ptri(i, s, 'src')}${ptri(i, s, 'src2')}</div>` : ptri(i, s, 'src');
      h += `<div class="an-rowwrap"><div class="an-row">${src}<span class="bl-arrow" title="becomes, in the new concept">&rarr;</span>${ptri(i, s, 'img')}${rm}</div>
        ${fromPicker(i, s)}</div>`;
    });
    h += `<div class="kb-add"><button type="button" id="addP"${blendSkip ? ' disabled' : ''}>+ add a link</button></div>`;
    h += GATE_HINT('the last step');
    h += `<div id="emerSection" hidden><hr class="an-divider">`;
    h += `<p class="kb-ask" style="margin:6px 0;">Describe something that is true of your new concept but of <b>neither</b> original concept on its own</p>`;
    h += `<div class="an-row an-subhead"><div class="an-tri anlbl"><span>entity</span><span>relation</span><span>entity</span></div><span class="an-rmbtn"></span></div>`;
    emer.forEach((s, i) => {
      const rm = emer.length > 1 ? `<button type="button" class="kb-x an-rmbtn" data-rm="e:${i}">&times;</button>` : '<span class="an-rmbtn"></span>';
      h += `<div class="an-rowwrap"><div class="an-row">${etri(i, s)}${rm}</div></div>`;
    });
    h += `<div class="kb-add"><button type="button" id="addE"${emerSkip ? ' disabled' : ''}>+ add another new link</button></div>`;
    h += `<label class="kb-skip"><input type="checkbox" name="skip_emergent"${emerSkip ? ' checked' : ''}> I can't think of anything new</label></div>`;
    host.innerHTML = h;
    host.querySelectorAll('[data-rm]').forEach(b => b.addEventListener('click', () => {
      sync(); const [p, idx] = b.dataset.rm.split(':'); (p === 'p' ? proj : emer).splice(+idx, 1); draw();
    }));
    host.querySelector('#addP').addEventListener('click', () => { sync(); proj.push(blank('')); draw(); });
    host.querySelector('#addE').addEventListener('click', () => { sync(); emer.push({ h: '', r: '', t: '' }); draw(); });
    host.querySelector('[name="skip_emergent"]').addEventListener('change', () => { sync(); draw(); });
    host.querySelectorAll('[name^="p_from_"]').forEach(rb => rb.addEventListener('change', () => { sync(); draw(); }));
    growAnalogyCells(host);
    host.querySelectorAll('.an-tri textarea').forEach(t => t.addEventListener('input', () => { t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }));
    // A projected link keeps its relation, so typing a relation in any cell of a row fills the row's other
    // relation cells as you type (they stay editable; editing any of them mirrors back).
    host.querySelectorAll('textarea[name^="p_sr_"], textarea[name^="p_s2r_"], textarea[name^="p_ir_"]').forEach(t => {
      t.addEventListener('input', () => {
        const i = t.name.match(/_(\d+)$/)[1];
        ['sr', 's2r', 'ir'].forEach(f => {
          const o = host.querySelector(`[name="p_${f}_${i}"]`);
          if (o && o !== t && o.value !== t.value) { o.value = t.value; o.style.height = 'auto'; o.style.height = o.scrollHeight + 'px'; }
        });
      });
    });
    gate();
  }
  // "What is new" appears only once the name, the abstract structure, and every link row (with its source
  // chosen) are filled in. With no blend at all there is no last step.
  function linksDone() {
    if (blendSkip) return false;
    const filled = (name) => { const el = form.querySelector(`[name="${name}"]`); return el && el.value.trim(); };
    if (!filled('blend_name') || !filled('generic_space')) return false;
    return proj.every((s, i) => s.from && rowFields(s).every(f => filled(`p_${f}_${i}`)));
  }
  function gate() {
    gateSection(host.querySelector('#emerSection'), linksDone, el => el.name === 'skip_emergent' || !emerSkip);
    const hint = host.querySelector('.kb-gate-hint');
    hint.textContent = blendSkip
      ? 'With no blend there is no last step; you can submit this item as it is.'
      : 'Once you have filled in the rows above, the last step will appear here.';
  }
  form.addEventListener('input', gate);
  // "I can't think of a blend": the name, the abstract structure and every link row are disabled (their text is
  // kept in case the box is unticked), and the last step never appears.
  const skipBlend = form.querySelector('[name="skip_blend"]');
  skipBlend.addEventListener('change', () => {
    sync();
    ['blend_name', 'generic_space'].forEach(n => { const el = form.querySelector(`[name="${n}"]`); if (el) el.disabled = blendSkip; });
    draw();
  });
  draw();
}

function makeTrial(stim, index, total) {
  return {
    type: jsPsychSurveyHtmlForm,
    html: trialHTML(stim, index, total),
    button_label: index === total - 1 ? 'Submit last one' : 'Submit & continue',
    data: { phase: 'task', task: stim.task, stimulus_id: stim.id, u: stim.u, v: stim.v || null, is_control: !!stim.control, position: index + 1, trap_word: trapWord(index) },
    on_load: () => {
      currentTask = stim.task;
      document.body.classList.toggle('an-trial', stim.task === 'analogy' || stim.task === 'blending');   // wide canvas for side-by-side triples
      pasteAttempts = 0; blockPasting(document.getElementById('jspsych-survey-html-form'));
      typingLog = startTypingLog(document.getElementById('jspsych-survey-html-form'));
      if (stim.task === 'association') wireAssociation(stim);
      else if (stim.task === 'analogy') wireAnalogyPaths(stim);
      else if (stim.task === 'blending') wireBlend(stim);
      // the worked example lives in a collapsed <details>; size its cells when it is opened
      document.querySelectorAll('details.kb-example').forEach(d => d.addEventListener('toggle', () => growAnalogyCells(d)));
    },
    on_finish: (data) => { data.clean = tidy(stim, data.response || {}); data.paste_attempts = pasteAttempts; data.typing = typingLog ? typingLog.summary() : null; }
  };
}

// Answers must be typed: paste and drop are blocked on every text field of a task page (the ID page is
// exempt), the participant sees a short notice, and the number of attempts is recorded with the trial.
let pasteAttempts = 0;
function blockPasting(form) {
  if (!form) return;
  const isField = (el) => el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && el.type === 'text'));
  ['paste', 'drop'].forEach(ev => form.addEventListener(ev, (e) => {
    if (!isField(e.target)) return;
    e.preventDefault(); pasteAttempts++;
    toast('Please type your answers rather than pasting them.');
  }, true));
}
// Typing dynamics per task page, for screening answers retyped from an AI: a person composing types in
// bursts with pauses and corrections; someone transcribing types steadily with few backspaces and a long
// silence before the first key. Only summary numbers are kept, never the keys themselves.
let typingLog = null;
function startTypingLog(form) {
  const t0 = performance.now();
  let keys = 0, backspaces = 0, first = null, last = null, prev = null;
  const ikis = [];   // inter-key intervals (ms) between consecutive keys, capped so idle gaps do not dominate
  const onKey = (e) => {
    const el = e.target; if (!el || !(el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && el.type === 'text'))) return;
    const now = performance.now();
    keys++; if (e.key === 'Backspace' || e.key === 'Delete') backspaces++;
    if (first === null) first = now;
    if (prev !== null) ikis.push(Math.min(now - prev, 5000));
    prev = now; last = now;
  };
  if (form) form.addEventListener('keydown', onKey, true);
  return { summary: () => {
    const sorted = [...ikis].sort((a, b) => a - b);
    const med = sorted.length ? sorted[Math.floor(sorted.length / 2)] : null;
    const chars = form ? [...form.querySelectorAll('textarea, input[type=text]')].filter(el => !el.readOnly).reduce((n, el) => n + (el.value || '').length, 0) : 0;
    return { keys, backspaces, chars, first_key_ms: first === null ? null : Math.round(first - t0),
             active_ms: (first === null || last === null) ? 0 : Math.round(last - first), median_iki_ms: med === null ? null : Math.round(med),
             pauses_over_2s: ikis.filter(x => x >= 2000).length };
  } };
}
let toastTimer = null;
function toast(msg) {
  let el = document.querySelector('.kb-toast');
  if (!el) { el = document.createElement('div'); el.className = 'kb-toast'; document.body.appendChild(el); }
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

// reshape the flat form response into a tidy per-task record
function tidy(stim, r) {
  const base = { task: stim.task, inferences: (r.inferences || '').trim(), honeypot: (r.hp_note || '').trim() };
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
    // direction per invention row: 'ab' = the u-side link is true and the v-side is invented; 'ba' = the reverse
    const projection = invRows.map((t, i) => {
      const dir = r['inv_dir_' + i] || null;
      const [source, image] = dir === 'ba' ? [t.b, t.a] : [t.a, t.b];
      return { source, image, direction: dir === 'ba' ? 'v_to_u' : dir === 'ab' ? 'u_to_v' : null };
    });
    const skipped = {};
    if (r.skip_invention) skipped.invention = true;
    const mapSteps = Object.keys(r).filter(k => /^skip_map_\d+$/.test(k) && r[k])
      .map(k => +k.match(/\d+/)[0]).sort((a, b) => a - b);
    if (mapSteps.length) skipped.map_steps = mapSteps;   // steps the participant marked "I don't know"
    return { ...base, u: stim.u, v: stim.v, path_a, path_b, projection,
      projected: projection[0] ? projection[0].source[0] : '', invention: projection[0] ? projection[0].image[0] : '', skipped };
  }
  // blending: link rows (source link(s) true of u, v or both -> the link in the new concept) + emergent triples.
  // Disabled rows (the whole blend skipped) are absent from the response, so the structure is then empty.
  const projRows = [];
  Object.keys(r).forEach(k => { const m = k.match(/^p_ih_(\d+)$/); if (!m) return; const i = m[1];
    const tri = (h, rel, t) => [r[h], r[rel], r[t]].map(x => (x || '').trim());
    const from = r['p_from_' + i] || null;
    const row = { from, triple: tri('p_ih_' + i, 'p_ir_' + i, 'p_it_' + i) };
    if (from === 'uv') { row.source_u = tri('p_sh_' + i, 'p_sr_' + i, 'p_st_' + i); row.source_v = tri('p_s2h_' + i, 'p_s2r_' + i, 'p_s2t_' + i); }
    else row.source = tri('p_sh_' + i, 'p_sr_' + i, 'p_st_' + i);
    projRows[+i] = row;
  });
  const emerRows = [];
  Object.keys(r).forEach(k => { const m = k.match(/^e_h_(\d+)$/); if (!m) return; const i = m[1];
    emerRows[+i] = { from: 'emergent',
      triple: [r['e_h_' + i], r['e_r_' + i], r['e_t_' + i]].map(x => (x || '').trim()) };
  });
  const structure = [...projRows.filter(Boolean), ...emerRows.filter(Boolean)];
  const skipped = {};
  if (r.skip_blend) skipped.blend = true;
  if (r.skip_emergent) skipped.emergent = true;
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
                ${BONUS_BANNER}
                <p>Dear Participant,</p>
                <p>Thank you for your interest in our research! We are researchers interested in understanding how people evaluate creative ideas.</p>
                <p><strong>Study Purpose:</strong> We are conducting research on how people make creative connections between ideas — linking distant concepts, drawing analogies, and fusing ideas into new concepts. This helps us understand what makes ideas creative and how to measure creativity.</p>
                <p><strong>What You Will Do:</strong> You will be shown ${(window.STIMULI || []).length} short prompts. For each, you will type a creative response — connecting two ideas with a chain, drawing an analogy, or fusing two ideas into a new concept. The study takes approximately 12-18 minutes.</p>
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

// Bonus reminder: shown on the consent page and again at the top of each task overview, so the incentive
// is in front of the participant right before each block (Akshay's suggestion).
const BONUS_BANNER = `<p style="margin: 0 0 24px; padding: 16px 20px; background: #fff6e0; border: 1px solid #e8c85a; border-left: 5px solid #e0a800; border-radius: 6px; font-size: 16px;">
                    <strong>🏆 Bonus:</strong> The most creative responses earn extra pay. If your responses rank in the
                    <strong>top 10% most creative</strong> across all participants, you will receive an <strong>additional $15 bonus</strong>.
                    So take your time and be as original as you can.</p>`;

const TASK_INTRO = {
  association: { color: '#1976d2', title: 'Association Task',
    desc: 'In this task, we will ask you to build up chains of associations. To build your chain you will begin with one thing (which we will call an &ldquo;entity&rdquo;) and then link it to another, and then likewise link that entity to another one. For each link we also want you to specify what the link corresponds to: the &ldquo;relation&rdquo; that connects the two entities. Each row in the example below is one link: an entity, the relation, and the entity it links to. The second entity of one row is the first entity of the next, so the rows form a chain. Try to use surprising, original, and unusual relations and entities rather than generic ones that other participants would pick.' },
  analogy: { color: '#f57c00', title: 'Analogy Task',
    desc: 'In this task, you are going to form an analogy. We will show you two concepts, highlighted at the top of the two columns (in the example below, <b>the blue whale</b> and <b>the mattress</b>). We want you to identify relationships that these two concepts share and what maps to what: in the first row, write a link from the first concept on the left and the matching link from the second concept on the right, using the <b>same relation</b> on both sides (the blue whale <i>is covered by</i> skin; the mattress <i>is covered by</i> sheets). Then extend the analogy to a related idea by adding another row that again uses the same relation on both sides (skin <i>hosts</i> barnacles; sheets <i>hosts</i> dust mites). Finally, once you find an analogy, we will ask you to <b>invent a new idea</b> by taking an entity and a relation from the concept on one side and projecting them over to the other side, replacing each entity with what it maps to (for example, a vacuum cleaner <i>removes</i> dust mites from a mattress, so a whale could have a whale groomer drone that <i>removes</i> barnacles). You can choose the direction with the arrow between the two sides, and the invented concept, which can be on either side, is shaded. Try to use surprising, original, and unusual relations and entities rather than generic ones that other participants would pick.' },
  blending: { color: '#388e3c', title: 'Blending Task',
    desc: 'In this task, you are going to blend two concepts into one new concept. We will show you two concepts, highlighted at the top (in the example below, <b>Democracy</b> and <b>Banking</b>). First, give your new concept a name. Then describe the <b>abstract structure that both concepts share</b>, which is what lets them be blended (here, a system that allocates fungible units of power). Be specific: &ldquo;both exist&rdquo; or &ldquo;both involve change&rdquo; does not count. Next, in each row, take a relationship that is true of one or both of the two concepts, and write what it becomes in your new concept on the right (Democracy <i>allocates</i> votes, so a Liquid Franchise <i>allocates</i> vote-shares). Try to have at least one link in your new concept that comes from <b>both</b> concepts, as in the first row of the example. Finally, below the line, add links that are true of your new concept but of neither of the original concepts on its own (a citizen can liquidate their own political personhood). Try to make a blend that is surprising and original rather than one that other participants would pick.' }
};

// The description for a task, shown immediately before that task's block of items (not all up front).
function createTaskIntro(task, n) {
  const t = TASK_INTRO[task];
  return {
    type: jsPsychInstructions, show_clickable_nav: true, button_label_next: `Start the ${task} prompts`,
    pages: [
      `<div style="max-width:${task === 'association' ? 720 : 900}px;margin:0 auto;text-align:left;"><h3 style="color:${t.color}">${t.title}</h3>
        ${BONUS_BANNER}
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
      <p>You've completed all ${(window.STIMULI || []).length} prompts.</p>
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
    responses: trials.map(t => ({ ...t.clean, rt: t.rt, stimulus_id: t.stimulus_id, is_control: t.is_control, position: t.position, paste_attempts: t.paste_attempts || 0, typing: t.typing || null, trap_word: t.trap_word, debug_skipped: !!t.debug_skipped }))
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

/* ------------------------------------------------------------ debug skipping */
// In debug mode (no PROLIFIC_PID) a small bar lets you skip the current page, or the rest of the current
// task's items, without filling anything in. Skipped trials are recorded with debug_skipped: true.
let currentTask = null;
const debugSkipTask = {};
function createDebugBar() {
  const bar = document.createElement('div'); bar.className = 'kb-debugbar';
  bar.innerHTML = `<span>DEBUG</span><button type="button" id="dbgSkipItem">Skip this page</button><button type="button" id="dbgSkipTask">Skip rest of task</button>`;
  document.body.appendChild(bar);
  const finish = () => jsPsych.finishTrial({ response: {}, debug_skipped: true });
  bar.querySelector('#dbgSkipItem').addEventListener('click', finish);
  bar.querySelector('#dbgSkipTask').addEventListener('click', () => { if (currentTask) debugSkipTask[currentTask] = true; finish(); });
}
// The well-known (control) item leads its block so participants start each task on an easy one; the real
// items follow in their listed order.
function orderBlock(items) {
  return [...items.filter(s => s.control), ...items.filter(s => !s.control)];
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
    // Within a block, the well-known (control) item comes first, then the real items in order.
    let idx = 0;
    ['association', 'analogy', 'blending'].forEach(task => {
      const items = orderBlock(stimuli.filter(s => s.task === task));
      if (!items.length) return;
      timeline.push(createTaskIntro(task, items.length));
      items.forEach(stim => {
        const trial = makeTrial(stim, idx, total); idx++;
        // wrapped so "skip rest of task" (debug) can drop the block's remaining items
        timeline.push({ timeline: [trial], conditional_function: () => !debugSkipTask[stim.task] });
      });
    });
    timeline.push(createCompletionScreen());
    if (isDebugMode) timeline.push(createDataDisplayScreen());
    if (isDebugMode) createDebugBar();

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
