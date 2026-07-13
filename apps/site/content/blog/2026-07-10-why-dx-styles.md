---
title: I've maintained Linaria for six years. Here's why I built something new
description: Why the maintainer of Linaria and author of wyw-in-js built dx-styles — zero-runtime CSS-in-TS for design systems.
date: 2026-07-10
---

Runtime CSS-in-JS is winding down. styled-components has been in maintenance mode since early 2025,
Server Components made the runtime model a structural dead end, and the default advice is "just use
Tailwind." That advice is fine — for many teams it's correct, though the surveys read like a
complicated romance: [State of React 2025](https://2025.stateofreact.com/en-US/libraries/component-libraries/)
calls it a love/hate relationship, and "excessive Tailwind usage" is the only framework entry in
[State of CSS 2025's general pain points](https://2025.stateofcss.com/en-US/usage/#css_general_pain_points).
But if what you actually want is typed
styles, tokens, and variants living next to your components, the zero-runtime branch of CSS-in-JS is
where that lives, and I've spent the last six years in it: I maintain Linaria, and I'm the author of
[wyw-in-js](https://github.com/Anber/wyw-in-js) — the compile-time engine that powers Linaria and
MUI's Pigment CSS.

[dx-styles](https://github.com/dx-styles/dx-styles) is what I built after all of that. This post is
about why it exists.

## What six years of zero-runtime CSS-in-JS taught me

### Two problems I couldn't fix in Linaria

They came back over and over in the issue tracker, and neither is fixable without breaking what
Linaria is.

**First: `styled`'s component interpolation is priced wrong.** `${Component}` inside a template
looks free. In practice it's the single most common way extra code leaks into build-time
evaluation — and the most common reason static evaluation gives up and falls back to actually
running your module. Every mitigation we shipped over the years — explicit HOC hints in plugin
options, special heuristics for shaking interpolated components — is a patch on a pattern the API
itself encourages.

**Second: composition.** Linaria hands you `css` and `cx` and wishes you luck. People have asked
for style fragments for years, and I've pushed back every time: fragments would add chaos and
complexity without addressing the actual need. In a real design system, variants, slots, and themes
aren't advanced tricks — they're the ground floor. They belong in the styling library as first-class
citizens, not as conventions every team reinvents on top of it.

Both fixes move the center of gravity of the API. Remove `styled` — or even demote it — and you've
broken most of what's built on Linaria. So Linaria stays what it is, and stays maintained. The next
thing had to be a new thing.

### What Pigment CSS taught me

MUI built Pigment CSS on wyw-in-js, then put it on hold. My takeaway wasn't about MUI — it was
about **speed**. On a greenfield project, build time is a habit you form early. But when you
*migrate* an existing codebase and the styling step suddenly costs 10× the rest of the build,
that's a dealbreaker — I watched it happen. And 10× isn't the ceiling: I've seen style builds take
tens of minutes and tens of gigabytes of RAM.

That experience pushed wyw-in-js toward static evaluation: prove what can be proven at build time,
skip the evaluation sandbox entirely. The results so far are honestly mixed — but codebases that
evaluate fully statically build several times faster. And the pattern that most reliably ruins
static evaluation is the one from problem #1: `styled`.

dx-styles isn't perfect here either. A few of its processors still hit the JS fallback — creating a
token contract does, in some shapes. That's a known, solvable problem, and the fix lands with
wyw-in-js@3 and dx-styles@2.

## The trigger

My team started a component library from scratch, and Linaria turned out to be awkward in exactly
the places a design system lives: tokens, variants, multipart components. We tried Griffel — itself
a Linaria descendant, but through a fork that diverged around Linaria 3 and grew into a separate
engine with no cross-compatibility with the wyw ecosystem: atomic classes didn't fit what we were
building, and our custom processors would have meant maintaining two extraction pipelines side by
side. At some point the conclusion was hard to avoid: we had more accumulated mileage with
zero-runtime CSS-in-JS than anyone else, and we were spending it on working around our own tooling.

## What dx-styles is

```ts
import { createTheme, createTokenContract, css, recipe } from "dx-styles";

const tokens = createTokenContract(
  { color: { accent: null, accentFg: null } },
  { prefix: "app" },
);

const dark = createTheme(tokens, {
  color: { accent: "#7c8cff", accentFg: "#080a12" },
});

const button = recipe({
  base: { display: "inline-flex", borderRadius: "999px" },
  variants: {
    appearance: {
      primary: { backgroundColor: tokens.color.accent, color: tokens.color.accentFg },
      ghost: { backgroundColor: "transparent", color: tokens.color.accent },
    },
  },
  defaultVariants: { appearance: "primary" },
});

// <button className={button({ appearance: "ghost" })} />
```

At build time this becomes a static CSS file and plain class-name strings. Deterministic semantic
classes you can snapshot and cache on. Recipes and slot recipes with typed variants. Token
contracts instead of theme conventions. Opt-in compile-time RTL. No style runtime, no providers —
and the same components work unchanged in React Server Components.

## The part I didn't expect to be the best part

dx-styles is implemented as a set of wyw-in-js processors — and processors aren't limited to
styles. In a commercial product I work on, the same build step that extracts CSS also statically
executes parts of application logic and inlines the results, dropping dead weight from the bundle
at compile time. It's a macro mechanism you get for free with your styling pipeline. Writing your
own processor next to dx-styles is a supported extension point, not a hack — and every wyw-based
library interoperates in the same build.

## What I'm promising — and what I'm not

dx-styles is MIT and stays MIT. The issue tracker runs at zero open issues — and I owe you honesty
about how. If you've followed Linaria closely, you may have noticed maintenance slowing down through
2024–2025: boring triage was quietly eating the entire energy budget. Since last October, agents
have taken over that layer — turning reports into reproductions, bisecting regressions — and
maintainer time goes into the actual engineering; the fixes I still mostly write by hand. That's the
economics that makes zero-open-issues sustainable, and dx-styles gets it from day one.

wyw-in-js@3 has a written plan — the high-level roadmap is public
([stability page](https://wyw-in-js.dev/stability#roadmap-high-level),
[tracking issue](https://github.com/Anber/wyw-in-js/issues/114)) and the detailed plan goes further.
The honest constraint is volume: it's a lot of work, and its pace will scale with how much the
community cares about this direction. No dates.

Try it without installing anything: the
[Vite starter on StackBlitz](https://stackblitz.com/github/dx-styles/dx-styles/tree/main/examples/vite)
is a ready-made sandbox — a themed button demo you can poke, edit, and watch the extracted CSS
change; the [Next.js one](https://stackblitz.com/github/dx-styles/dx-styles/tree/main/examples/next)
runs the same components inside React Server Components. Prefer starting from scratch?
`npm install dx-styles` and the
[getting started guide](https://github.com/dx-styles/dx-styles/blob/main/docs/getting-started.md).
Migrating? There are dedicated guides for
[styled-components](https://github.com/dx-styles/dx-styles/blob/main/docs/migration/from-styled-components.md),
[Linaria](https://github.com/dx-styles/dx-styles/blob/main/docs/migration/from-linaria.md), and
[Pigment CSS](https://github.com/dx-styles/dx-styles/blob/main/docs/migration/from-pigment-css.md).
Issues — including hostile questions — welcome:
[github.com/dx-styles/dx-styles](https://github.com/dx-styles/dx-styles).

---

*Anton Evzhakov — maintainer of Linaria; author of wyw-in-js, the zero-runtime engine behind
Linaria and MUI's Pigment CSS.*
