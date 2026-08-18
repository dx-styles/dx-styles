# Keyframes

Use `keyframes(...)` to declare a shareable animation. It returns the animation name as a
deterministic string — use it as `animationName`, inside an `animation` shorthand, across files,
in recipe variants, and in theme values.

```ts
import { css, keyframes } from "dx-styles";

export const spin = keyframes({
  from: { transform: "rotate(0deg)" },
  to: { transform: "rotate(360deg)" },
});

export const spinner = css({
  animation: `${spin} 1s linear infinite`,
});
```

At build time the frames are extracted into a static `@keyframes` rule and every reference embeds
the same generated name. Frame keys (`from`, `to`, `"0%"`, `"20%, 60%"`) are used verbatim; frame
values are declaration objects — token contract references work like anywhere else:

```ts
import { tokens } from "./tokens";

export const slide = keyframes({
  "0%": { insetInlineStart: 0, opacity: 0.4 },
  "100%": { insetInlineStart: tokens.motion.distance, opacity: 1 },
});
```

Frames accept declarations only. Nested selectors, at-rules, and the `$rtl`/`$noflip` markers are
invalid inside `@keyframes` and fail the build with a pointed error.

## Local one-off animations

A `@keyframes` block nested inside `css()` also works and stays local to that rule: the compiler
scopes the name (suffixing it with the rule's class) and rewrites `animation`/`animation-name`
declarations in the same rule.

```ts
export const indicator = css({
  animation: "pulse 2s ease-in-out infinite",
  "@keyframes pulse": {
    from: { opacity: 0.4 },
    to: { opacity: 1 },
  },
});
```

**The scoped name is invisible outside the declaring rule.** A neighboring `css()` that references
`pulse` compiles to a dangling `animation-name: pulse` that silently matches nothing. Use
`keyframes(...)` for anything shared.

Referencing a global animation you own (e.g. one declared in a plain `.css` file) needs no
special syntax — a rule without inline keyframes never rewrites animation names:

```ts
export const octocat = css({
  animation: "octocat-wave 560ms ease-in-out",
});
```

To declare an inline `@keyframes` under a global (unscoped) name, put `:global(...)` on the
declaration key and reference it with the plain name — a global declaration is excluded from
scoping, so the plain reference is left alone:

```ts
export const wave = css({
  animation: "wave 2s infinite",
  "@keyframes :global(wave)": {
    from: { transform: "rotate(0)" },
    to: { transform: "rotate(10deg)" },
  },
});
```

Name collisions become your responsibility, as in plain CSS. Do not use `:global(...)` inside
`animation`/`animationName` **values** — it is not unwrapped there and ships invalid CSS
(a compiler parsing quirk, pinned by tests).

## Eval strategies

With the default transform strategy, the compiled consumer of an imported animation keeps a bare
`import "./motion";` — that import is what carries the declaring module's `@keyframes` rule into
your bundle. Under a forced `eval: { strategy: "execute" }` the import is inlined away: if the
declaring module has no other importers, its `@keyframes` rule silently drops out of the CSS and
the animation never runs. If you force the execute strategy, anchor the declaring module with a
bare side-effect import:

```ts
import "./motion"; // keeps the @keyframes rule in the bundle
import { spin } from "./motion";

export const spinner = css({ animationName: spin });
```

Same-file usage and runtime-position usage (`<div style={{ animationName: spin }} />`) are
unaffected in every strategy.
