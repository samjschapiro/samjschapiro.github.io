/* ============================================================================
   AGC — human study.

   Three tasks on 2x2 rule matrices. A grid is built from a seed cell by an
   ACROSS rule and a DOWN rule; the fourth cell is both applied.

     ABDUCTION      both rules withheld; name a pair that would produce the grid.
                    Many pairs fit — there is no single right answer.
     CREATION       one grid shown with its rules named; invent your own pair and
                    draw the result from the same seed. Novelty = Hamming
                    distance from the shown grid.
     TRANSFORMATION the grid and the rule that made it; find a different rule
                    that explains the same grid, draw what it predicts next, then
                    a figure separating the two. Radicality = distance between
                    the two rules on that figure.

   Screen order: ID (non-Prolific only) -> consent -> instructions -> quiz ->
   blocks -> submit -> completion -> raw data (debug only).
   ========================================================================= */

// --- deployment constants ------------------------------------------------------
// Where completed sessions are POSTed.
//   localhost      -> '/submitData', the endpoint `server/serve.py` implements.
//   anywhere else  -> '' until a backend is deployed (see backend/ and deploy.sh).
// An empty URL is NOT a silent no-op: it makes the app say "nothing is being
// recorded" on the consent screen and again on the completion screen, so a
// published preview can never be mistaken for live data collection.
const IS_LOCAL = ['localhost', '127.0.0.1', ''].includes(window.location.hostname);
const DATA_SUBMISSION_URL = IS_LOCAL ? '/submitData' : '';
const COMPLETION_URL = '';        // Prolific completion URL, e.g. 'https://app.prolific.com/submissions/complete?cc=XXXXXXXX'

const PER_TASK   = { abduce: 3, create: 2, transform: 1 };
const TASK_ORDER = ['abduce', 'create', 'transform'];
const CONSENT_VERSION = 'agc_v1';
const TOTAL_SLOTS = 40;          // must match the backend's TOTAL_SLOTS

let jsPsych;
let participantId = null, isProlificParticipant = false, isDebugMode = false;
let prolificCompletionURL = null, studyId = null, prolificSessionId = null;
let participantSlot = 0;
let submissionResult = { status: 'pending' };

// Three ways in, and which one it is is always explicit — never inferred from a
// missing value:
//   ?PROLIFIC_PID=... (+ STUDY_ID, SESSION_ID)  a real Prolific participant; no ID screen
//   ?DEBUG=1                                     a UI walkthrough: ID pre-filled, quiz
//                                                pre-answered, raw data shown at the end
//   neither                                      recruited outside Prolific; they type an ID
function initializeParticipant() {
  const q = new URLSearchParams(window.location.search);
  isDebugMode = q.get('DEBUG') === '1';
  studyId = q.get('STUDY_ID');
  prolificSessionId = q.get('SESSION_ID');
  const pid = q.get('PROLIFIC_PID');
  if (pid) {
    isProlificParticipant = true;
    participantId = pid;
    prolificCompletionURL = COMPLETION_URL;
  }
  // The slot picks which items this participant sees, and the timeline is built
  // before the ID screen runs — so it is derived from the Prolific ID when we
  // have one and drawn at random otherwise. Either way coverage stays even.
  participantSlot = isProlificParticipant
    ? slotFor(participantId, TOTAL_SLOTS)
    : Math.floor(Math.random() * TOTAL_SLOTS);
}

/* ------------------------------------------------------------------ helpers */
const G = window.AGCGrid;
const BANK = window.AGC_ITEMS;

function esc(s) {
  return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/"/g, '&quot;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function progressBar(step, total) {
  const pct = (step / total) * 100;
  return `<div class="tb-progress">Step ${step} of ${total}</div>
    <div class="tb-bar"><div style="width:${pct}%"></div></div>`;
}
function plural(n, one, many) { return n === 1 ? one : many; }

/* Slot is derived from the participant ID, so the same person always gets the
   same items and coverage stays even without a round-trip to the backend. */
function slotFor(id, totalSlots) {
  let h = 0;
  for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % totalSlots;
}
function itemsForSlot(bank, n, slot) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(bank[(slot * n + i) % bank.length]);
  return out;
}

/* ------------------------------------------------------------ shared markup */
function ruleBoxes(p) {
  return `<div class="rulepair">
    <div class="rulebox">
      <div class="rulehd"><span class="gy" aria-hidden="true">&rarr;</span>
        <label class="ax" for="${p}rowname">across rule</label></div>
      <input type="text" id="${p}rowname" name="${p}rowname" autocomplete="off" placeholder="name it">
      <textarea id="${p}rowdesc" name="${p}rowdesc" placeholder="what it does, left to right"
        aria-label="across rule, description"></textarea>
    </div>
    <div class="rulebox">
      <div class="rulehd"><span class="gy" aria-hidden="true">&darr;</span>
        <label class="ax" for="${p}colname">down rule</label></div>
      <input type="text" id="${p}colname" name="${p}colname" autocomplete="off" placeholder="name it">
      <textarea id="${p}coldesc" name="${p}coldesc" placeholder="what it does, top to bottom"
        aria-label="down rule, description"></textarea>
    </div>
  </div>`;
}
function toolbar(p) {
  return `<div class="toolbar">
      <div class="pal" id="${p}pal"></div>
      <div class="acts">
        <button type="button" id="${p}undo"><span class="ic">&#8630;</span>undo</button>
        <button type="button" id="${p}clear"><span class="ic">&#8635;</span>clear</button>
      </div>
    </div>
    <p class="tip">click or drag to paint &nbsp;&middot;&nbsp; <kbd>alt</kbd>-click to erase
      &nbsp;&middot;&nbsp; <kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> pick a colour</p>`;
}
function ruleRows(rn, rd, cn, cd) {
  return `<div class="exdesc">
    <div><b aria-hidden="true">&rarr;</b><span><span class="nm">${esc(rn)}</span> &mdash; ${esc(rd)}</span></div>
    <div style="margin-top:9px"><b aria-hidden="true">&darr;</b><span><span class="nm">${esc(cn)}</span> &mdash; ${esc(cd)}</span></div>
  </div>`;
}
function readRules(p) {
  const v = id => { const el = document.getElementById(p + id); return el ? el.value.trim() : ''; };
  return { row_name: v('rowname'), row_desc: v('rowdesc'),
           col_name: v('colname'), col_desc: v('coldesc') };
}
const rulesComplete = r => !!(r.row_name && r.row_desc && r.col_name && r.col_desc);

