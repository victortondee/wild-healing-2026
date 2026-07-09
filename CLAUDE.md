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

## Parallel development — the Workbench (the main anti-conflict rule)

Because several chats edit `site-source.html` at once, **build every in-progress
section inside the Workbench** — the internal `#page-workbench` page (not linked
publicly; reachable at `#/workbench`) — in a block that only you touch. If every
chat stays inside its own uniquely-named block, `git pull --rebase` auto-merges
across chats (the blocks are disjoint line ranges), and conflicts survive only at
the few shared touch-points called out below.

**Claim a handle & block — once, before you build:**

1. `git pull --rebase origin main`.
2. Pick a short lowercase **handle** for this chat — a distinctive word + two
   digits, e.g. `heron7`, `slate3`. Read the `<!-- HANDLES-IN-USE: … -->` line at
   the top of `#page-workbench` and pick one **not** already listed.
3. Add your handle to that `HANDLES-IN-USE` line **and** paste an empty block
   skeleton just above the `<!-- WORKBENCH-END -->` sentinel. **Commit + push this
   skeleton immediately, before any real work.** If the push is rejected, `git pull
   --rebase` and retry; if the rebase shows a conflict on the `HANDLES-IN-USE` line
   (another chat grabbed the same handle at the same instant), pick a new handle.

**Your block** (id = `wip-<handle>-<slug>`):

```
<div class="wrap"><span class="eyebrow"><span class="tick"></span>WIP · heron7 · Day-Three hero · started:2026-07-06</span></div>
<section class="band" id="wip-heron7-day3hero"> … build here … </section>
```

- The section id **must** be `wip-<yourhandle>-<slug>` (unique in the DOM).
- **Every id AND every new class inside the block must also start
  `wip-<yourhandle>-`**, and prefer scoped selectors (`#wip-heron7-day3hero .card`)
  over new global classes. The SPA router/anchors use `getElementById` (first match
  wins) — a duplicate id silently misroutes.
- Keep work-in-progress CSS **inside the block**, in a scoped `<style>` under your
  block id. Don't add `:root` vars or global classes for WIP.

**The rules that actually prevent conflicts:**

- **Only ever edit your own `wip-<yourhandle>-*` block.** Never touch a block with a
  different handle (per *Merge conflicts* above: ask the user, never overwrite).
- **Stage explicit paths only — never `git add -A` / `git add .` / `git add -u` /
  `git commit -a`.** Use `git add site-source.html`. Those sweep another chat's
  uncommitted block (and `index.html`) into your commit. **Run `git status` before
  every commit; STOP if anything you didn't change is staged or dirty.**
- **Commit + push after every small edit.** Never leave uncommitted work sitting.
- **On an insertion conflict** (two chats appended a block at once): keep **both** —
  they're independent.

**Going live & cleanup — SOLO:**

- Moving a finished section from the Workbench into its real page location edits
  live/shared code and shifts line ranges file-wide → it is a **structural change:
  do it SOLO** (tell the user; no other chats mid-edit). Then **delete your
  Workbench block and remove your handle** from `HANDLES-IN-USE`.
- Add `· PAUSED <date>` to your block header if you pause. Any chat may **flag** a
  block older than ~7 days to the user or propose moving it to Drafts — but **never
  delete or overwrite another handle's block without asking the user.**

> Strongest fix if conflicts still bite: give each chat its own git worktree/clone
> so there is no shared working tree to bundle at all. The rules above are the
> discipline version of that for the shared-tree setup.

## ⛔ LOCK-AND-SCALE — the scaling LAW (STRICT · MANDATORY · read before adding OR editing ANYTHING)

The site is a **lock-and-scale** design: inside each breakpoint the whole page is **one
composition that zooms as a single unit** with the display width — like a poster being
scaled up or down. The root font-size tracks the viewport width
(`:root{ font-size: calc(100vw/N) }` per band), so **anything sized in `rem` scales with the
width.** That is what makes the design predictable — overlaid text stays locked over a
background image at every width in a band, and **text never re-wraps while it scales** (line
breaks stay proportionally fixed, so words never jump from row to row).

**This law is NON-NEGOTIABLE. It applies to:**
- **every new** section, page, component, hero, card, button — anything you add;
- **every edit** of existing code — you MUST keep it locked; never downgrade `rem` → `px`/`vw`,
  and if you touch code that already breaks the law, fix it while you are there.

### The rules — all of them, every time

