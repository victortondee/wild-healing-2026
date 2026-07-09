# WILD! Healing 2026 — working notes for Claude

This repo is a single static site. The live site is **https://wildgala.com**
(GitHub Pages, served from `index.html` on `main`). It is **public — no password
gate** (the gate was removed; `index.html` is now just a plain copy of
`site-source.html`).

**This repo is edited by several Claude chats in parallel.** Follow the rules
below so chats don't overwrite or conflict with each other.

## What to edit

- **Edit only `site-source.html`** (and other source files like CSS/JS/images).
  This is the real, ungated site.
- **NEVER edit, build, stage, or commit `index.html`.** It is generated.
- **Do NOT run `build-gate.py`.** A GitHub Action rebuilds `index.html`
  automatically on every push to `main` (see `.github/workflows/build-gate.yml`).
  If you stage `index.html`, unstage it before committing.

## Staging and live must ALWAYS be identical

The local **staging** site (the cloudflared tunnel / `python -m http.server` serving
`site-source.html` — see the `wild-healing-local-staging` memory) and the published
**live** site (`https://wildgala.com`, served from `index.html`) **must always show the
exact same thing.** Whatever appears on staging, a visitor must see on the live site,
and vice-versa — including the internal Drafts page (`#/drafts`).

- The live site serves **`index.html`**, which must always be a **current copy of
  `site-source.html`**. Normally the "Publish index.html" Action keeps it in sync. **But
  if that Action is queued/failing (GitHub Actions outages happen), live falls behind
  staging.** When that happens, restore parity yourself: `cp site-source.html index.html`
  and commit/push it in the same commit as your `site-source.html` change (the stuck
  Action later no-ops because the files already match). Never leave `index.html` ≠
  `site-source.html`. This overrides the "never commit index.html" note above **only**
  when the Action can't keep them in sync — the staging≡live invariant wins.
- **Syncing is copy-FORWARD only — it must NEVER lose work.** "Make them the same"
  always means copying `site-source.html` → `index.html`; it NEVER means deleting
  sections, drafts, or edits from either file to force a match. All drafts live inside
  `site-source.html` and are carried into `index.html` (they stay on the live site too —
  the Drafts page just isn't linked publicly). If the two ever differ, publish forward;
  do not remove anything.

## Drafts page convention

When adding a **new section to the Drafts page** (`#page-drafts` in
`site-source.html`), insert it at the **top** of the drafts area — newest first,
directly under the page intro — not appended at the bottom. Each draft gets its
own labeled `<div class="wrap"><span class="eyebrow">…</span></div>` header above
the section.

**Give every new draft section a unique ID so the user can point Claude at it.**
Put the ID **visibly** in the draft's eyebrow header, in the form:

`Draft · <ID> · <short description>`

Use the next free `D-NN` tag (`D-01`, `D-02`, `D-03`, …) — short, and **never
reused**, even after a draft is deleted. Also set it as an anchor on the section
wrapper, e.g. `id="draft-D-03"`, so it's unique in the DOM. Because the ID is
shown on the page, the user can simply say "change draft D-03" and Claude knows
exactly which section they mean.

## Git workflow (do this yourself — the user shouldn't touch git)

Work directly on `main`. For every change:

1. `git pull --rebase origin main` **before** you start editing, and again
   right before pushing, so you're on the latest version.
2. Make a small, focused edit to `site-source.html`.
3. Commit with a clear message (do **not** include `index.html`):
   `git add site-source.html && git commit -m "..."`
4. `git push`. **If the push is rejected** (another chat pushed first):
   run `git pull --rebase` and `git push` again. Repeat until it succeeds.
5. Commit and push promptly. Never leave uncommitted edits sitting while other
   chats may be working.

After you push, the Action rebuilds and commits `index.html` for you. Your next
`git pull --rebase` will pick that up — that's expected, ignore it.

## Merge conflicts

A `git pull --rebase` may hit a conflict in `site-source.html`:

- **Different sections / clearly resolvable** (e.g. your change and theirs are
  independent, or one obviously supersedes the other) → resolve it, keep both
  intents where possible, and note what you did in your reply.
- **Same lines, ambiguous intent** (you can't tell which version should win) →
  **STOP and ask the user which version to keep.** Never overwrite the other
  chat's work on a guess. Nothing should be silently lost.

## Tips to avoid conflicts entirely

- Keep changes small and push often.
- When practical, different chats should work on **different sections** of
  `site-source.html` — same-line conflicts then basically never happen.

## Structural / global changes = do them SOLO

Section separation only protects **localized** edits. A change is *cross-cutting*
when it touches shared or structural code that affects the whole site, e.g.:

- global CSS (`:root` variables, `.hero`, `.btn`, shared classes),
- the router / page JS, the header / nav, or `<head>`,
- architecture rebuilds: restructuring page containers, renaming classes,
  splitting/reordering/moving large regions (these shift line ranges everywhere
  and can conflict even across "different" sections).

If the user asks for a structural or global change, **tell them it should be done
solo** — i.e. no other chats editing `site-source.html` at the same time. Do the
structural work in one chat, commit + push it, then parallel section work can
resume on top of it. Don't start a cross-cutting edit while other chats may be
mid-edit.

## Verifying changes

**Avoid `preview_eval` (and the preview server) as much as possible — it slows
the process a lot.** Prefer reasoning about the CSS/HTML directly and trusting a
careful edit. Use the preview only **rarely, when verification is genuinely
unavoidable** (e.g. you can't otherwise be confident a layout/visual change is
correct). For most edits, skip it and just commit.

If you do need it: use the preview server (`.claude/launch.json` → `wildhealing`,
port 8728). Note the offscreen preview freezes CSS animation clocks, so
`getComputedStyle` may report `opacity:0` mid-animation even when a real browser
would show the content — force a paint (screenshot) to verify, or assert on
static (non-animated) styles.