/* Block the form's submit until the trial is answered, the way the ID and quiz
   screens do, rather than disabling the continue button with no explanation. */
function gateSubmit(check, errorId) {
  const form = document.querySelector('#jspsych-survey-html-form');
  const error = document.getElementById(errorId || 'trialError');
  form.addEventListener('submit', (e) => {
    const msg = check();
    if (!msg) { error.textContent = ''; return; }
    e.preventDefault(); e.stopPropagation();
    error.textContent = msg;
  }, true);
}

function wireTools(p, state, redraw) {
  G.makePalette(document.getElementById(p + 'pal'), state);
  const undoBtn = document.getElementById(p + 'undo');
  const setUndo = () => { undoBtn.disabled = state.undo.length === 0; };
  state.push = () => {
    state.undo.push(state.snapshot());
    if (state.undo.length > 80) state.undo.shift();
    setUndo();
  };
  undoBtn.onclick = () => {
    if (!state.undo.length) return;
    state.restore(state.undo.pop()); redraw(); setUndo();
  };
  const clr = document.getElementById(p + 'clear');
  if (clr) clr.onclick = () => { state.push(); state.reset(); redraw(); };
  setUndo();
  state.onKey = e => {
    const t = e.target && e.target.tagName;
    if (t === 'INPUT' || t === 'TEXTAREA') return;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undoBtn.click(); return; }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= BANK.Q) { e.preventDefault(); state.paint = n - 1; G.syncPalettes(); }
  };
  document.addEventListener('keydown', state.onKey);
}
function unwire(state) {
  if (state && state.onKey) document.removeEventListener('keydown', state.onKey);
  G.forget();
}

/* ------------------------------------------------------------------ trials */
function abductionTrial(item, step, total) {
  const scratch = { task: 'abduction', item_id: item.id };
  return {
    type: jsPsychSurveyHtmlForm,
    button_label: 'Continue',
    data: { phase: 'task', task: 'abduction', item_id: item.id },
    html: `<div class="tb-wrap">${progressBar(step, total)}
      <p class="eyebrow">Abduction</p>
      <h1>What rules would produce this grid?</h1>
      <div class="steps">
        <section class="stepcol">
          <h2 class="step"><span class="n">1</span>The grid</h2>
          <div id="aboard"></div>
        </section>
        <section class="stepcol">
          <h2 class="step"><span class="n">2</span>Your rules</h2>
          ${ruleBoxes('a')}
        </section>
      </div>
      <div class="tb-required" id="trialError"></div></div>`,
    on_load: () => {
      window.scrollTo(0, 0);
      G.matrix(document.getElementById('aboard'), item.cells.map(G.parse), 34, 22, true);
      gateSubmit(() => rulesComplete(readRules('a'))
        ? '' : 'Please name and describe both rules before continuing.');
      scratch.t0 = performance.now();
    },
    on_finish: (data) => {
      scratch.rules = readRules('a');
      scratch.rt_ms = Math.round(performance.now() - scratch.t0);
      delete scratch.t0;
      scratch.generated_by = item.ref;    // for analysis only; not a key to mark against
      data.clean = scratch;
      unwire(null);
    }
  };
}