1. **Size EVERYTHING in `rem`.** `font-size`, `margin`, `padding`, `gap`, `width`, `height`,
   `border-radius`, `inset`/`top`/`left`, **and image dimensions** — all `rem`. Because the root
   scales with width, all of it then zooms together as one unit.
2. **BANNED as a size value: `px`, `vw`, `vh`, and any `clamp()`/`min()`/`max()` that contains
   `px` or `vw`.** They do NOT track the root — they scale at the wrong rate or freeze, which is
   the direct cause of "some fonts don't scale with the width" and "words jump from row to row."
   - **No fluid type.** Never `clamp(2rem, 5vw, 4rem)` on a font. If a heading needs a different
     size per breakpoint, give it a **plain `rem` value per band** via the canonical media
     queries (`≤760`, `761–1024`, `≥1025`) — never a clamp/vw.
   - **Only** non-rem allowed: a `1px` hairline border/divider, and a genuinely fixed **dev-only**
     overlay (e.g. a debug badge). Nothing a visitor reads or sees as content.
   - Inherently-relative values are fine (`width:100%`, `aspect-ratio`, `%` background-position).
     A `%`/`vw` **font-size, or a fixed `px`/`vw` box dimension, is NOT.
3. **Never freeze the scale** — no `px` cap/min on a font or box, no fixed-px wrapper. Leave `rem`
   free to scale.
4. **Lock line breaks on display headings.** Scaling already keeps breaks in place, but to
   *guarantee* a heading can never re-flow, add `white-space:nowrap` and place the breaks manually
   with `<br>`. A heading must only ever zoom, never re-wrap.
5. **Images/media scale too** — `width` in `rem` (or `width:100%` of a rem box) + `aspect-ratio`.
   No fixed-px image sizes.
6. **Canonical breakpoints ONLY: 760 & 1024.** Mobile `@media (max-width:760px)`, tablet
   `@media (min-width:761px) and (max-width:1024px)`, desktop `@media (min-width:1025px)`.
   **Never** a breakpoint inside a band (no 600/900/1200 — that caused past bugs). `max-width:480px`
   is allowed ONLY for tiny-phone *layout* nudges inside the mobile band, never for scaling.

### Verify before EVERY commit
Resize the window slowly **within one breakpoint** (e.g. 1100→1400px, then 400→720px). **Every
element must grow/shrink together, and NO word may jump to another line.** If something holds a
fixed size while its neighbours scale, or a line re-wraps, you have a `px`/`vw`/`clamp` leak —
hunt it down and convert it to `rem`.

### The bands (root font-size) — NOW LIVE, uncapped
As of **2026-07-09** the live `site-source.html` runs the **uncapped lock-and-scale** root — the
whole site zooms per band, so `rem` in a section literally tracks the display width:
- **Mobile ≤760:** `calc(100vw/24.375)` · **Tablet 761–1024:** `calc(100vw/60)` · **Desktop ≥1025:** `calc(100vw/90)` (desktop + widescreen merged)
- A single `html{ overflow-x:clip }` contains the horizontal bleed uncapping introduces (header
  drawer, full-bleed images); never remove it.

The previous *capped* build (root pinned near 16px below 1440) is archived at
**`wild-healing-2026-v6.2-capped.html`** (Dashboard → Versions → "v6.2 — fixed-scale (archived)").
**Do not re-cap the root inside a section edit** — the uncapped root is the whole point; changing
it is a solo, site-wide decision (see below). Just build your section pure `rem` and it scales.
- Full spec = the CSS comment blocks in `site-source.html`: `v12 — MOBILE WIDTH-SCALING LOCK`,
  `TABLET WIDTH-SCALING LOCK`, `DESKTOP LOCK`, `v8 — SITEWIDE WIDTH-SCALING`.

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

## Verifying changes — don't; ship it and let the user check

**The user evaluates the result themselves and prefers SPEED over chats
self-verifying.** So by default **do NOT use `preview_eval`, the preview server,
`preview_screenshot`, or any other preview / browser tool** — they slow the
process a lot for little gain here. Reason about the CSS/HTML directly, make a
careful edit, commit + push, and let the user look at the live site and say if
anything is off. **Speed over agency.**

Only touch the preview if the **user explicitly asks** you to verify something in
the browser. (If so: the offscreen preview blanks `background-attachment:fixed`
sections and freezes animation clocks — measure via the DOM or a forced
screenshot rather than trusting `getComputedStyle` mid-animation.)
