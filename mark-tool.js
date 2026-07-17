/* ============================================================================
   mark-tool.js — drag/scale the Gala Day hand-mark and read out its CSS.

   DEV ONLY. Loaded solely when the URL carries ?mark=edit (see the loader at
   the foot of site-source.html), so visitors never download this file.

   Why it exists: the mark is placed in rem, but nudges get described in px —
   and px only means something at one viewport width. This converts against the
   LIVE root font-size, so a 1px nudge here is exactly 1px on this screen, and
   the rem it emits is the value that belongs in the CSS.

   It only ever writes inline styles on the element. Nothing persists: copy the
   emitted line into the matching @media block in site-source.html.
   ========================================================================== */
(function () {
  'use strict';

  var mark = document.querySelector('#page-home .hero-mark');
  if (!mark) { console.warn('[mark-tool] #page-home .hero-mark not found'); return; }

  var root = document.documentElement;
  var rootPx = function () { return parseFloat(getComputedStyle(root).fontSize); };

  // Canonical bands — must mirror the media queries in site-source.html.
  function band() {
    var w = window.innerWidth;
    if (w <= 760)  return { name: 'mobile',  q: '@media (max-width:760px)' };
    if (w <= 1024) return { name: 'tablet',  q: '@media (min-width:761px) and (max-width:1024px)' };
    return              { name: 'desktop', q: '@media (min-width:1025px)' };
  }

  // Seed from whatever the stylesheet currently resolves to.
  var R = rootPx();
  var cs = getComputedStyle(mark);
  var L = parseFloat(cs.left) / R;
  var T = parseFloat(cs.top) / R;
  var W = parseFloat(cs.width) / R;
  var L0 = L, T0 = T, W0 = W;

  var fmt = function (v) { return parseFloat(v.toFixed(3)) + 'rem'; };

  mark.style.pointerEvents = 'auto';   // it ships click-through; needed for dragging
  mark.style.touchAction = 'none';
  mark.style.cursor = 'move';
  mark.style.outline = '1px dashed rgba(255,255,255,0.55)';

  function apply() {
    mark.style.left = fmt(L);
    mark.style.top = fmt(T);
    mark.style.width = fmt(W);
    paint();
  }

  function cssLine() {
    return '#page-home .hero-mark{ display:block; left:' + fmt(L) +
           '; top:' + fmt(T) + '; width:' + fmt(W) + '; }';
  }

  /* ---------- HUD ---------- */
  var hud = document.createElement('div');
  hud.style.cssText = [
    'position:fixed', 'right:12px', 'bottom:12px', 'z-index:2147483647',
    'font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace',
    'background:rgba(12,16,14,0.94)', 'color:#ECE3CF', 'padding:10px 12px',
    'border:1px solid rgba(236,227,207,0.25)', 'border-radius:10px',
    'box-shadow:0 10px 40px -12px rgba(0,0,0,0.8)', 'max-width:min(92vw,340px)',
    'user-select:none', '-webkit-user-select:none', 'touch-action:manipulation'
  ].join(';');

  hud.innerHTML =
    '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">' +
      '<b id="mt-band" style="color:#D79E8C"></b>' +
      '<span id="mt-meta" style="opacity:.6;font-size:11px"></span>' +
    '</div>' +
    '<div id="mt-css" style="background:rgba(0,0,0,.45);padding:6px 7px;border-radius:6px;' +
      'word-break:break-all;font-size:11px;margin-bottom:8px"></div>' +
    '<div style="display:flex;gap:6px;align-items:center;margin-bottom:6px">' +
      '<span style="opacity:.6;width:34px">move</span>' +
      '<button data-mv="-1,0">←</button><button data-mv="0,-1">↑</button>' +
      '<button data-mv="0,1">↓</button><button data-mv="1,0">→</button>' +
      '<span style="opacity:.45;font-size:10px">1px · hold&nbsp;⇧=10</span>' +
    '</div>' +
    '<div style="display:flex;gap:6px;align-items:center;margin-bottom:8px">' +
      '<span style="opacity:.6;width:34px">size</span>' +
      '<button data-sz="-1">−</button><button data-sz="1">+</button>' +
      '<button data-sz="-10">−10</button><button data-sz="10">+10</button>' +
      '<span style="opacity:.45;font-size:10px">px wide</span>' +
    '</div>' +
    '<div style="display:flex;gap:6px">' +
      '<button id="mt-copy" style="flex:1">Copy CSS</button>' +
      '<button id="mt-reset">Reset</button>' +
    '</div>';
  document.body.appendChild(hud);

  Array.prototype.forEach.call(hud.querySelectorAll('button'), function (b) {
    b.style.cssText = 'font:11px/1 ui-monospace,Menlo,monospace;padding:7px 9px;' +
      'background:#2a332c;color:#ECE3CF;border:1px solid rgba(236,227,207,0.28);' +
      'border-radius:6px;cursor:pointer;min-width:30px';
  });

  var elBand = hud.querySelector('#mt-band'),
      elMeta = hud.querySelector('#mt-meta'),
      elCss  = hud.querySelector('#mt-css');

  function paint() {
    var b = band();
    elBand.textContent = b.name;
    elMeta.textContent = window.innerWidth + 'px · root ' + rootPx().toFixed(2) + 'px';
    elCss.textContent = cssLine();
  }

  /* ---------- drag ---------- */
  var drag = null;
  mark.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    mark.setPointerCapture(e.pointerId);
    drag = { x: e.clientX, y: e.clientY, L: L, T: T, R: rootPx() };
  });
  mark.addEventListener('pointermove', function (e) {
    if (!drag) return;
    L = drag.L + (e.clientX - drag.x) / drag.R;   // device px -> rem at the live root
    T = drag.T + (e.clientY - drag.y) / drag.R;
    apply();
  });
  ['pointerup', 'pointercancel'].forEach(function (t) {
    mark.addEventListener(t, function () { drag = null; });
  });

  /* ---------- buttons ---------- */
  var shift = false;
  window.addEventListener('keydown', function (e) { if (e.key === 'Shift') shift = true; });
  window.addEventListener('keyup',   function (e) { if (e.key === 'Shift') shift = false; });

  hud.addEventListener('click', function (e) {
    var t = e.target;
    if (t.dataset && t.dataset.mv) {
      var p = t.dataset.mv.split(',').map(Number), k = (shift ? 10 : 1) / rootPx();
      L += p[0] * k; T += p[1] * k; apply();
    } else if (t.dataset && t.dataset.sz) {
      W += Number(t.dataset.sz) / rootPx(); apply();
    } else if (t.id === 'mt-copy') {
      var line = cssLine();
      (navigator.clipboard ? navigator.clipboard.writeText(line) : Promise.reject())
        .then(function () { t.textContent = 'Copied ✓'; })
        .catch(function () {
          var ta = document.createElement('textarea');
          ta.value = line; document.body.appendChild(ta); ta.select();
          try { document.execCommand('copy'); t.textContent = 'Copied ✓'; }
          catch (_) { t.textContent = 'Select it ↑'; }
          ta.remove();
        })
        .then(function () { setTimeout(function () { t.textContent = 'Copy CSS'; }, 1400); });
    } else if (t.id === 'mt-reset') {
      L = L0; T = T0; W = W0; apply();
    }
  });

  /* ---------- keyboard (desktop) ---------- */
  window.addEventListener('keydown', function (e) {
    var map = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (map[e.key]) {
      e.preventDefault();
      var k = (e.shiftKey ? 10 : 1) / rootPx();
      L += map[e.key][0] * k; T += map[e.key][1] * k; apply();
    } else if (e.key === '[' || e.key === ']') {
      W += (e.key === ']' ? 1 : -1) * (e.shiftKey ? 10 : 1) / rootPx(); apply();
    }
  });

  // Re-seed on a band change: the stylesheet hands over different values, and
  // the inline styles we set would otherwise mask the new band's rule.
  var last = band().name;
  window.addEventListener('resize', function () {
    var now = band().name;
    if (now !== last) {
      last = now;
      mark.style.left = mark.style.top = mark.style.width = '';
      var c = getComputedStyle(mark), r = rootPx();
      L = L0 = parseFloat(c.left) / r;
      T = T0 = parseFloat(c.top) / r;
      W = W0 = parseFloat(c.width) / r;
    }
    apply();
  });

  apply();
  console.log('[mark-tool] ready — drag the mark, arrows nudge 1px (⇧ 10), [ ] scale.');
})();