function creationTrial(item, step, total) {
  const seed = G.parse(item.cells[0]);
  const cells = [seed.slice(), G.blank(), G.blank(), G.blank()];
  const refScored = item.cells.slice(1).join('').split('').map(Number);
  const state = {
    paint: 1, undo: [], push: null,
    snapshot: () => cells.map(c => c.slice()),
    restore: s => s.forEach((c, i) => { cells[i] = c.slice(); }),
    reset: () => { for (let i = 1; i < 4; i++) cells[i] = G.blank(); }
  };
  const scratch = { task: 'creation', item_id: item.id };
  let cv = [];
  const redraw = () => cv.forEach((c, i) => G.draw(c, cells[i], 46));

  return {
    type: jsPsychSurveyHtmlForm,
    button_label: 'Continue',
    data: { phase: 'task', task: 'creation', item_id: item.id },
    html: `<div class="tb-wrap">${progressBar(step, total)}
      <p class="eyebrow">Creation</p>
      <h1>Invent rules that create as different a grid as possible, given the same starting cell.</h1>
      <div class="steps">
        <section class="stepcol">
          <h2 class="step"><span class="n">1</span>Name your two rules</h2>
          ${ruleBoxes('c')}
        </section>
        <section class="stepcol">
          <h2 class="step"><span class="n">2</span>Draw your grid</h2>
          <div class="extend">
            <div class="framed"><div class="sidelab">the existing grid</div>
              <div class="ex" id="cref"></div></div>
            <div class="framed"><div class="sidelab">yours</div>
              <div id="cboard"></div></div>
          </div>
          ${toolbar('c')}
        </section>
      </div>
      <div class="tb-required" id="trialError"></div></div>`,
    on_load: () => {
      window.scrollTo(0, 0);
      const ref = document.getElementById('cref');
      G.matrix(ref, item.cells.map(G.parse), 27, 22, false);
      ref.insertAdjacentHTML('beforeend', ruleRows(item.row, item.rowdef, item.col, item.coldef));

      cv = G.matrix(document.getElementById('cboard'), cells, 46, 26, true);
      cv[0].className = 'given';
      [1, 2, 3].forEach(i => {
        cv[i].className = '';
        G.paintable(cv[i], 46, () => cells[i], () => {}, state);
      });
      wireTools('c', state, redraw);
      gateSubmit(() => {
        if (!rulesComplete(readRules('c'))) return 'Please name and describe both rules.';
        if (!cells.slice(1).some(c => c.some(v => v !== 0)))
          return 'Please draw the three cells your rules produce.';
        return '';
      });
      scratch.t0 = performance.now();
    },
    on_finish: (data) => {
      scratch.rules = readRules('c');
      scratch.seed = item.cells[0];
      scratch.grid = [1, 2, 3].map(i => G.str(cells[i]));
      scratch.novelty = +G.dist([].concat(cells[1], cells[2], cells[3]), refScored).toFixed(4);
      scratch.reference_grid = item.cells;
      scratch.reference_rules = { row: item.row, col: item.col };
      scratch.rt_ms = Math.round(performance.now() - scratch.t0);
      delete scratch.t0;
      data.clean = scratch;
      unwire(state);
    }
  };
}

function transformationTrial(item, step, total) {
  const TGT = item.cells.map(G.parse);
  const ACONT = item.cont.map(G.parse);
  const RULE_A = item.ops.map(k => G.OPS[k]);
  let nextCol = ACONT.map(g => g.slice());
  const fig = { src: G.blank(), out: [G.blank(), G.blank()], touched: [false, false] };
  const state = {
    paint: 1, undo: [], push: null,
    snapshot: () => ({ n: nextCol.map(g => g.slice()), s: fig.src.slice(),
                       o: fig.out.map(g => g.slice()), t: fig.touched.slice() }),
    restore: s => { nextCol = s.n.map(g => g.slice()); fig.src = s.s.slice();
                    fig.out = s.o.map(g => g.slice()); fig.touched = s.t.slice(); },
    reset: () => { nextCol = ACONT.map(g => g.slice()); }
  };
  const scratch = { task: 'transformation', item_id: item.id };
  let nextCv = [], figCv = null, myCv = [], refCv = [];

  const drawn = () => nextCol.some((g, r) => g.some((v, i) => v !== ACONT[r][i]));
  const figReady = () => fig.src.some(v => v !== 0) && fig.touched[0] && fig.touched[1];
  const redraw = () => {
    nextCv.forEach((c, r) => G.draw(c, nextCol[r], 42));
    if (figCv) {
      G.draw(figCv, fig.src, 34);
      myCv.forEach((c, r) => G.draw(c, fig.out[r], 34));
      refCv.forEach((c, r) => G.draw(c, RULE_A[r](fig.src), 34));
    }
  };

  return {
    type: jsPsychSurveyHtmlForm,
    button_label: 'Continue',
    data: { phase: 'task', task: 'transformation', item_id: item.id },
    html: `<div class="tb-wrap">${progressBar(step, total)}
      <p class="eyebrow">Transformation</p>
      <h1>Provide a different rule that explains the same grid.</h1>
      <div class="steps">
        <section class="stepcol">
          <h2 class="step"><span class="n">1</span>Name your rule</h2>
          ${ruleBoxes('t')}
        </section>
        <section class="stepcol">
          <h2 class="step"><span class="n">2</span>Fill in the two cells</h2>
          <div class="extend">
            <div class="ex" id="tcard"></div>
            <div class="ar" style="font-size:45px" aria-hidden="true">&rarr;</div>
            <div class="drawcol" id="tdraw"></div>
          </div>
          ${toolbar('t')}
        </section>
        <section class="stepcol locked" id="tstep3">
          <h2 class="step"><span class="n">3</span>Your figure</h2>
          <p class="cap">draw a figure, then what <em>your</em> rule does to it &mdash;
            choose one that makes the two rules look as different as possible</p>
          <div class="slot" id="tslot"></div>
        </section>
      </div>
      <div class="tb-required" id="trialError"></div></div>`,
    on_load: () => {
      window.scrollTo(0, 0);
      const card = document.getElementById('tcard');
      G.matrix(card, TGT, 27, 22, false);
      card.insertAdjacentHTML('beforeend', ruleRows(item.row, item.rowdef, item.col, item.coldef));

      const dr = document.getElementById('tdraw');
      [0, 1].forEach(r => {
        if (r) {
          const g = document.createElement('div'); g.className = 'g';
          g.textContent = '↓'; g.setAttribute('aria-hidden', 'true'); dr.appendChild(g);
        }
        const w = document.createElement('div'); w.className = 'agc-cellw';
        const c = document.createElement('canvas');
        c.setAttribute('aria-label', `your cell, across applied 2 times, down applied ${r} times`);
        w.appendChild(c);
        const l = document.createElement('div'); l.className = 'agc-cl';
        l.textContent = '→2 · ↓' + r; w.appendChild(l);
        dr.appendChild(w); nextCv.push(c);
        G.paintable(c, 42, () => nextCol[r], refreshGate, state);
      });

      const slot = document.getElementById('tslot');
      const mkc = (area, label, paint, get) => {
        const c = document.createElement('canvas'); c.style.gridArea = area;
        c.setAttribute('aria-label', label); slot.appendChild(c);
        if (paint) G.paintable(c, 34, get, refreshGate, state); else G.draw(c, get(), 34);
        return c;
      };
      const txt = (area, cls, t) => {
        const d = document.createElement('div'); d.style.gridArea = area;
        d.className = cls; d.textContent = t; slot.appendChild(d); return d;
      };
      txt('hd', 'hd', 'Your figure');
      txt('yh', 'colh', 'yours'); txt('ah', 'colh', 'existing rule');
      txt('gr', 'gl', '→'); txt('gd', 'gl', '↓');
      figCv = mkc('src', 'your figure', true, () => fig.src);
      myCv = [
        mkc('myr', 'your rule, across', true, () => { fig.touched[0] = true; return fig.out[0]; }),
        mkc('myd', 'your rule, down',   true, () => { fig.touched[1] = true; return fig.out[1]; })
      ];
      refCv = [
        mkc('ar', 'the existing rule, across', false, () => RULE_A[0](fig.src)),
        mkc('ad', 'the existing rule, down',   false, () => RULE_A[1](fig.src))
      ];

      wireTools('t', state, redraw);
      function refreshGate() {
        redraw();
        const open = rulesComplete(readRules('t')) && drawn();
        document.getElementById('tstep3').classList.toggle('locked', !open);
      }
      ['trowname', 'trowdesc', 'tcolname', 'tcoldesc']
        .forEach(id => document.getElementById(id).addEventListener('input', refreshGate));
      refreshGate();

      gateSubmit(() => {
        if (!rulesComplete(readRules('t'))) return 'Please name and describe both parts of your rule.';
        if (!drawn()) return 'Please change at least one cell — as drawn, your rule agrees with the existing one.';
        if (!figReady()) return 'Please draw a figure and both of the answers your rule gives for it.';
        return '';
      });
      scratch.t0 = performance.now();
    },
    on_finish: (data) => {
      scratch.rules = readRules('t');
      scratch.next_column = nextCol.map(G.str);
      scratch.next_column_distance =
        +((G.dist(nextCol[0], ACONT[0]) + G.dist(nextCol[1], ACONT[1])) / 2).toFixed(4);
      scratch.figure = G.str(fig.src);
      scratch.figure_answers = fig.out.map(G.str);
      scratch.existing_rule_answers = [G.str(RULE_A[0](fig.src)), G.str(RULE_A[1](fig.src))];
      scratch.existing_rule = { row: item.row, col: item.col };
      scratch.radicality = figReady()
        ? +(((G.dist(fig.out[0], RULE_A[0](fig.src)) + G.dist(fig.out[1], RULE_A[1](fig.src))) / 2)).toFixed(4)
        : 0;
      scratch.rt_ms = Math.round(performance.now() - scratch.t0);
      delete scratch.t0;
      data.clean = scratch;
      unwire(state);
    }
  };
}

