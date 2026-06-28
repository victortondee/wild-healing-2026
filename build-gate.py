#!/usr/bin/env python3
"""Build the password-gated index.html from the plaintext site-source.html.

Usage:  python3 build-gate.py <password>

The real site loads normally (no document.write — so it renders identically to
the ungated site). A full-screen opaque password overlay is injected on top; the
correct password removes it and remembers the unlock for 10 days. Soft gate for
casual visitors, not strong encryption (content is present in the page source).
"""
import sys, hashlib, pathlib, re

if len(sys.argv) < 2:
    sys.exit("usage: python3 build-gate.py <password>")
password = sys.argv[1]
pass_hash = hashlib.sha256(password.encode("utf-8")).hexdigest()
html = pathlib.Path("site-source.html").read_text(encoding="utf-8")

# 1) early <head> bits: noindex + set .wh-ok before paint if already unlocked
HEAD_EARLY = (
    '\n<meta name="robots" content="noindex, nofollow">'
    '\n<script>try{var s=JSON.parse(localStorage.getItem("wh_gate_v1")||"null");'
    'if(s&&s.exp>Date.now())document.documentElement.classList.add("wh-ok");}catch(e){}</script>'
)

# 2) gate styles, inserted before </head>
GATE_CSS = """
<style id="wh-gate-css">
  html:not(.wh-ok), html:not(.wh-ok) body{ overflow:hidden !important; }
  .wh-gate{ position:fixed; inset:0; z-index:2147483600; display:flex; align-items:center; justify-content:center; padding:8vw 22px; text-align:center;
    background:radial-gradient(120% 90% at 50% 0%, #f4efe4 0%, #e8e1d4 58%, #ddd5c6 100%);
    font-family:'Hanken Grotesk',system-ui,sans-serif; color:#15262D; }
  html.wh-ok .wh-gate{ display:none; }
  .wh-box{ width:100%; max-width:31rem; animation:wh-rise .6s ease both; }
  @keyframes wh-rise{ from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }
  .wh-wm{ font-family:'Fraunces',Georgia,serif; font-weight:400; font-size:clamp(2.3rem,9vw,3.1rem); letter-spacing:-0.012em; margin:0 0 .35em; line-height:1; }
  .wh-bang{ color:#C37E69; }
  .wh-meta{ font-family:'Fraunces',serif; font-size:.8rem; letter-spacing:.2em; text-transform:uppercase; color:#A8654F; margin:0 0 1.8rem; }
  .wh-sub{ font-size:.98rem; line-height:1.6; color:#5b5446; margin:0 auto 2rem; max-width:25rem; }
  .wh-form{ display:flex; flex-direction:column; gap:.85rem; max-width:22rem; margin:0 auto; }
  .wh-form input{ font-family:inherit; font-size:1rem; padding:.95rem 1.1rem; border:1px solid rgba(21,38,45,.18); border-radius:14px; background:rgba(255,255,255,.72); color:#15262D; outline:none; text-align:center; letter-spacing:.02em; }
  .wh-form input:focus{ border-color:#C37E69; box-shadow:0 0 0 3px rgba(195,126,105,.18); }
  .wh-form button{ font-family:inherit; font-weight:600; font-size:.8rem; letter-spacing:.13em; text-transform:uppercase; color:#ECE3CF; cursor:pointer; padding:.95rem 1.2rem; border:none; border-radius:999px; background:linear-gradient(180deg,#D79E8C,#C37E69); box-shadow:0 12px 28px -14px rgba(168,101,79,.9); transition:transform .15s, filter .2s; }
  .wh-form button:hover{ filter:brightness(1.05); transform:translateY(-1px); }
  .wh-err{ min-height:1.2em; font-size:.85rem; color:#A8654F; opacity:0; transition:opacity .2s; }
  .wh-err.show{ opacity:1; }
</style>
"""

# 3) overlay markup, inserted right after <body ...>
GATE_HTML = """
<div class="wh-gate" id="wh-gate" role="dialog" aria-modal="true" aria-label="Private preview">
  <div class="wh-box">
    <h1 class="wh-wm">WILD<span class="wh-bang">!</span> Healing</h1>
    <p class="wh-meta">Sept 17&ndash;19, 2026 &middot; Ava, New York</p>
    <p class="wh-sub">This preview is private. Please enter the password to continue.</p>
    <form class="wh-form" id="wh-form" autocomplete="off">
      <input id="wh-pw" type="password" placeholder="Password" aria-label="Password" autofocus>
      <button type="submit">Enter</button>
      <div class="wh-err" id="wh-err">Incorrect password &mdash; try again.</div>
    </form>
  </div>
</div>
"""

# 4) gate logic, inserted before </body>
GATE_JS = """
<script>
(function(){
  var HASH="__PASS_HASH__", TTL=10*864e5, KEY="wh_gate_v1";
  function unlock(){ document.documentElement.classList.add('wh-ok'); var g=document.getElementById('wh-gate'); if(g) g.parentNode.removeChild(g); }
  if(document.documentElement.classList.contains('wh-ok')){ unlock(); return; }
  async function sha(s){ var b=new TextEncoder().encode(s); var h=await crypto.subtle.digest('SHA-256',b); return Array.from(new Uint8Array(h)).map(function(x){return x.toString(16).padStart(2,'0');}).join(''); }
  var f=document.getElementById('wh-form'), pw=document.getElementById('wh-pw'), err=document.getElementById('wh-err');
  f.addEventListener('submit', async function(e){ e.preventDefault();
    var h=await sha(pw.value);
    if(h===HASH){ try{ localStorage.setItem(KEY, JSON.stringify({exp:Date.now()+TTL})); }catch(e){} unlock(); }
    else { err.classList.add('show'); pw.value=''; pw.focus(); }
  });
})();
</script>
"""

out = html
out = out.replace("<head>", "<head>" + HEAD_EARLY, 1)
out = out.replace("</head>", GATE_CSS + "</head>", 1)
out = re.sub(r"(<body[^>]*>)", lambda m: m.group(1) + GATE_HTML, out, count=1)
out = out.replace("</body>", GATE_JS.replace("__PASS_HASH__", pass_hash) + "</body>", 1)

if out == html or "wh-gate" not in out:
    sys.exit("ERROR: injection failed — check <head>/<body>/</body> markers in site-source.html")

pathlib.Path("index.html").write_text(out, encoding="utf-8")
print(f"built overlay-gated index.html ({len(out)//1024} KB) | sha256={pass_hash[:12]}…")
