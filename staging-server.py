#!/usr/bin/env python3
"""Staging server for the WILD! Healing site.

Serves the repo exactly like `python -m http.server`, PLUS a token-gated write
endpoint so mark-tool.js's Save button can persist element edits straight into
site-source.html — no copy/paste round-trip.

    python3 staging-server.py [port]        # prints the token on startup

SECURITY — read before touching this. This process is normally exposed to the
public internet through a cloudflared tunnel, and anything it writes lands in
site-source.html, which gets committed to a LIVE PUBLIC SITE. A write endpoint
here is therefore a content-injection vector, not just a dev convenience. Two
defences, both required:

  1. A random per-launch token. No token, no write.
  2. Strict allowlisting of every selector, property and value that arrives over
     the wire — because a token can leak, and `</style>` smuggled into a
     selector would inject markup into the published page.

Source of truth for saved rules is mark-edits.json. The <style id="mt-edits">
block in site-source.html is regenerated from it wholesale on each save.
"""
import http.server, json, os, re, secrets, socketserver, sys, threading

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "site-source.html")
EDITS = os.path.join(ROOT, "mark-edits.json")
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8090
TOKEN = os.environ.get("MT_TOKEN") or secrets.token_urlsafe(9)
LOCK = threading.Lock()

START, END = "/* MT-EDITS:START */", "/* MT-EDITS:END */"

# Canonical bands — must mirror the media queries in site-source.html.
BANDS = {
    "mobile":  "@media (max-width:760px)",
    "tablet":  "@media (min-width:761px) and (max-width:1024px)",
    "desktop": "@media (min-width:1025px)",
}

# A selector may only look like a selector. No braces, no semicolons, and
# crucially nothing that could close the <style> element and inject markup.
SEL_RE = re.compile(r'^[A-Za-z0-9_\-#.\s>:()\[\]="\',*+~]{1,300}$')
PROP_RE = re.compile(
    r'^(position|left|top|right|bottom|width|height|font-size|line-height|'
    r'letter-spacing|gap|border-radius|opacity|z-index|'
    r'margin(-(top|right|bottom|left))?|padding(-(top|right|bottom|left))?)$')
# rem is the site's scaling law (see CLAUDE.md); % and keywords are the only
# other things worth allowing. px/vw are deliberately NOT accepted.
VAL_RE = re.compile(r'^(-?\d{1,5}(\.\d{1,4})?(rem|%)?|relative|absolute|static|fixed|auto|none)$')


def bad(s):
    return "</" in s or "{" in s or "}" in s or ";" in s or "*/" in s


def load():
    try:
        with open(EDITS, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def render(data):
    """Rebuild the CSS block from the manifest. Deterministic ordering."""
    out = []
    for band in ("mobile", "tablet", "desktop"):
        rules = data.get(band) or {}
        if not rules:
            continue
        out.append(BANDS[band] + "{")
        for sel in sorted(rules):
            decls = "; ".join("%s:%s" % (k, v) for k, v in sorted(rules[sel].items()))
            out.append("  %s{ %s; }" % (sel, decls))
        out.append("}")
    return "\n".join(out)


def write_source(css):
    with open(SRC, encoding="utf-8") as f:
        html = f.read()
    i, j = html.find(START), html.find(END)
    if i == -1 or j == -1:
        raise RuntimeError("MT-EDITS markers not found in site-source.html")
    body = ("\n" + css + "\n") if css.strip() else "\n"
    new = html[:i + len(START)] + body + html[j:]
    tmp = SRC + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:      # atomic: never leave a half-written page
        f.write(new)
    os.replace(tmp, SRC)


class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def log_message(self, fmt, *args):
        if "__mt-save" in (self.path or ""):
            super().log_message(fmt, *args)

    def _json(self, code, obj):
        b = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(b)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(b)

    def end_headers(self):
        # staging must never serve a stale page — this exists to beat the deploy wait
        if "__mt-save" not in (self.path or ""):
            self.send_header("Cache-Control", "no-store, must-revalidate")
        super(http.server.SimpleHTTPRequestHandler, self).end_headers()

    def do_OPTIONS(self):
        self._json(200, {"ok": True})

    def do_POST(self):
        if self.path.split("?")[0] != "/__mt-save":
            return self._json(404, {"error": "not found"})
        try:
            n = int(self.headers.get("Content-Length") or 0)
            if n > 20000:
                return self._json(413, {"error": "too large"})
            req = json.loads(self.rfile.read(n) or b"{}")
        except Exception as e:
            return self._json(400, {"error": "bad json: %s" % e})

        if not secrets.compare_digest(str(req.get("token", "")), TOKEN):
            return self._json(403, {"error": "bad token"})

        band = req.get("band")
        if band not in BANDS:
            return self._json(400, {"error": "unknown band %r" % band})

        sel = (req.get("selector") or "").strip()
        if not sel or bad(sel) or not SEL_RE.match(sel):
            return self._json(400, {"error": "rejected selector"})

        decls = req.get("decls") or {}
        if not isinstance(decls, dict) or len(decls) > 12:
            return self._json(400, {"error": "bad decls"})
        clean = {}
        for k, v in decls.items():
            k, v = str(k).strip(), str(v).strip()
            if not PROP_RE.match(k):
                return self._json(400, {"error": "property not allowed: %s" % k})
            if bad(v) or not VAL_RE.match(v):
                return self._json(400, {"error": "value not allowed: %s: %s" % (k, v)})
            clean[k] = v

        with LOCK:
            data = load()
            data.setdefault(band, {})
            if clean:
                data[band][sel] = clean
            else:
                data[band].pop(sel, None)       # empty decls = revert this rule
            if not data[band]:
                data.pop(band)
            css = render(data)
            try:
                write_source(css)
            except Exception as e:
                return self._json(500, {"error": str(e)})
            with open(EDITS, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, sort_keys=True)
                f.write("\n")
        return self._json(200, {"ok": True, "band": band, "selector": sel,
                                "saved": clean, "rules": sum(len(v) for v in data.values())})


class S(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


if __name__ == "__main__":
    print("staging-server: http://0.0.0.0:%d  (root: %s)" % (PORT, ROOT))
    print("MT_TOKEN=%s" % TOKEN)
    S(("0.0.0.0", PORT), H).serve_forever()