/* ------------------------------------------------------------------ ID screen */
// Prolific participants are identified by the URL, so they never see this.
// Everyone else types an ID, which is the only key their data is stored under —
// so it is validated here rather than silently accepting a blank.
let _debugId = null;
function debugId() {
  if (!_debugId) _debugId = `DEBUG-${Date.now().toString(36)}`;
  return _debugId;
}
function createIdScreen() {
  return {
    type: jsPsychSurveyHtmlForm,
    button_label: 'Begin',
    data: { phase: 'id' },
    html: `<div class="tb-wrap tb-narrow">
      <h1 class="tb-title">AGC &mdash; Rules on Grids</h1>
      <p class="tb-lede">A study about inventing and explaining rules. Before you begin, please
        enter the participant ID you were given.</p>
      <div class="tb-field">
        <label for="pid">Participant ID</label>
        <input type="text" id="pid" name="participant_id" autocomplete="off" spellcheck="false"
               placeholder="e.g. AGC-014" value="${isDebugMode ? esc(debugId()) : ''}">
        <span class="tb-note">Letters, numbers, hyphens and underscores; at least 3 characters.
          If you don't have one, ask the researcher &mdash; your data cannot be matched without it.</span>
      </div>
      <div class="tb-field">
        <label for="pid2">Confirm participant ID</label>
        <input type="text" id="pid2" name="participant_id_confirm" autocomplete="off" spellcheck="false"
               value="${isDebugMode ? esc(debugId()) : ''}">
      </div>
      ${isDebugMode ? '<p class="tb-banner">Debug mode &mdash; ID pre-filled, quiz pre-answered, and your raw data is shown at the end.</p>' : ''}
      <div class="tb-required" id="idError"></div>
    </div>`,
    on_load: () => { window.scrollTo(0, 0); wireIdValidation(); },
    on_finish: (data) => {
      participantId = data.response.participant_id.trim();
      data.participant_id = participantId;
    }
  };
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
function createConsentScreen(nTrials, minutes) {
  return {
    type: jsPsychInstructions,
    show_clickable_nav: true,
    button_label_next: 'I Consent and Agree to Participate',
    pages: [`<div style="width:800px;font-size:16px;text-align:left;margin:0 auto;padding:40px 0;">
        <div style="text-align:center;margin-bottom:30px;">
          <h1 style="font-size:24px;margin-bottom:10px;">Creativity Evaluation Study</h1>
          <p style="color:#666;font-size:16px;">Research Consent Form</p>
        </div>
        ${DATA_SUBMISSION_URL ? '' : `<p class="tb-preview"><strong>Preview.</strong>
          This is a demonstration of the study interface. <strong>Nothing you do here is
          recorded</strong> &mdash; no responses are saved and no data leaves your browser.
          Please don't treat it as a real session.</p>`}
        <p>Dear Participant,</p>
        <p>Thank you for your interest in our research! We are researchers interested in how people
           invent and explain rules.</p>
        <p><strong>Study Purpose:</strong> We study how people come up with rules that explain a
           pattern, and how they invent new ones. This helps us understand creative thinking and how
           to measure it automatically.</p>
        <p><strong>What You Will Do:</strong> You will see small coloured grids built by applying two
           rules &mdash; one across, one down. Across ${nTrials} ${plural(nTrials, 'screen', 'screens')}
           you will name rules that could have produced a grid, invent your own rules and draw what
           they produce, and find a second rule that explains a grid someone else already explained.
           There are no right answers. The study takes approximately
           ${minutes.lo}&ndash;${minutes.hi} minutes.</p>
        <p><strong>Data We Collect:</strong>
          <br>&bull; The rules you write and the grids you draw
          <br>&bull; Your participant or Prolific ID, for compensation and data management
          <br>&bull; Timestamps, including how long you spent on each screen
          <br>&bull; Basic technical information (browser type, screen resolution)
          <br>We do NOT collect any personally identifiable information beyond your ID.</p>
        <p><strong>Data Use and Storage:</strong> Your data will be:
          <br>&bull; Stored securely on encrypted servers for up to 7 years for research purposes
          <br>&bull; Used to validate automated creativity scoring methods
          <br>&bull; Potentially shared in anonymised form with other researchers or made publicly
                    available for scientific transparency
          <br>&bull; Processed under legitimate research interest as permitted by GDPR and data
                    protection laws</p>
        <p><strong>Your Rights:</strong> Your participation is completely voluntary. You may:
          <br>&bull; Refuse to participate without penalty
          <br>&bull; Withdraw at any time by closing your browser
          <br>&bull; Request deletion of your data by contacting us with your ID within 30 days
          <br>&bull; Contact your local data protection authority with any concerns</p>
        <p><strong>Risks and Benefits:</strong> There are no risks beyond those of normal computer
           use. The task involves drawing on small coloured grids. Your participation contributes to
           research on understanding creativity. You will be compensated according to the standard
           rate for the platform you were recruited through.</p>
        <p><strong>Contact:</strong> For questions about this study, contact the research team. For
           questions about your rights as a participant, contact your local research ethics
           committee or data protection authority.</p>
        <p style="margin-top:30px;padding:20px;background:#f0f8ff;border-left:4px solid #007bff;">
          <strong>Informed Consent Statement:</strong><br>
          I understand the information provided above about this research study. I understand:
          <br>&bull; The purpose of the study and what I will be asked to do
          <br>&bull; What data will be collected and how it will be used
          <br>&bull; My rights including the ability to withdraw at any time
          <br>&bull; How my data will be stored and potentially shared
          <br><br>
          I am 18 years of age or older and voluntarily agree to participate in this study.
        </p>
      </div>`],
    on_finish: () => {
      window.consentData = {
        participant_id: participantId,
        consent_timestamp: new Date().toISOString(),
        consent_given: true,
        consent_version: CONSENT_VERSION
      };
    }
  };
}

/* The primer is interactive rather than prose: the participant paints the seed
   and watches the other three cells follow from the two rules. It doubles as a
   tutorial for the painting controls they need in every task, so the first time
   they use them is not on a scored trial. */
const PRIMER_RULES = { across: 'mirror', down: 'gravity' };
const PRIMER_TEXT = {
  across: ['Reflection', 'the picture mirrors left to right'],
  down:   ['Gravity',    'every cell falls until it hits the floor']
};
const PRIMER_SEED = '0110001000000000000000000';

function createPrimerScreen() {
  const seed = G.parse(PRIMER_SEED);
  const across = G.OPS[PRIMER_RULES.across], down = G.OPS[PRIMER_RULES.down];
  const cells = () => [seed, across(seed), down(seed), down(across(seed))];
  const state = {
    paint: 1, undo: [], push: null,
    snapshot: () => seed.slice(),
    restore: s => { for (let i = 0; i < s.length; i++) seed[i] = s[i]; },
    reset: () => { for (let i = 0; i < seed.length; i++) seed[i] = 0; }
  };
  let cv = [], edits = 0;

  return {
    type: jsPsychSurveyHtmlForm,
    button_label: 'Next',
    data: { phase: 'primer' },
    html: `<div class="tb-wrap">
      <h2 style="margin:0 0 6px">How these grids are built</h2>
      <p class="tb-lede">Every grid starts from one cell in the <b>top left</b>. An
        <b>across rule</b> makes the cell to its right, a <b>down rule</b> makes the cell below,
        and applying both gives the fourth. The label under each cell says how many times each rule
        was applied to reach it &mdash; so <b>&rarr;1 &middot; &darr;0</b> means "the across rule
        once, the down rule not at all".</p>
      <div class="primer">
        <div class="framed">
          <div class="sidelab">paint in this cell &mdash; the rest follow</div>
          <div id="pboard"></div>
        </div>
        <div class="ex" id="prules"></div>
      </div>
      ${toolbar('p')}
      <p class="cap" style="max-width:60ch;margin:6px auto 0">Try it: paint or erase a few cells in
        the top-left grid and watch the other three change. Nothing here is recorded.</p>
      <div class="tb-required" id="primerError"></div>
    </div>`,
    on_load: () => {
      window.scrollTo(0, 0);
      cv = G.matrix(document.getElementById('pboard'), cells(), 46, 26, true);
      const redraw = () => { const c = cells(); cv.forEach((x, i) => G.draw(x, c[i], 46)); };
      cv.forEach((c, i) => { c.className = i === 0 ? '' : 'given'; });
      G.paintable(cv[0], 46, () => seed, () => { edits += 1; redraw(); }, state);
      document.getElementById('prules').innerHTML =
        ruleRows(PRIMER_TEXT.across[0], PRIMER_TEXT.across[1],
                 PRIMER_TEXT.down[0], PRIMER_TEXT.down[1]);
      wireTools('p', state, redraw);
      redraw();
      // A floor, not a target: it only checks the painting control was used at
      // least once, so nobody meets it for the first time on a scored trial.
      // No gate in debug mode — there is no participant in a walkthrough.
      gateSubmit(() => (isDebugMode || edits > 0)
        ? '' : 'Have a go first — paint or erase a cell in the top-left grid.', 'primerError');
    },
    on_finish: (data) => { data.edits = edits; unwire(state); }
  };
}

function createInstructionsScreen() {
  return {
    type: jsPsychInstructions, show_clickable_nav: true,
    button_label_previous: 'Back', button_label_next: 'Next',
    pages: [
      `<div class="instr"><h2>The three tasks</h2>
        <p>There are three kinds of screen. Each is explained again just before it starts.</p>
        <p>Wherever you draw, the controls are the same as the ones you just used: click or drag to
           paint, <kbd>alt</kbd>-click to erase, and the keys
           <kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> pick a colour.</p></div>`,
      `<div class="instr"><span class="tk">Task 1 &mdash; Abduction</span>
        <h2>What rules would produce this?</h2>
        <p>You see a finished grid. The rules that made it are hidden. Name any pair of rules that
           <em>would</em> have produced it.</p>
        <p><b>Many different pairs fit.</b> There is no single right answer, and we are not marking
           you against a hidden key &mdash; simpler explanations are better ones.</p></div>`,
      `<div class="instr"><span class="tk">Task 2 &mdash; Creation</span>
        <h2>Make a grid unlike the one shown</h2>
        <p>One grid is shown with its two rules named. Invent two rules of your own, then draw what
           they produce starting from the <em>same</em> first cell.</p>
        <p>Aim to land as far from the existing grid as you can &mdash; but the grid you draw should
           really be what your rules produce.</p></div>`,
      `<div class="instr"><span class="tk">Task 3 &mdash; Transformation</span>
        <h2>A second rule for the same grid</h2>
        <p>A grid is shown together with the rule that made it. Find a <em>different</em> rule that
           explains the same grid.</p>
        <p>Name it, draw what it predicts for the next column along, and then draw a small figure of
           your own plus what your rule does to it &mdash; choosing a figure that makes the two rules
           look as different as possible.</p></div>`
    ]
  };
}

/* --------------------------------------------------------- instructions quiz */
// A comprehension gate on the instructions: every item must be right before the
// first grid appears, with a correction on anything wrong. Items cover task
// MECHANICS only. Deliberately mixed keying, so agreeing with everything fails.
const QUIZ = [
  { name: 'q_start', type: 'tf', answer: 'true',
    prompt: 'Every grid starts from the cell in the top left.',
    feedback: 'Not quite — the top-left cell is the starting point, and the rules build the rest from it.' },
  { name: 'q_unique', type: 'tf', answer: 'false',
    prompt: 'In the first task, there is exactly one correct pair of rules for each grid.',
    feedback: 'Not quite — many different pairs of rules can produce the same grid. There is no hidden key.' },
  { name: 'q_similar', type: 'tf', answer: 'false',
    prompt: 'When you invent your own rules, you should try to make your grid look as similar as possible to the one shown.',
    feedback: 'Not quite — the opposite. Aim to land as far from the grid shown as you can.' },
  { name: 'q_label', type: 'mc', answer: 'once_none',
    prompt: 'A cell labelled <b>&rarr;1 &middot; &darr;0</b> is the one you get by applying:',
    options: [
      { value: 'once_none', label: 'the across rule once, and the down rule not at all' },
      { value: 'none_once', label: 'the down rule once, and the across rule not at all' },
      { value: 'both_once', label: 'both rules once each' },
      { value: 'across_ten', label: 'the across rule ten times' }
    ],
    feedback: 'Not quite — the number after each arrow is how many times that rule was applied.' }
];

function quizItemHTML(item, i) {
  const opts = item.type === 'tf'
    ? [{ value: 'true', label: 'True' }, { value: 'false', label: 'False' }]
    : item.options;
  return `<div class="tb-quiz-item" data-item="${item.name}">
      <div class="tb-quiz-q"><span class="tb-quiz-n">${i + 1}</span><span>${item.prompt}</span></div>
      <div class="tb-quiz-opts ${item.type}">
        ${opts.map(o => `<label class="tb-quiz-opt">
            <input type="radio" name="${item.name}" value="${o.value}"
              ${isDebugMode && o.value === item.answer ? 'checked' : ''}>
            <span class="card">${esc(o.label)}</span></label>`).join('')}
      </div>
      <div class="tb-quiz-fb"></div>
    </div>`;
}

function createQuizScreen() {
  let attempts = 0;
  return {
    type: jsPsychSurveyHtmlForm,
    button_label: 'Check my answers',
    data: { phase: 'quiz' },
    html: `<div class="tb-wrap tb-quiz">
      <h2 style="margin:0 0 6px">Before you start</h2>
      <p class="tb-lede">Four quick questions, just to check the instructions were clear. You can go
        back and re-read them if you need to.</p>
      ${QUIZ.map(quizItemHTML).join('')}
      <div class="tb-required" id="quizError"></div>
    </div>`,
    on_load: () => {
      window.scrollTo(0, 0);
      const form = document.querySelector('#jspsych-survey-html-form');
      const error = document.getElementById('quizError');
      const btn = document.querySelector('#jspsych-survey-html-form-next');
      form.addEventListener('submit', (e) => {
        const picked = n => form.querySelector(`input[name="${n}"]:checked`);
        const unanswered = QUIZ.filter(q => !picked(q.name));
        const wrong = QUIZ.filter(q => picked(q.name) && picked(q.name).value !== q.answer);
        attempts += 1;
        // Mark every item every time, so a correction never lingers beside a fixed answer.
        QUIZ.forEach(q => {
          const row = form.querySelector(`[data-item="${q.name}"]`);
          const fb = row.querySelector('.tb-quiz-fb');
          const sel = picked(q.name);
          row.classList.remove('is-wrong', 'is-right');
          if (!sel) { fb.textContent = ''; return; }
          const ok = sel.value === q.answer;
          row.classList.add(ok ? 'is-right' : 'is-wrong');
          fb.textContent = ok ? '' : q.feedback;
        });
        if (unanswered.length === 0 && wrong.length === 0) { error.textContent = ''; return; }
        e.preventDefault(); e.stopPropagation();
        error.textContent = unanswered.length
          ? 'Please answer every question.'
          : 'Not quite — have another look at the ones marked below, then try again.';
        if (btn) btn.value = 'Try again';   // <input type="submit">, so .value not .textContent
        (form.querySelector('.is-wrong') || form.querySelector('.tb-quiz-item'))
          .scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, true);
    },
    on_finish: (data) => { data.attempts = attempts; data.answers = { ...data.response }; }
  };
}

/* --------------------------------------------------------------- block intro */
const BLOCK_INTRO = {
  abduce: { tk: 'Task 1 — Abduction', h: 'What rules would produce this grid?',
    p: 'You will see a finished grid with its rules hidden. Name any pair of rules that would have produced it. Many pairs fit; simpler ones are better.' },
  create: { tk: 'Task 2 — Creation', h: 'Make a grid unlike the one shown',
    p: 'You will see one grid with its rules named. Invent two rules of your own and draw what they produce from the same first cell, landing as far from the grid shown as you can.' },
  transform: { tk: 'Task 3 — Transformation', h: 'A second rule for the same grid',
    p: 'You will see a grid together with the rule that made it. Find a different rule that explains the same grid, draw what it predicts next, then a figure that makes the two rules look as different as possible.' }
};
function createBlockIntro(kind, n) {
  const b = BLOCK_INTRO[kind];
  return {
    type: jsPsychInstructions, show_clickable_nav: true, button_label_next: 'Start',
    pages: [`<div class="instr"><span class="tk">${esc(b.tk)}</span><h2>${esc(b.h)}</h2>
      <p>${esc(b.p)}</p>
      <p class="tb-note">${n} ${plural(n, 'screen', 'screens')} of this task.</p></div>`]
  };
}

/* ------------------------------------------------------- submit / completion */
// Saving happens on its own screen, before the completion screen, so the
// completion screen can state the outcome instead of guessing at it.
function createSubmitScreen() {
  return {
    type: jsPsychCallFunction, async: true,
    data: { phase: 'submit' },
    func: async (done) => {
      submissionResult = await submitDataToServer(exportExperimentData());
      done(submissionResult);
    },
    // Write into #jspsych-content, NOT the display element: jsPsych builds its
    // content wrapper inside the display element once and reuses it, so replacing
    // the display element's innerHTML detaches the node later trials render into.
    on_load: () => {
      document.querySelector('#jspsych-content').innerHTML =
        `<div style="max-width:600px;margin:0 auto;text-align:center;padding:60px 0;">
           <h2>Saving your responses&hellip;</h2><p>Please don't close this window.</p></div>`;
    }
  };
}

function createCompletionScreen(nTrials) {
  return {
    type: jsPsychInstructions, show_clickable_nav: true,
    allow_backward: false,   // the data is already saved; going back would fork the session
    button_label_next: isProlificParticipant ? 'Return to Prolific'
      : (isDebugMode ? 'View data' : 'Finish'),
    pages: [() => {
      const ok = submissionResult.status === 'ok';
      const skipped = submissionResult.status === 'skipped';
      const banner = ok
        ? `<p class="tb-save ok">Your responses have been saved.</p>`
        : skipped
          ? `<p class="tb-save warn">No submission URL is configured, so nothing was saved.
             This is a walkthrough, not a data-collecting session.</p>`
          : `<p class="tb-save bad"><strong>Your responses could not be saved.</strong>
             Please contact the researcher and quote your participant ID
             <code>${esc(participantId)}</code>${submissionResult.error ? ` and this message: <code>${esc(submissionResult.error)}</code>` : ''}.
             A copy has been kept in this browser, so please don't clear your browsing data yet.</p>`;
      return `<div style="max-width:640px;margin:0 auto;text-align:center;"><h1>Thank you!</h1>
        <p>You've finished all ${nTrials} ${plural(nTrials, 'screen', 'screens')}.</p>
        ${banner}
        ${isProlificParticipant ? '<p>Click below to return to Prolific.</p>' : ''}
        ${isDebugMode ? '<p><strong>Debug mode:</strong> your raw data is shown next.</p>' : ''}</div>`;
    }],
    on_finish: () => {
      if (isProlificParticipant && prolificCompletionURL) {
        setTimeout(() => { window.location.href = prolificCompletionURL; }, 1000);
      }
    }
  };
}

function createDataDisplayScreen() {
  return {
    type: jsPsychInstructions, show_clickable_nav: true, button_label_next: 'Finish',
    pages: [() => `<div style="max-width:860px;margin:0 auto;text-align:left;">
      <h2>Debug &mdash; collected data</h2>
      <textarea readonly style="width:100%;height:340px;font:12px ui-monospace,monospace;">${esc(JSON.stringify(exportExperimentData(), null, 2))}</textarea></div>`]
  };
}

/* ------------------------------------------------------------- data plumbing */
function exportExperimentData() {
  const tasks = jsPsych.data.get().filter({ phase: 'task' }).values();
  return {
    experiment: 'agc_human_study',
    participant_id: participantId,
    slot: participantSlot,
    is_prolific: isProlificParticipant,
    is_debug: isDebugMode,
    study_id: studyId,
    session_id: prolificSessionId,
    consent_version: CONSENT_VERSION,
    consent: window.consentData || null,
    user_agent: navigator.userAgent,
    screen: { width: window.screen.width, height: window.screen.height },
    submitted_at: new Date().toISOString(),
    items_per_task: PER_TASK,
    quiz: (() => {
      const q = jsPsych.data.get().filter({ phase: 'quiz' }).values()[0];
      return q ? { attempts: q.attempts, answers: q.answers, rt: q.rt } : null;
    })(),
    responses: tasks.map(t => ({ ...t.clean, rt: t.rt }))
  };
}

async function submitDataToServer(data) {
  // Keep a local copy FIRST, so a failed POST is recoverable from the browser.
  try { localStorage.setItem('agc_' + participantId, JSON.stringify(data)); } catch (e) { /* private mode */ }
  if (!DATA_SUBMISSION_URL) {
    console.warn('DATA_SUBMISSION_URL is empty — nothing was saved to a server.');
    return { status: 'skipped' };
  }
  const body = JSON.stringify({ experiment: data.experiment, participantId, data });
  let lastError = '';
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(DATA_SUBMISSION_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body
      });
      if (res.ok) return { status: 'ok', ...(await res.json().catch(() => ({}))) };
      lastError = `HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`;
    } catch (e) { lastError = String(e); }
    console.error(`Submission attempt ${attempt} failed — ${lastError}`);
    if (attempt === 1) await new Promise(r => setTimeout(r, 1500));
  }
  return { status: 'error', error: lastError };
}

