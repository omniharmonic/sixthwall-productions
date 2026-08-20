# Sixth Wall Productions — working notes

Static marketing site. Astro 7, no framework integrations, deployed to GitHub
Pages on push to `main`. Read `README.md` first — it explains the architecture.

## Non-obvious constraints

**Styles must stay global.** `src/scripts/scene.ts` builds the mini cubes and
the lattice circles with `createElement` at runtime. Astro's scoped `<style>`
stamps a `data-astro-cid-*` attribute at build time, which runtime-created
nodes never receive — so scoped rules fail silently on exactly the elements
that need them. Add CSS to `src/styles/*.css`, not to component `<style>`
blocks, unless you are certain the element is server-rendered.

**Panel timing is authored once, in frontmatter.** `scrollIn`/`scrollOut`/
`face` in `src/content/panels/*.md` become `data-in`/`data-out`/`data-face`
attributes, which `scene.ts` reads back off the DOM to drive the copy, the cube
face lighting, *and* the chapter rail. Do not reintroduce a hardcoded window
array in JS — that was the original mockup's bug, with the same numbers written
in three places.

**Animation constants belong in `src/config/choreography.ts`.** If you find
yourself typing a decimal into `scene.ts`, it probably belongs there instead.
Distances that describe the net's own geometry go in face edges, not pixels —
`--S` halves at the mobile breakpoint, so a pixel constant silently means
something different on a phone.

**Idle motion must be bounded.** Anything driven by elapsed time rather than by
`p` has to be a `sway()`, never an accumulator. The scroll timeline blends idle
motion away as the visitor engages, so an unbounded one makes the cube unwind
everything it accumulated the moment you touch the wheel — 40 seconds of idling
used to cost a 224° spin at 400°/s. See the note on `sway()` in `easing.ts`.

**The canonical hostname appears in three places** and they must agree:
`public/CNAME`, `site.url` in `src/config/site.ts`, and the GitHub Pages custom
domain. See `docs/INFRASTRUCTURE.md`.

## Conventions

- Copy that is not a panel lives in `src/config/site.ts`, never inline in a
  component. The contact email in particular must stay a single reference.
- Braces mark italics in headings: `{like this}`. See `src/lib/emphasis.ts`.
  Never pass raw HTML through frontmatter.
- `src/lib/panels.ts` throws on incoherent timelines. Keep it that way — a
  duplicate `face` produces a site that builds fine and misbehaves in a browser.
- Timeline positions are always scroll progress in `[0, 1]`, never pixels.

## Verifying changes

`npm run check` typechecks and runs in CI. But a green build proves nothing
about the animation — it is all inline styles written per frame. To actually
verify a timing change, run `npm run preview` and drive it:

```js
// in the browser console
const max = document.documentElement.scrollHeight - innerHeight;
window.scrollTo(0, max * 0.40);          // jump to p = 0.40
// wait ~2s for the eased value to settle, then inspect:
[...document.querySelectorAll('.face')].filter(f => f.classList.contains('lit'));
```

Scroll input is smoothed (`choreography.smoothing`), so values need a second or
two to converge after a programmatic jump. The opening pose also carries a slow
idle sway, so it is only reproducible to within `orbit.idle` — compare
screenshots under `prefers-reduced-motion`, which zeroes it.
