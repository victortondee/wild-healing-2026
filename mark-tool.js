/* ============================================================================
   mark-tool.js — pick ANY element, drag/scale it, read out pasteable CSS.

   DEV ONLY. Loads solely when ?mark=edit was seen (the flag is captured in
   <head> and kept in sessionStorage, because the router's URL rewrite destroys
   the query — see the note there). Turn off with ?mark=off or close the tab.

   Why it exists: positions live in rem, but nudges get described in px — and px
   only means something at one viewport width. Everything here converts against
   the LIVE root font-size, so the rem it emits is the value that belongs in the
   CSS, for whatever screen you happen to be on.

   It only ever writes inline styles. Nothing persists: copy the emitted rule
   into the matching @media block in site-source.html.
   ========================================================================== */
(function () {
  'use strict';

  var root = document.documentElement;
  function rootPx() { return parseFloat(getComputedStyle(root).fontSize); }
  function esc(v) { return window.CSS && CSS.escape ? CSS.escape(v) : v; }

  // Canonical bands — mirror the media queries in site-source.html.
  function band() {
    var w = window.innerWidth;
    if (w <= 760)  return { name: 'mobile',  q: '@media (max-width:760px)' };
    if (w <= 1024) return { name: 'tablet',  q: '@media (min-width:761px) and (max-width:1024px)' };
    return           { name: 'desktop', q: '@media (min-width:1025px)' };
  }

  /* ---------- selector generation -------------------------------------------
     Must resolve to exactly ONE element. Never trust an id blindly: this file
     has had duplicate ids (e.g. two draft-D-02), and structures like
     .hdate.land exist 7x across pages. So every candidate is verified against
     the live document, growing the path upward until it is unique. */
  // Router-toggled or motion-only classes: they say nothing about identity, and
  // baking them into a rule makes it brittle. Dropped from generated selectors.
  var VOLATILE = /^(active|anim|a\d+|is-|has-)$/;

  function part(node) {
    if (node.id && document.querySelectorAll('#' + esc(node.id)).length === 1) {
      return '#' + esc(node.id);
    }
    var p = node.tagName.toLowerCase();
    var cls = (node.getAttribute('class') || '').trim().split(/\s+/)
      .filter(function (c) { return c && !VOLATILE.test(c); });
    if (cls.length) p += '.' + cls.map(esc).join('.');
    var par = node.parentElement;
    if (par) {
      var same = Array.prototype.filter.call(par.children, function (s) {
        return s.tagName === node.tagName;
      });
      if (same.length > 1) p += ':nth-of-type(' + (same.indexOf(node) + 1) + ')';
    }
    return p;
  }

  function uniq(sel, el) {
    var hit;
    try { hit = document.querySelectorAll(sel); } catch (e) { return false; }
    return hit.length === 1 && hit[0] === el;
  }

  /* Anchor on the nearest unique-id ancestor (usually #page-home), then grow a
     DESCENDANT chain upward from the element until unique. Yields short, readable,
     page-scoped rules like "#page-home h1" rather than a brittle full child path.
     Scoping to the page id also matters here: .hdate.land exists 8x across pages,
     and an unanchored selector would silently hit the wrong one. */
  function selectorFor(el) {
    if (el.id && document.querySelectorAll('#' + esc(el.id)).length === 1) return '#' + esc(el.id);

    var anchor = null, node = el.parentElement;
    while (node && node.nodeType === 1) {
      if (node.id && document.querySelectorAll('#' + esc(node.id)).length === 1) { anchor = node; break; }
      node = node.parentElement;
    }
    var prefix = anchor ? '#' + esc(anchor.id) + ' ' : '';

    var chain = [];
    node = el;
    while (node && node.nodeType === 1 && node !== anchor && node !== document.body) {
      chain.unshift(part(node));
      var sel = prefix + chain.join(' ');
      if (uniq(sel, el)) return sel;
      node = node.parentElement;
    }
    // Last resort: strict child path from body (covers body's own children, which
    // have no ancestor left to disambiguate against).
    var parts = [], n = el;
    while (n && n.nodeType === 1) {
      parts.unshift(n === document.body ? 'body' : part(n));
      if (uniq(parts.join(' > '), el)) return parts.join(' > ');
      if (n === document.body) break;
      n = n.parentElement;
    }
    return parts.join(' > ');
  }

  /* ---------- state ---------- */
  var el = null, base = null, cur = null, picking = false;

  function seed(node) {
    el = node;
    var cs = getComputedStyle(node), R = rootPx();
    var positioned = cs.position !== 'static';
    base = {
      positioned: positioned,
      L: cs.left === 'auto' ? 0 : parseFloat(cs.left),
      T: cs.top === 'auto' ? 0 : parseFloat(cs.top),
      W: parseFloat(cs.width),
      inline: node.getAttribute('style') || '',
      sel: selectorFor(node)
    };
    cur = { L: base.L / R, T: base.T / R, W: base.W / R };
    if (!positioned) node.style.position = 'relative';  // non-destructive nudge for in-flow elements
    node.style.outline = '1px dashed rgba(255,120,90,0.9)';
    node.style.cursor = 'move';
    node.style.touchAction = 'none';
    if (getComputedStyle(node).pointerEvents === 'none') node.style.pointerEvents = 'auto';
    paint();
  }

  function apply() {
    var f = function (v) { return parseFloat(v.toFixed(3)) + 'rem'; };
    el.style.left = f(cur.L);
    el.style.top = f(cur.T);
    el.style.width = f(cur.W);
    paint();
  }

  // Emit ONLY what actually changed, so the rule stays paste-safe.
  function cssRule() {
    if (!el) return '(nothing picked)';
    var R = rootPx(), d = [], f = function (v) { return parseFloat(v.toFixed(3)) + 'rem'; };
    if (!base.positioned) d.push('position:relative');
    if (Math.abs(cur.L - base.L / R) > 1e-4 || !base.positioned) d.push('left:' + f(cur.L));
    if (Math.abs(cur.T - base.T / R) > 1e-4 || !base.positioned) d.push('top:' + f(cur.T));
    if (Math.abs(cur.W - base.W / R) > 1e-4) d.push('width:' + f(cur.W));
    if (!d.length) return '/* unchanged */';
    return band().q + '{\n  ' + base.sel + '{ ' + d.join('; ') + '; }\n}';
  }

  /* ---------- HUD ---------- */
  var hud = document.createElement('div');
  hud.id = 'mt-hud';
  hud.style.cssText = [
    'position:fixed', 'right:12px', 'bottom:12px', 'z-index:2147483647',
    'font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace',
    'background:rgba(12,16,14,0.95)', 'color:#ECE3CF', 'padding:10px 12px',
    'border:1px solid rgba(236,227,207,0.25)', 'border-radius:10px',
    'box-shadow:0 10px 40px -12px rgba(0,0,0,0.85)', 'max-width:min(94vw,360px)',
    'user-select:none', '-webkit-user-select:none', 'touch-action:manipulation'
  ].join(';');
  hud.innerHTML =
    '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">' +
      '<button id="mt-pick">Pick element</button>' +
      '<b id="mt-band" style="color:#D79E8C"></b>' +
      '<span id="mt-meta" style="opacity:.55;font-size:10px"></span>' +
    '</div>' +
    '<div id="mt-sel" style="opacity:.75;font-size:10px;word-break:break-all;margin-bottom:5px"></div>' +
    '<pre id="mt-css" style="background:rgba(0,0,0,.5);padding:6px 7px;border-radius:6px;' +
      'white-space:pre-wrap;word-break:break-all;font-size:10px;margin:0 0 8px"></pre>' +
    '<div style="display:flex;gap:5px;align-items:center;margin-bottom:5px">' +
      '<span style="opacity:.55;width:30px">move</span>' +
      '<button data-mv="-1,0">←</button><button data-mv="0,-1">↑</button>' +
      '<button data-mv="0,1">↓</button><button data-mv="1,0">→</button>' +
      '<span style="opacity:.4;font-size:10px">1px ⇧10</span>' +
    '</div>' +
    '<div style="display:flex;gap:5px;align-items:center;margin-bottom:8px">' +
      '<span style="opacity:.55;width:30px">size</span>' +
      '<button data-sz="-1">−</button><button data-sz="1">+</button>' +
      '<button data-sz="-10">−10</button><button data-sz="10">+10</button>' +
    '</div>' +
    '<div style="display:flex;gap:5px">' +
      '<button id="mt-copy" style="flex:1">Copy CSS</button>' +
      '<button id="mt-reset">Reset</button><button id="mt-off">✕</button>' +
    '</div>';
  document.body.appendChild(hud);
  Array.prototype.forEach.call(hud.querySelectorAll('button'), function (b) {
    b.style.cssText = 'font:11px/1 ui-monospace,Menlo,monospace;padding:6px 8px;background:#2a332c;' +
      'color:#ECE3CF;border:1px solid rgba(236,227,207,0.28);border-radius:6px;cursor:pointer;min-width:28px';
  });
  var $ = function (id) { return hud.querySelector(id); };

  function paint() {
    $('#mt-band').textContent = band().name;
    $('#mt-meta').textContent = innerWidth + 'px · root ' + rootPx().toFixed(2);
    $('#mt-sel').textContent = el ? base.sel : 'nothing picked — hit “Pick element”';
    $('#mt-css').textContent = cssRule();
  }

  /* ---------- picker ---------- */
  var hi = document.createElement('div');
  hi.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483646;border:2px solid #ff7a5a;' +
    'background:rgba(255,122,90,0.12);display:none';
  document.body.appendChild(hi);

  function under(e) {
    var t = document.elementFromPoint(e.clientX, e.clientY);
    return (t && !hud.contains(t) && t !== hi && t !== document.documentElement && t !== document.body) ? t : null;
  }
  function onMove(e) {
    if (!picking) return;
    var t = under(e); if (!t) { hi.style.display = 'none'; return; }
    var r = t.getBoundingClientRect();
    hi.style.cssText += ';display:block';
    hi.style.left = r.x + 'px'; hi.style.top = r.y + 'px';
    hi.style.width = r.width + 'px'; hi.style.height = r.height + 'px';
    $('#mt-sel').textContent = selectorFor(t);
  }
  // capture phase + preventDefault: the page is full of links, and a pick must
  // never fire a navigation.
  function onPick(e) {
    if (!picking) return;
    var t = under(e); if (!t) return;
    e.preventDefault(); e.stopPropagation();
    picking = false; hi.style.display = 'none';
    document.body.style.cursor = '';
    $('#mt-pick').textContent = 'Pick element';
    if (el && el !== t) { el.style.outline = ''; el.style.cursor = ''; }
    seed(t);
  }
  window.addEventListener('pointermove', onMove, true);
  window.addEventListener('click', onPick, true);
  window.addEventListener('pointerdown', function (e) { if (picking) { e.preventDefault(); e.stopPropagation(); } }, true);

  /* ---------- drag ---------- */
  var drag = null;
  window.addEventListener('pointerdown', function (e) {
    if (picking || !el || hud.contains(e.target)) return;
    if (e.target !== el && !el.contains(e.target)) return;
    e.preventDefault();
    drag = { x: e.clientX, y: e.clientY, L: cur.L, T: cur.T, R: rootPx() };
  }, true);
  window.addEventListener('pointermove', function (e) {
    if (!drag) return;
    cur.L = drag.L + (e.clientX - drag.x) / drag.R;   // device px -> rem at the live root
    cur.T = drag.T + (e.clientY - drag.y) / drag.R;
    apply();
  }, true);
  ['pointerup', 'pointercancel'].forEach(function (t) {
    window.addEventListener(t, function () { drag = null; }, true);
  });

  /* ---------- controls ---------- */
  hud.addEventListener('click', function (e) {
    var t = e.target;
    if (t.id === 'mt-pick') {
      picking = !picking;
      t.textContent = picking ? 'Click a target…' : 'Pick element';
      document.body.style.cursor = picking ? 'crosshair' : '';
      hi.style.display = 'none';
      return;
    }
    if (!el && (t.dataset.mv || t.dataset.sz || t.id === 'mt-reset')) return;
    if (t.dataset.mv) {
      var p = t.dataset.mv.split(',').map(Number), k = 1 / rootPx();
      cur.L += p[0] * k; cur.T += p[1] * k; apply();
    } else if (t.dataset.sz) {
      cur.W += Number(t.dataset.sz) / rootPx(); apply();
    } else if (t.id === 'mt-copy') {
      var line = cssRule();
      (navigator.clipboard ? navigator.clipboard.writeText(line) : Promise.reject())
        .then(function () { t.textContent = 'Copied ✓'; })
        .catch(function () {
          var ta = document.createElement('textarea');
          ta.value = line; document.body.appendChild(ta); ta.select();
          try { document.execCommand('copy'); t.textContent = 'Copied ✓'; }
          catch (_) { t.textContent = 'Select ↑'; }
          ta.remove();
        })
        .then(function () { setTimeout(function () { t.textContent = 'Copy CSS'; }, 1400); });
    } else if (t.id === 'mt-reset') {
      el.setAttribute('style', base.inline);
      seed(el);
    } else if (t.id === 'mt-off') {
      try { sessionStorage.removeItem('markEdit'); } catch (_) {}
      if (el) el.setAttribute('style', base.inline);
      hud.remove(); hi.remove();
    }
  });

  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && picking) { picking = false; hi.style.display = 'none'; document.body.style.cursor = ''; $('#mt-pick').textContent = 'Pick element'; return; }
    if (!el) return;
    var map = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (map[e.key]) {
      e.preventDefault();
      var k = (e.shiftKey ? 10 : 1) / rootPx();
      cur.L += map[e.key][0] * k; cur.T += map[e.key][1] * k; apply();
    } else if (e.key === '[' || e.key === ']') {
      cur.W += (e.key === ']' ? 1 : -1) * (e.shiftKey ? 10 : 1) / rootPx(); apply();
    }
  });

  // On a band change the stylesheet hands over different values; re-seed so the
  // per-band rules stay independent and our inline styles don't mask them.
  var last = band().name;
  window.addEventListener('resize', function () {
    if (band().name !== last && el) { last = band().name; el.setAttribute('style', base.inline); seed(el); }
    paint();
  });

  // Default target: the Gala Day mark, so the common case needs no picking.
  var mark = document.querySelector('#page-home .hero-mark');
  if (mark) seed(mark); else paint();
  window.__mt = { selectorFor: selectorFor, seed: seed };   // for self-tests
  console.log('[mark-tool] ready — “Pick element”, then drag / arrows (⇧10) / [ ] scale.');
})();