/* ----------------------------------------------------------------- run it */
async function runExperiment() {
  try {
    initializeParticipant();
    if (!BANK || !BANK.abduce || !BANK.abduce.length) {
      throw new Error('No items loaded (js/stimuli-data.js) — run prepare_stimuli.py.');
    }
    G.setDims(BANK.C, BANK.Q);

    jsPsych = initJsPsych({ display_element: 'jspsych-target' });

    const nTrials = TASK_ORDER.reduce((s, k) => s + PER_TASK[k], 0);
    const minutes = { lo: Math.max(5, nTrials * 2), hi: nTrials * 4 };

    const timeline = [];
    if (!isProlificParticipant) timeline.push(createIdScreen());
    timeline.push(createConsentScreen(nTrials, minutes),
                  createPrimerScreen(),
                  createInstructionsScreen(),
                  createQuizScreen());

    let step = 0;
    TASK_ORDER.forEach(kind => {
      const n = PER_TASK[kind];
      const items = itemsForSlot(BANK[kind], n, participantSlot);
      timeline.push(createBlockIntro(kind, n));
      items.forEach(item => {
        step += 1;
        timeline.push(
          kind === 'abduce' ? abductionTrial(item, step, nTrials)
          : kind === 'create' ? creationTrial(item, step, nTrials)
          : transformationTrial(item, step, nTrials));
      });
    });

    timeline.push(createSubmitScreen());
    timeline.push(createCompletionScreen(nTrials));
    if (isDebugMode) timeline.push(createDataDisplayScreen());

    await jsPsych.run(timeline);
  } catch (error) {
    console.error(error);
    document.body.innerHTML = `<div style="padding:40px;text-align:center;color:#c0392b;">
      <h1>Error loading experiment</h1><p>${esc(error.message)}</p></div>`;
  }
}

document.addEventListener('DOMContentLoaded', runExperiment);
