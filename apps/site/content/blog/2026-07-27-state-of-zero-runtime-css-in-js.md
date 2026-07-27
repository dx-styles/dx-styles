---
title: The state of zero-runtime CSS-in-JS, mid-2026
description: A field map of compile-time CSS-in-JS after styled-components froze and Pigment CSS went on hold — vanilla-extract, Panda, StyleX, next-yak, Linaria, dx-styles, and how to choose between them.
date: 2026-07-27
---

Two disclosures before the map. I maintain Linaria, and I built dx-styles, one of the libraries below. You are reading a biased cartographer. The bias is labeled, the facts are linked, and corrections are welcome: file an issue and I will fix the map loudly.

## How we got here

For most of a decade, CSS-in-JS meant a runtime: styled-components and Emotion computed styles during render and injected them into the document. It was a great authoring model, and it worked because React rendered synchronously on the client and nowhere else.

Then React changed shape underneath it. Concurrent rendering made render-time style injection a performance liability. Server Components made client-side style runtimes structurally awkward: there is no good place to inject styles from a component that never ships to the browser. The ecosystem read the signals. styled-components went into [maintenance mode in March 2025](https://styled-components.com/blog/celebrating-a-decade-of-styled-components). MUI started Pigment CSS as a compile-time successor for its own needs, then [put it on hold in alpha](https://github.com/mui/pigment-css). The default advice became "just use Tailwind," which is fine advice for many teams, though the surveys describe a complicated relationship: [State of React 2025](https://2025.stateofreact.com/en-US/libraries/component-libraries/) calls it love/hate, and "excessive Tailwind usage" is the only framework entry in [State of CSS 2025's general pain points](https://2025.stateofcss.com/en-US/usage/#css_general_pain_points).

What survived on the CSS-in-JS side is the branch that never needed a runtime in the first place.

## Why compile-time is the branch that lived

The idea is old and simple: styles written in JS or TS are data, and data can be evaluated at build time. The compiler runs your style declarations during the build, writes real .css files, and leaves plain class-name strings in your JavaScript. Nothing injects anything at runtime, there is no provider, and nothing needs to cross the Server Component boundary, because by the time React runs, styling is just strings.

You keep the parts people actually liked about CSS-in-JS: styles colocated with components, typed values, tokens as code. You pay for it with a build step and with discipline about what can be statically evaluated. That trade is the whole category.

## The map

**vanilla-extract** is the TypeScript answer to CSS Modules. Styles live in separate `.css.ts` files, themes are typed contracts, and the recipes package covers variant-driven components. It is mature, stable, and predictable. The main friction is the file split: styles do not live in the component file, and some teams never stop missing that.

**Panda CSS** is config-first and atomic: you describe tokens, recipes, and patterns in a config, a codegen step produces a styled-system folder, and output CSS is deduplicated utility classes. It has the richest ecosystem in the category and reads familiar to people coming from Chakra. The costs are the codegen artifact in your repo and the atomic model itself, which is a real trade-off rather than a free win: great dedup at app scale, opaque class soup in DevTools.

**StyleX** is Meta's production system: atomic output, strict constraints, deterministic merging, designed for codebases with thousands of contributors. The constraints are the feature. If your problem is "hundreds of teams keep overriding each other's styles," StyleX solves something almost nothing else solves. If your problem is smaller than that, the constraints mostly show up as friction.

**next-yak** takes the opposite entrance: keep the styled-components authoring model, compile it away. A Rust compiler turns styled syntax into static CSS, dynamic props become CSS custom properties, and the result is RSC-compatible with production numbers to back it at [Digitec Galaxus scale](https://yak.js.org/). If you have a large styled-components codebase and want off the runtime without a rewrite, this is the newest of the two direct paths, and the fastest-building one.

**Linaria** is the original zero-runtime library and the reason half this category exists. It was built as a drop-in replacement for styled-components, and it still is one: the same styled syntax, no runtime. It is maintained and stable; new engine work happens in [wyw-in-js](https://github.com/Anber/wyw-in-js), the compiler underneath it. That shared engine has a practical consequence: Linaria code and dx-styles code extract in one build, so the two can coexist and migrate file by file. For brand-new design-system work I would point you at the newer generation, and I say that as Linaria's maintainer.

**dx-styles** is my entry, so read this paragraph with the disclosure in mind. It is built on the same wyw-in-js engine as Linaria, but API-first for design systems: semantic deterministic class names, typed recipes and slot recipes, token contracts instead of theme conventions, opt-in compile-time RTL. It also answers the question every compiled pipeline eventually gets asked: the explain tooling traces any class in the emitted CSS back to the exact source declaration that produced it. If you are building a component library rather than an app, that is the niche it was made for. The launch post explains [why it exists](https://dx-styles.dev/blog/why-dx-styles/).

Honorable mention: **Griffel**, Microsoft's atomic engine under Fluent UI. It descends from an early Linaria fork and serves Fluent well, but it is its own ecosystem with little interop outside it.

And the honest exits: **Tailwind** and **CSS Modules** are not CSS-in-JS, and for plenty of teams they are the right answer. Leaving the category entirely is a legitimate migration target, not a failure state.

## The same map as a table

| | dx-styles | Linaria | next-yak | vanilla-extract | Panda CSS | StyleX |
|---|---|---|---|---|---|---|
| Zero runtime | yes | yes ¹ | yes ¹ | yes | yes | mostly ² |
| Styles colocated in components | yes | yes | yes | no (`.css.ts`) | yes | yes |
| Recipes / slot recipes | yes / yes | no | no (styled API) | yes ³ / no | yes / yes | pattern, not API |
| Token contracts + themes | yes | manual CSS vars | manual CSS vars ⁴ | yes | yes | yes |
| Compile-time RTL | yes | no | not documented | no | logical properties | logical properties |
| Status | active | maintained, stable | active | active | active | active |

¹ Dynamic interpolations in the styled API compile to CSS custom properties.
² Ships a small runtime for style merging.
³ Via `@vanilla-extract/recipes`.
⁴ next-yak cells reflect its public docs as of 9.7; corrections welcome.

Pigment CSS is missing from the table on purpose: it remains in alpha and on hold, and recommending it today would not be a kindness. There are [migration guides](https://github.com/dx-styles/dx-styles/tree/main/docs/migration) off it, mine included.

## How to choose

Skip the feature grids and start from your situation.

You have a big styled-components codebase and the runtime hurts: two direct paths keep your syntax. next-yak compiles it away with a Rust toolchain and, credit where due, builds faster. Linaria is the veteran drop-in, and its shared engine with dx-styles makes it double as an on-ramp: land on Linaria first, then drift toward recipes and token contracts file by file in the same build, with no second migration event.

You are building an app and want typed styles with minimal ceremony: vanilla-extract if you accept the file split, Panda if you want atomic output and a batteries-included config.

You are building a component library or a design system: you want semantic stable class names, typed variants, and token contracts that survive being consumed by other people's builds. That is dx-styles' niche, and vanilla-extract is the other serious candidate.

You operate at hundreds-of-teams scale and your enemy is style collisions: StyleX, and take the constraints as the point.

You mostly want to stop thinking about this: Tailwind or CSS Modules, honestly.

## Where the category is heading

Convergence, from every direction at once. Every surviving library compiles to some flavor of "plain element with class names." Even the styled authoring model now folds away at build time rather than executing at runtime. The differences that remain are real but narrower: atomic versus semantic output, config-first versus code-first authoring, and how much of the design-system layer (tokens, variants, slots) is first-class API versus your own convention.

Build cost is becoming the next battleground now that runtime cost is largely solved, and it is converging too. Independent numbers exist for part of the field: [css-in-js-bench](https://jantimon.github.io/css-in-js-bench/) measures both runtime behavior and build overhead across seventeen techniques, though the wyw-in-js family is not in it yet. I am publishing a reproducible build-time harness covering that side as a follow-up post, with numbers you can rerun rather than take on faith.

The map will be wrong in six months, which is the healthiest thing I can say about this category. File corrections, I will keep it honest.

---

*Anton Evzhakov maintains Linaria and is the author of wyw-in-js, the zero-runtime engine behind Linaria and MUI's Pigment CSS. He builds dx-styles.*
