# WILD! Healing 2026

Single-page site for **WILD! Healing 2026** — a Restore Forward gathering.
Online Sept 9–10, travel day Sept 11, on-the-land gathering Sept 12, 2026 in
Ava, New York. The event is over; the site now thanks visitors and points them
to WILD 2027. The site as it stood during the event is tag `wild-healing-2026-final`.

## Files

- **`site-source.html`** — the editable site (the actual content). **Edit this.**
- **`build-gate.py`** — regenerates the password-gated `index.html` from `site-source.html`.
- **`index.html`** — the **published, password-gated** page (built — do not edit by hand; it gets overwritten on rebuild). The real site loads normally with an opaque password overlay on top; the correct password removes it and is remembered for 10 days. Soft gate for casual visitors, not strong encryption.
- `CNAME` — custom domain (`wildgala.com`).

## Editing the site

1. Edit `site-source.html`.
2. Rebuild the gate:
   ```
   python3 build-gate.py <password>
   ```
3. Commit `site-source.html` and `index.html`.

## Hosting

Served via GitHub Pages from the repository root, live at **https://wildgala.com**
(custom domain via Namecheap).
