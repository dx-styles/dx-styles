---
"dx-styles": minor
---

Add `keyframes()` — deterministic animation names extracted at build time

`keyframes(frames)` declares a shareable animation and returns its name as a plain string: use it
as `animationName`, inside an `animation` shorthand, across files, in `recipe()` variants, and in
theme values. The frames are extracted into a static `@keyframes` rule at build time; the name
follows the same deterministic generation as `css()` class names. Frames accept declarations only
(token contract references included); nested selectors and `$rtl`/`$noflip` markers fail the build
with pointed errors.

The previously undocumented inline form — a `"@keyframes name"` block nested in `css()` — is now
documented and covered by tests: the compiler scopes the name per rule and rewrites same-rule
`animation` references, with `:global(...)` on the declaration key as the unscoped escape hatch.
Cross-rule references to inline names dangle silently, which is exactly what `keyframes()` is for.
See `docs/keyframes.md`, including the eval-strategy note for forced-`execute` setups.

Also fixed in passing: primitive fallback arrays (`opacity: [0, "0%"]`) now serialize as repeated
declarations in both `css()` rules and keyframes frames — previously they were silently dropped
from the emitted CSS. Class and animation names are unchanged.
