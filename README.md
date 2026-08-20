# Sixth Wall Productions

The public site for Sixth Wall Productions — ritual theatre, immersive worlds, and story partnership.

**Live:** <https://sixthwall.productions>

The home page is a scroll narrative: a cube net unfolds through six walls as the
copy advances, then every face of the open cross gains depth — the six squares
become eight cubes, the unfolded hypercube of Dalí's *Corpus Hypercubus*,
standing upright against a flower-of-life lattice. Behind it are four long-form
pages — the walls, the rite, the worlds, partnership — and behind those, in
`canon/`, the source texts they are drawn from.

| Opening | Mid-unfold | Finale |
| --- | --- | --- |
| ![Opening](docs/screenshots/hero.jpg) | ![Mid-unfold](docs/screenshots/unfold.jpg) | ![Finale](docs/screenshots/finale.jpg) |

---

## Quick start

```bash
npm install
npm run dev        # http://localhost:4321
```

| Command | Does |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Static build into `dist/` |
| `npm run preview` | Serve the built output locally |
| `npm run check` | Typecheck `.astro` and `.ts` (runs in CI) |

Requires Node 22+ (see `.nvmrc`).

---

## How the site works

The whole page is driven by **one number**: scroll progress `p`, from 0 to 1.
Every animated property is a pure function of `p`, so the page holds no
animation state between frames and is fully scrubbable.

```
scroll position ──► p (0…1) ──► render(p)
                                  ├─ cube flaps unfold
                                  ├─ camera tilts / scales
                                  ├─ faces light
                                  ├─ copy panels cross-fade
                                  ├─ faces extrude into the hypercube cross
                                  └─ lattice resolves
```

### Where to change things

| To change… | Edit |
| --- | --- |
| **Copy** of any home-page panel | `src/content/panels/*.md` |
| **A long-form page** (add, edit, reorder) | `src/content/pages/*.md` — the filename is the route |
| **What the copy means** | `canon/*.md` — the source texts, with provenance |
| **When** a panel appears | `scrollIn` / `scrollOut` in that panel's frontmatter |
| **Order** of panels | `order` in frontmatter |
| **Animation timing / feel** | `src/config/choreography.ts` |
| **Overall pace** (faster / slower scroll) | `choreography.scrollLength` |
| **Name, domain, contact email, tagline** | `src/config/site.ts` |
| **Colour, type, cube size** | `src/styles/tokens.css` |
| **The render loop itself** | `src/scripts/scene.ts` |

### The timing contract

A wall panel's frontmatter is the *only* place its timing is written:

```yaml
face: 3              # lights cube face 3 and rail tick IV
scrollIn: 0.340
scrollOut: 0.435
```

Astro renders those onto the panel as `data-in` / `data-out` / `data-face`, and
`scene.ts` reads them back off the DOM. So the copy, the cube face and the
chapter rail all move together from one edit — they cannot drift apart.

`src/lib/panels.ts` fails the build if two panels claim the same `order` or the
same cube `face`, or if the scroll order contradicts the sort order.

### Pages

Every file in `src/content/pages/` becomes a route: `walls.md` → `/walls`.
Frontmatter carries `order`, `nav`, `eyebrow`, `title`, `lede` and
`description`; the body is markdown rendered through `src/layouts/Prose.astro`.
Navigation — the masthead and the doors at the foot of every page — is derived
from the collection, so adding a page is one file and nothing else.

The home page is the cube, closed; the pages are the net, unfolded. Both draw
on `canon/`, which is not built and is where the deeper material and its
provenance live. Read `canon/README.md` before editing either layer.

### Headings

Braces italicise a phrase, in panel headings, page titles and ledes, and in
`site.ts` copy alike:

```yaml
heading: Something wants to {be made}
```

→ Something wants to *be made*

Headings are escaped before the `<i>` is added, so frontmatter can never inject
markup (`src/lib/emphasis.ts`).

---

## Project layout

```
src/
  config/
    site.ts            identity, domains, contact, non-panel copy
    choreography.ts    every animation constant, named and typed
  content/
    panels/*.md        the ten scroll panels — copy + timing
    pages/*.md         the long-form pages — one file per route
  content.config.ts    collection schemas (validated at build)
  components/          Masthead, Rail, CubeNet, Hero, Panels, Closing, Doors
  layouts/
    Base.astro         document shell, meta, Open Graph, JSON-LD
    Prose.astro        the long-form page: head, markdown body, doors
  lib/                 emphasis helper, panel + page loading, invariants
  scripts/             scene.ts (render loop), easing.ts
  styles/              tokens, base, chrome, scene, copy, prose
public/                CNAME, favicon, og.jpg, robots.txt
canon/                 the source texts behind the copy — not built; read its README
docs/
  original-mockup.html the hand-built single-file original, for reference
```

### Why the CSS is global

`scene.ts` creates the cube walls and lattice circles at runtime. Astro's
scoped styles work by stamping an attribute onto elements at *build* time, so
scoped rules would silently never match those nodes. The stylesheets are
therefore plain global CSS, imported once in `Base.astro`.

---

## Deployment

Pushing to `main` triggers `.github/workflows/deploy.yml`, which typechecks,
builds, and publishes `dist/` to GitHub Pages. No manual step.

**Domains** (registrar: Namecheap, DNS: Namecheap BasicDNS)

| Domain | Role |
| --- | --- |
| `sixthwall.productions` | Canonical. Apex + `www` → GitHub Pages. |
| `sixthwallproductions.com` | Redirects to the canonical domain. |

The canonical hostname is written in three places that must agree:
`public/CNAME`, `site.url` in `src/config/site.ts`, and the GitHub Pages custom
domain setting. Change one, change all three.

See [`docs/INFRASTRUCTURE.md`](docs/INFRASTRUCTURE.md) for the full DNS records
and how to change domains.

---

## Roadmap

Deliberately deferred, in rough order of when they will matter:

- **Contact email** — `hello@sixthwall.productions` needs email forwarding
  enabled in the Namecheap dashboard. See `docs/INFRASTRUCTURE.md`.
- **Self-hosted fonts** — currently loaded from Google Fonts, which is a
  render-blocking third-party request and a privacy consideration.
- **Sincerely Ironic** — the apparel arm (Sixth Wall Productions DBA) lives at
  `sincerelyironic.com`. `site.ventures.apparel.live` flips the link on.
- **Second page** — the layout, collection and nav patterns are already in
  place; add `src/pages/<name>.astro`.
