/* ============================================================================
   AGC grid widget — the drawing surface shared by all three tasks.

   Colours come from CSS custom properties and are sampled at paint time.
   The study is light-only, so repaintAll() exists for redraws rather than
   theme switches. The palette is validated for colour-vision deficiency:
   worst-pair separation is dE 26.4 under protanopia and deuteranopia
   simulation, against a target of 8.
   ========================================================================= */
(function (root) {
  "use strict";

  var C = 5, Q = 3;
  var painted = [];                    // every canvas we manage, for theme repaints
  var palSyncs = [];

  function setDims(c, q) { C = c; Q = q; }
  var parse = function (s) { return s.split("").map(Number); };
  var str   = function (g) { return g.join(""); };
  var blank = function () { var a = [], i; for (i = 0; i < C * C; i++) a.push(0); return a; };

  function palette() {
    var s = getComputedStyle(document.documentElement), out = [], i;
    for (i = 0; i < Q; i++) out.push(s.getPropertyValue("--c" + i).trim());
    return out;
  }

  function draw(cv, cell, px) {
    var ctx = cv.getContext("2d"), P = palette(), W = C * px, i, j, k;
    cv.width = W; cv.height = W;
    for (i = 0; i < C; i++) for (j = 0; j < C; j++) {
      ctx.fillStyle = P[cell[i * C + j]];
      ctx.fillRect(j * px, i * px, px, px);
    }
    ctx.strokeStyle = getComputedStyle(document.documentElement)
      .getPropertyValue("--cell-line").trim();
    ctx.lineWidth = px > 25 ? 2 : 1; ctx.globalAlpha = 0.7; ctx.beginPath();
    for (k = 1; k < C; k++) {
      ctx.moveTo(k * px, 0); ctx.lineTo(k * px, W);
      ctx.moveTo(0, k * px); ctx.lineTo(W, k * px);
    }
    ctx.stroke(); ctx.globalAlpha = 1;
  }

  function register(cv, get, px) { painted.push({ cv: cv, get: get, px: px }); }
  function repaintAll() { painted.forEach(function (p) { draw(p.cv, p.get(), p.px); }); }

  /* ---- 2x2 matrix: seed, across, down, both, with arrows between -------- */
  function matrix(host, cells, px, arrowPx, labelled) {
    var mx = document.createElement("div"); mx.className = "agc-mx";
    var cv = [], i;
    var place = function (el, r, c) { el.style.gridArea = r + "/" + c; mx.appendChild(el); };
    for (i = 0; i < 4; i++) {
      var c = document.createElement("canvas"); cv.push(c);
      c.setAttribute("aria-label",
        "cell reached by " + (i % 2) + " across and " + (i < 2 ? 0 : 1) + " down");
      if (!labelled) { place(c, i < 2 ? 1 : 3, i % 2 === 0 ? 1 : 3); continue; }
      var w = document.createElement("div"); w.className = "agc-cellw"; w.appendChild(c);
      var l = document.createElement("div"); l.className = "agc-cl";
      l.textContent = "→" + (i % 2) + " · ↓" + (i < 2 ? 0 : 1);
      w.appendChild(l);
      place(w, i < 2 ? 1 : 3, i % 2 === 0 ? 1 : 3);
    }
    [[1, 2], [3, 2]].forEach(function (rc) {
      var a = document.createElement("div"); a.className = "agc-ar";
      a.textContent = "→"; a.style.fontSize = arrowPx + "px";
      a.setAttribute("aria-hidden", "true"); place(a, rc[0], rc[1]);
    });
    [[2, 1], [2, 3]].forEach(function (rc) {
      var a = document.createElement("div"); a.className = "agc-ar";
      a.textContent = "↓"; a.style.fontSize = arrowPx + "px";
      a.setAttribute("aria-hidden", "true"); place(a, rc[0], rc[1]);
    });
    host.appendChild(mx);
    cv.forEach(function (c, n) {
      c.className = "given";
      draw(c, cells[n], px);
      (function (idx) { register(c, function () { return cells[idx]; }, px); })(n);
    });
    return cv;
  }

  /* ---- painting -------------------------------------------------------- */
  var down = false;
  if (root.document && document.addEventListener) {
    document.addEventListener("pointerup", function () { down = false; });
    document.addEventListener("pointercancel", function () { down = false; });
  }

  /* alt-click or a right-drag paints the background instead — an eraser */
  function inkFor(ev, base) {
    return (ev.altKey || ev.button === 2 || ev.buttons === 2) ? 0 : base;
  }

  /* A stroke is one undo step, so state.push() fires on pointerdown only. */
  function paintable(cv, px, get, onChange, state) {
    cv.classList.add("agc-paintable");
    var hit = function (ev) {
      var r = cv.getBoundingClientRect(), s = cv.width / r.width;
      var j = Math.floor((ev.clientX - r.left) * s / px);
      var i = Math.floor((ev.clientY - r.top) * s / px);
      if (i < 0 || i >= C || j < 0 || j >= C) return;
      var g = get(), ink = inkFor(ev, state.paint);
      if (g[i * C + j] === ink) return;
      g[i * C + j] = ink; draw(cv, g, px); onChange();
    };
    cv.addEventListener("contextmenu", function (e) { e.preventDefault(); });
    cv.addEventListener("pointerdown", function (e) {
      if (state.push) state.push();
      down = true;
      if (cv.setPointerCapture) cv.setPointerCapture(e.pointerId);
      hit(e);
    });
    cv.addEventListener("pointermove", function (e) { if (down) hit(e); });
    register(cv, get, px);
    draw(cv, get(), px);
    return cv;
  }

  /* ---- colour palette; several may coexist and stay in sync ------------ */
  function makePalette(host, state, onPick) {
    var btns = [], i;
    for (i = 0; i < Q; i++) (function (n) {
      var w = document.createElement("div"); w.className = "agc-swatch";
      var b = document.createElement("button"); b.type = "button";
      b.style.background = "var(--c" + n + ")";
      b.setAttribute("aria-label", n === 0 ? "empty, the background colour" : "colour " + n);
      b.onclick = function () { state.paint = n; syncAll(); if (onPick) onPick(n); };
      var k = document.createElement("span"); k.className = "agc-key";
      k.textContent = n === 0 ? (n + 1) + " · empty" : String(n + 1);
      w.appendChild(b); w.appendChild(k); host.appendChild(w); btns.push(b);
    })(i);
    var sync = function () {
      btns.forEach(function (b, n) { b.setAttribute("aria-pressed", n === state.paint); });
    };
    palSyncs.push(sync); sync();
    return sync;
  }
  function syncAll() { palSyncs.forEach(function (f) { f(); }); }

  /* forget the widgets of a finished trial so repaints do not touch dead nodes */
  function forget() { painted = []; palSyncs = []; }

  /* ---- executable rules, for the transformation task ------------------- */
  function gravity(g) {
    var o = blank(), i, j, k, col;
    for (j = 0; j < C; j++) {
      col = [];
      for (i = 0; i < C; i++) if (g[i * C + j]) col.push(g[i * C + j]);
      for (k = 0; k < col.length; k++) o[(C - col.length + k) * C + j] = col[k];
    }
    return o;
  }
  function slideR(g) {
    var o = blank(), i, j, k, row;
    for (i = 0; i < C; i++) {
      row = [];
      for (j = 0; j < C; j++) if (g[i * C + j]) row.push(g[i * C + j]);
      for (k = 0; k < row.length; k++) o[i * C + (C - row.length + k)] = row[k];
    }
    return o;
  }
  var perm = function (f) {
    return function (g) {
      var o = blank(), i, j, s;
      for (i = 0; i < C; i++) for (j = 0; j < C; j++) {
        s = f(i, j); o[i * C + j] = g[s[0] * C + s[1]];
      }
      return o;
    };
  };
  var OPS = {
    gravity: gravity, slideR: slideR,
    mirror:    perm(function (i, j) { return [i, C - 1 - j]; }),
    flipud:    perm(function (i, j) { return [C - 1 - i, j]; }),
    rot90:     perm(function (i, j) { return [C - 1 - j, i]; }),
    rot180:    perm(function (i, j) { return [C - 1 - i, C - 1 - j]; }),
    transpose: perm(function (i, j) { return [j, i]; }),
    hroll:     perm(function (i, j) { return [i, (j - 1 + C) % C]; }),
    vroll:     perm(function (i, j) { return [(i - 1 + C) % C, j]; }),
    swap12: function (g) { return g.map(function (v) { return v === 1 ? 2 : v === 2 ? 1 : 0; }); },
    cyc3:   function (g) { return g.map(function (v) { return (v + 1) % Q; }); }
  };

  /* normalised Hamming distance over equal-length grids */
  function dist(a, b) {
    var d = 0, i;
    for (i = 0; i < a.length; i++) if (a[i] !== b[i]) d++;
    return d / a.length;
  }

  root.AGCGrid = {
    setDims: setDims, parse: parse, str: str, blank: blank,
    draw: draw, matrix: matrix, paintable: paintable,
    makePalette: makePalette, syncPalettes: syncAll,
    repaintAll: repaintAll, forget: forget,
    OPS: OPS, dist: dist, inkFor: inkFor
  };
})(window);
