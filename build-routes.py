#!/usr/bin/env python3
"""Publish index.html plus a real, crawlable page per SPA route — and the sitemap.

Why this exists
---------------
The site is one hash-routed single-page app. Search engines ignore the #fragment,
so /#/info and /#/gathering are not URLs to a crawler — the whole site collapses
into a single indexable page (/), and everything below the hash is invisible.
The 2025 "WILD! Miracles" site had real paths, which is why a dead /info still
outranked the live 2026 content.

GitHub Pages is static: there are no rewrites, so the only way to answer 200 at
/info/ is for a real file to exist there. This script emits one per public route:
each is the same app, with route-specific <title>/description/canonical/OG tags.
On boot the router sees the path, switches to that route, and normalises the URL
back to /#/route (see the init block in site-source.html), so visitors get the
identical SPA and crawlers get a distinct URL with distinct rendered content.

Chats edit site-source.html only. Everything this script writes is generated —
never hand-edit index.html, the route folders, or sitemap.xml.

Usage:  python3 build-routes.py
"""
import pathlib
import re
import sys

SITE = "https://wildgala.com"
SOURCE = pathlib.Path("site-source.html")

# Public routes only. Internal routes (archive, drafts, workbench, dashboard) are
# deliberately absent: they're reachable by hash for the team but must never get a
# crawlable URL of their own.
#
# route: (title, meta description)
ROUTES = {
    "invitation": (
        "The Invitation — WILD! Healing Gala 2026",
        "A love letter to those who have survived illness and those who stand "
        "beside them. WILD! Healing — A Harvest of Medicine, September 9–12, 2026.",
    ),
    "info": (
        "Info — WILD! Healing Gala 2026 | Dates & Location",
        "Dates, location, travel and lodging for WILD! Healing — A Harvest of "
        "Medicine. Online September 9–10, 2026; on the land at Restore Forward, "
        "Ava, New York, September 12.",
    ),
    "journey": (
        "The Journey — WILD! Healing Gala 2026",
        "The medicine walk begins: two days of virtual immersion across a living "
        "landscape of ancestral healing, September 9–10, 2026, leading to the land.",
    ),
    "gathering": (
        "The Gathering — WILD! Healing Gala 2026",
        "Feast and festival in the woods on the land at Restore Forward, Ava, New "
        "York — September 12, 2026. Long tables beneath the trees, and the "
        "honoring of those who heal.",
    ),
    "attend": (
        "Tickets & Attend — WILD! Healing Gala 2026",
        "Come walk with us. Tickets, lodging and how to arrive for WILD! Healing — "
        "A Harvest of Medicine, September 9–12, 2026, Ava, New York.",
    ),
    "contact": (
        "Contact — WILD! Healing Gala 2026",
        "Reach the circle. Get in touch about WILD! Healing — A Harvest of "
        "Medicine, presented by Restore Forward.",
    ),
    "luminaries": (
        "Past Luminaries — WILD! Healing Gala 2026",
        "Honoring the supporters and partners whose extraordinary work and "
        "enduring legacies enrich our lives.",
    ),
    "speaker-jb": (
        "Dr. Dieudonné Jean-Baptiste — WILD! Healing Gala 2026",
        "Dr. Dieudonné Jean-Baptiste at WILD! Healing — A Harvest of Medicine, "
        "September 9–12, 2026.",
    ),
    "speaker-stoff": (
        "Dr. Jesse Stoff — WILD! Healing Gala 2026",
        "Dr. Jesse Stoff at WILD! Healing — A Harvest of Medicine, "
        "September 9–12, 2026.",
    ),
}

# Static pages that already live at a real path and should stay in the sitemap.
STATIC_PAGES = ["privacy.html", "terms.html", "disclaimer.html"]


def esc(value: str) -> str:
    """Escape for an HTML double-quoted attribute."""
    return value.replace("&", "&amp;").replace('"', "&quot;")


def retag(html: str, pattern: str, replacement: str, label: str) -> str:
    """Replace exactly one head tag, failing loudly if the source drifted.

    A silent miss would ship a route page carrying the homepage's canonical, which
    tells Google the page is a duplicate — worse than not generating it at all.
    """
    out, count = re.subn(pattern, replacement.replace("\\", "\\\\"), html, count=1)
    if count != 1:
        sys.exit(f"build-routes: could not rewrite {label} (matched {count}x). "
                 "Did the <head> of site-source.html change?")
    return out


def build_page(source: str, route: str, title: str, description: str) -> str:
    url = f"{SITE}/{route}/"
    t, d = esc(title), esc(description)
    html = retag(source, r"<title>.*?</title>", f"<title>{t}</title>", "title")
    for pat, rep, label in [
        (r'<meta name="description" content="[^"]*"',
         f'<meta name="description" content="{d}"', "description"),
        (r'<link rel="canonical" href="[^"]*"',
         f'<link rel="canonical" href="{url}"', "canonical"),
        (r'<meta property="og:title" content="[^"]*"',
         f'<meta property="og:title" content="{t}"', "og:title"),
        (r'<meta property="og:description" content="[^"]*"',
         f'<meta property="og:description" content="{d}"', "og:description"),
        (r'<meta property="og:url" content="[^"]*"',
         f'<meta property="og:url" content="{url}"', "og:url"),
        (r'<meta name="twitter:title" content="[^"]*"',
         f'<meta name="twitter:title" content="{t}"', "twitter:title"),
        (r'<meta name="twitter:description" content="[^"]*"',
         f'<meta name="twitter:description" content="{d}"', "twitter:description"),
    ]:
        html = retag(html, pat, rep, f"{route}: {label}")
    return html


def build_sitemap() -> str:
    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
             f'  <url><loc>{SITE}/</loc><changefreq>weekly</changefreq>'
             f'<priority>1.0</priority></url>']
    for route in ROUTES:
        lines.append(f'  <url><loc>{SITE}/{route}/</loc><changefreq>weekly</changefreq>'
                     f'<priority>0.8</priority></url>')
    for page in STATIC_PAGES:
        lines.append(f'  <url><loc>{SITE}/{page}</loc><changefreq>yearly</changefreq>'
                     f'<priority>0.3</priority></url>')
    lines.append("</urlset>")
    return "\n".join(lines) + "\n"


def main() -> None:
    if not SOURCE.exists():
        sys.exit("build-routes: site-source.html not found")
    source = SOURCE.read_text(encoding="utf-8")

    # The route pages rely on this init block to boot from the path. If it ever
    # disappears, every /route/ page would silently render the home page.
    if 'history.replaceState(null, "", "/#/" + p)' not in source:
        sys.exit("build-routes: the path->hash init block is missing from "
                 "site-source.html — route pages would all render home.")

    pathlib.Path("index.html").write_text(source, encoding="utf-8")
    print("index.html")

    for route, (title, description) in ROUTES.items():
        folder = pathlib.Path(route)
        folder.mkdir(exist_ok=True)
        (folder / "index.html").write_text(
            build_page(source, route, title, description), encoding="utf-8")
        print(f"{route}/index.html")

    pathlib.Path("sitemap.xml").write_text(build_sitemap(), encoding="utf-8")
    print("sitemap.xml")


if __name__ == "__main__":
    main()
