# Rehearsal: FeatureBento

Gold: `ruled-bento` for the frame (one container, 1px rules, no gaps), `bento`
for the tiles (measured Stage per picture, copy as page text, one beat each,
110ms apart). Changed: square corners and Geist, colours from the editor's
own tokens (`--syntax-*`, `--hl-*`, shadcn surfaces), so it follows the
site's light and dark themes; icons from Tabler, the app's pack.

Tiles: Sync (hero UI, 2 × 1), Local (stat, inverted), Compare (component),
Highlights (collection), Share (component). One window in the grid; no kind
beside itself at 3 columns.

Beats: status rolls pending → shipped in the tree, its code line follows
320ms later; the diff's changed figures mark in; six tags tint in, 90ms
apart; Copy link turns Copied. Each plays once on scroll-in; the poster is
the end state.

Captured: `film.mjs --gate` at 1100, 700 and 390 wide, all `rehearsal
passed`; stills in light and dark at 1100 and light at 390 and 700.

Film: `framing:` on the chips (plain tag names cut by the crop) → plain tags
are placeholders now, only the coloured ones carry words. Diff panel bleeding
12px → runs 40px past. Compact code pane cut mid-line → 4 whole lines.
Advisory lines cleared: tree twisty spacing, chip near-tangent, half-pixel
tick in the button.

Unresolved: coverage reported `inconclusive` (sampling gaps over 27ms on this
machine); not filmed with `--reduced` or `--states`; not placed on a real page
yet, so the host's own width and ground are unchecked.
