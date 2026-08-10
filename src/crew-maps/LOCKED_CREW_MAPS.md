# Crew Maps — LOCKED

Locked August 10, 2026.

Do not change these items unless Taylor explicitly unlocks them:

1. **Taylor Scout shell** — Crew Maps uses the same canonical shell language as the locked Taylor Scout Bible: dark navy top bar, Taylor Scout / Production Tools brand, centered pin mark, dark navy left rail, teal active treatment, matching borders/button geometry/spacing/typography.
2. **No green template borders** — the show-logo box and directions box use neutral/black production-map borders. Green debug/accent outlines are not allowed.
3. **Route line is fully opaque** — the red Leaflet route line must render at `stroke-opacity: 1` / 100% opacity. Do not restore the previous 50% route transparency.
4. **Full map sheet must remain accessible** — the legal/letter sheet scales to the available canvas and the canvas scrolls independently. The bottom of the map/template must never be clipped by the browser viewport.
5. **Palette remains independently scrollable** — editing controls must not force the production sheet offscreen.
6. **Print preserves the full sheet** — shell/sidebar/palette are hidden for print and the full template occupies the print page.

These are canonical Crew Maps invariants. Future Crew Maps work should build inside them rather than replacing or restyling them.
