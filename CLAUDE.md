# WILD! Healing 2026 — working notes for Claude

This repo is a single static site. The live site is **https://wildgala.com**
(GitHub Pages, served from `index.html` on `main`, behind a soft password gate).

**This repo is edited by several Claude chats in parallel.** Follow the rules
below so chats don't overwrite or conflict with each other.

## What to edit

- **Edit only `site-source.html`** (and other source files like CSS/JS/images).
  This is the real, ungated site.
- **NEVER edit, build, stage, or commit `index.html`.** It is generated.
- **Do NOT run `build-gate.py`.** A GitHub Action rebuilds `index.html`
  automatically on every push to `main` (see `.github/workflows/build-gate.yml`).
  If you stage `index.html`, unstage it before committing.

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

## Verifying changes

Use the preview server (`.claude/launch.json` → `wildhealing`, port 8728) to
check changes locally. Note: the offscreen preview freezes CSS animation clocks,
so `getComputedStyle` may report `opacity:0` mid-animation even when a real
browser would show the content — force a paint (screenshot) to verify, or assert
on static (non-animated) styles.
