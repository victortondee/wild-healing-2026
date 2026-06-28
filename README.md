# WILD! Healing 2026

Single-page site for **WILD! Healing 2026** — a Restore Forward gathering.
Online Sept 17–18, on-the-land gathering Sept 19 in Ava, New York.

## Preview access

The site is currently a **private preview**: `index.html` is a branded password
screen that renders the full site once the correct password is entered
(remembered for 10 days per browser via `localStorage`). This is a soft gate for
casual visitors — the content is base64-embedded, not strongly encrypted.

- **`index.html`** — the published, password-gated page (fully self-contained).
- The plaintext source and the gate build script are kept locally, not in this repo.

## Hosting

Served via GitHub Pages from the repository root. Custom domain `wildgala.com`
(via Namecheap) to be connected.
