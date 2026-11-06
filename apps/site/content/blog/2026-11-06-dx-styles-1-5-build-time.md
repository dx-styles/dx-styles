---
title: "dx-styles 1.5.0: half the build time, and a benchmark you can rerun"
description: dx-styles 1.5.0 requires wyw-in-js 2.7.1, which halves the build of a design-system-sized scene. The numbers come from a public benchmark that builds the same scene with eight other libraries and plain CSS Modules.
date: 2026-11-06
---

dx-styles 1.5.0 is out. It requires wyw-in-js 2.7.1, and that is where the speed comes from. On a generated design-system scene with 1,308 recipe variants, going from dx-styles 1.4.1 on wyw-in-js 2.4.4 to 1.5.0 on 2.7.1 takes a warm production build from 1.34 s to 0.68 s (−49%). With all styles in one module, it goes from 1.79 s to 0.78 s (−56%).

On wyw-in-js 2.7.1, dx-styles 1.4.1 and 1.5.0 build byte-identical bundles in the same time. If you already updated your bundler integration, you have had this speed for a while; 1.5.0 makes 2.7.1 the minimum.

In July I promised a build-time benchmark with numbers you can rerun rather than take on faith. It ships with this release: [dx-styles/benchmarks](https://github.com/dx-styles/benchmarks). It builds the same scene with dx-styles, eight other libraries and plain CSS Modules, and the results include the cases where dx-styles does not win.

## Where the speed comes from

dx-styles is a set of processors on top of [wyw-in-js](https://github.com/Anber/wyw-in-js), the engine that also runs Linaria. A build evaluates your style declarations, writes the CSS and leaves class names in the JavaScript, and most of that time is spent in the engine.

Two releases did most of the work, and the two layouts of the scene respond to them differently.

wyw-in-js 2.5 made parsing cheaper on large projects: the parser hands its AST over without a JSON round trip, and parse results are shared between files. When the styles are spread over 41 modules, this is the bigger step, from 1.35 s to 0.91 s.

wyw-in-js 2.6 stopped several passes from doing their work once per styled declaration. CSS extraction used to copy the rules collected so far for every processor in a file, so its cost grew with the square of the number of styles; now the rules are merged in place, and the Stylis plugin chain is built once per file. The check of whether processor tags are referenced walked the whole program once per tag and now walks it once. With all styles in one module, this step is the larger one, from 1.34 s to 0.78 s, as you would expect from a cost that grew with the number of styles per file.

wyw-in-js 2.4 takes off 6 to 8%. 2.7 fixes an exponential loop check on deep module graphs, which does not show on this scene because its graph is shallow. The release also picks up the correctness fixes of wyw-in-js 2.5 to 2.7, and [the changelog](https://github.com/dx-styles/dx-styles/blob/main/CHANGELOG.md#150) lists the ones that reach dx-styles builds.

## Build time by wyw-in-js release

<figure class="chart">
<svg viewBox="0 0 600 330" width="100%" role="img" aria-labelledby="build-chart-title build-chart-desc" style="display:block;max-width:680px;height:auto;font-family:system-ui,sans-serif">
<title id="build-chart-title">dx-styles warm build time by wyw-in-js release</title>
<desc id="build-chart-desc">Line chart, two series. With per-component modules the build takes 1.43 s on wyw-in-js 2.3.0, 1.35 s on 2.4.4, 0.91 s on 2.5.1, 0.68 s on 2.6.0 and 0.68 s on 2.7.1. With one styles module it takes 1.94, 1.78, 1.34, 0.78 and 0.78 s. Both series drop most at 2.5.1 and 2.6.0 and stay flat from 2.6.0 to 2.7.1.</desc>
<g font-size="14" fill="#cdd3e6">
<line x1="40" y1="20" x2="64" y2="20" stroke="#d95926" stroke-width="2"/><circle cx="52" cy="20" r="4.5" fill="#d95926" stroke="#080a12" stroke-width="2"/>
<text x="72" y="25">One styles module</text>
<line x1="230" y1="20" x2="254" y2="20" stroke="#3987e5" stroke-width="2"/><circle cx="242" cy="20" r="4.5" fill="#3987e5" stroke="#080a12" stroke-width="2"/>
<text x="262" y="25">Per-component modules (41)</text>
</g>
<g stroke="#1c2233" stroke-width="1">
<line x1="56" y1="280" x2="520" y2="280" stroke="#2a3350"/>
<line x1="56" y1="222" x2="520" y2="222"/>
<line x1="56" y1="164" x2="520" y2="164"/>
<line x1="56" y1="106" x2="520" y2="106"/>
<line x1="56" y1="48" x2="520" y2="48"/>
</g>
<g font-size="13" fill="#9aa3c0" text-anchor="end">
<text x="46" y="284">0 s</text>
<text x="46" y="226">0.5</text>
<text x="46" y="168">1.0</text>
<text x="46" y="110">1.5</text>
<text x="46" y="52">2.0 s</text>
</g>
<g font-size="13" fill="#9aa3c0" text-anchor="middle">
<text x="56" y="301">2.3.0</text>
<text x="172" y="301">2.4.4</text>
<text x="288" y="301">2.5.1</text>
<text x="404" y="301">2.6.0</text>
<text x="520" y="301">2.7.1</text>
<text x="288" y="324" fill="#5a627a">wyw-in-js release · dx-styles 1.3.0 · median of 7 warm builds</text>
</g>
<polyline points="56,55 172,73.5 288,124.6 404,189.5 520,189.5" fill="none" stroke="#d95926" stroke-width="2" stroke-linejoin="round"/>
<polyline points="56,114.1 172,123.4 288,174.4 404,201.1 520,201.1" fill="none" stroke="#3987e5" stroke-width="2" stroke-linejoin="round"/>
<g fill="#d95926" stroke="#080a12" stroke-width="2">
<circle cx="56" cy="55" r="4.5"><title>One styles module, wyw-in-js 2.3.0: 1.94 s</title></circle>
<circle cx="172" cy="73.5" r="4.5"><title>One styles module, wyw-in-js 2.4.4: 1.78 s</title></circle>
<circle cx="288" cy="124.6" r="4.5"><title>One styles module, wyw-in-js 2.5.1: 1.34 s</title></circle>
<circle cx="404" cy="189.5" r="4.5"><title>One styles module, wyw-in-js 2.6.0: 0.78 s</title></circle>
<circle cx="520" cy="189.5" r="4.5"><title>One styles module, wyw-in-js 2.7.1: 0.78 s</title></circle>
</g>
<g fill="#3987e5" stroke="#080a12" stroke-width="2">
<circle cx="56" cy="114.1" r="4.5"><title>Per-component modules, wyw-in-js 2.3.0: 1.43 s</title></circle>
<circle cx="172" cy="123.4" r="4.5"><title>Per-component modules, wyw-in-js 2.4.4: 1.35 s</title></circle>
<circle cx="288" cy="174.4" r="4.5"><title>Per-component modules, wyw-in-js 2.5.1: 0.91 s</title></circle>
<circle cx="404" cy="201.1" r="4.5"><title>Per-component modules, wyw-in-js 2.6.0: 0.68 s</title></circle>
<circle cx="520" cy="201.1" r="4.5"><title>Per-component modules, wyw-in-js 2.7.1: 0.68 s</title></circle>
</g>
<g font-size="14" fill="#cdd3e6">
<text x="68" y="50">1.94 s</text>
<text x="68" y="135">1.43 s</text>
<text x="532" y="186">0.78 s</text>
<text x="532" y="211">0.68 s</text>
</g>
</svg>
</figure>

| dx-styles | wyw-in-js | Per-component modules, s | One styles module, s |
| --- | --- | --: | --: |
| 1.3.0 | 2.3.0 | 1.43 | 1.94 |
| 1.3.0 | 2.4.4 | 1.35 | 1.78 |
| 1.3.0 | 2.5.1 | 0.91 | 1.34 |
| 1.3.0 | 2.6.0 | 0.68 | 0.78 |
| 1.3.0 | 2.7.1 | 0.68 | 0.78 |
| 1.4.1 | 2.4.4 | 1.34 | 1.79 |
| 1.4.1 | 2.7.1 | 0.68 | 0.78 |
| 1.5.0 | 2.7.1 | 0.68 | 0.78 |

The series uses dx-styles 1.3.0, the one release whose range accepts every wyw-in-js from 2.3.0 to 2.7.1; the last three rows are the actual upgrade path. Each number is the median of 7 warm builds. The entries alternate forward and backward in every round, so a slow minute on the machine hits all of them alike. Every step except the one from 2.6.0 to 2.7.1 is outside the noise, since the ranges of the runs do not overlap, and each dx-styles release builds a byte-identical bundle on every wyw-in-js release it was built with.

## The same scene in other libraries

| Library | Warm build, s | Total gzip, KB | First paint, ms |
| --- | --: | --: | --: |
| styled-components 6.6.0 | 0.16 | 97.2 | 208 |
| Emotion 11.14 | 0.17 | 93.5 | 212 |
| Panda 2.4.0 | 0.21 | 89.2 | 188 |
| next-yak 9.10.3 | 0.30 | 96.3 | 168 |
| vanilla-extract 1.21.3 | 0.56 | 94.9 | 160 |
| CSS Modules (no library) | 0.66 | 102.9 | 156 |
| dx-styles 1.5.0 | 0.68 | 99.4 | 162 |
| Linaria 8.3.0 | 1.86 | 105.3 | 160 |
| StyleX 0.19.1 | 2.06 | 89.5 | 168 |
| Compiled 2.0.0 | 5.93 | 88.7 | 168 |

styled-components and Emotion build fastest because they do no CSS work at build time. Their styles travel in the JavaScript and are injected at runtime, which is also why they paint about 45 to 50 ms later than dx-styles. Of the libraries that extract CSS at build time, dx-styles builds in about the time of plain CSS Modules, which have no CSS-in-JS layer at all; the 0.02 s between them is noise.

Linaria runs on the same engine, wyw-in-js 2.7.1, and here it builds in 1.86 s because of how this port models tokens. Every style module interpolates tokens from a shared JS object, so the engine evaluates that object for each of the 41 modules. dx-styles declares its tokens once, as a contract that its processors resolve without evaluating anything. Written with static CSS variables instead, the same Linaria scene builds in 0.38 s, faster than dx-styles, so the dx-styles layer (typed token contracts and recipes) costs about 0.3 s on top of the engine on this scene.

The output of every library is also checked in a browser by comparing 22 computed properties of all 3,642 elements with the dx-styles render. All of them match except Compiled 2.0.0. With its default class hash, two different declarations, `color: var(--tk-color-danger600)` and `color: var(--tk-color-info800)`, get the same atomic class, and 5 elements are painted the wrong color. Hash collisions are a [known issue](https://github.com/atlassian-labs/compiled/issues/1423) of the default hash. The opt-in `collisionResistantHash` option fixes this one with the same build time and 1.4 KB more gzip.

### Where dx-styles does not win

- Panda (0.21 s), next-yak (0.30 s), vanilla-extract (0.56 s) and Linaria with static CSS variables (0.38 s) build faster than dx-styles (0.68 s), and plain CSS Modules (0.66 s) build in the same time.
- dx-styles ships 99.4 KB gzip in total, more than every other lane here except Linaria and plain CSS Modules. Its CSS is 382 KB raw against 314 KB for vanilla-extract, which hashes its token variable names. dx-styles keeps them readable (`--tk-color-accent600`) because they are the theming contract.
- Its first paint (162 ms) is level with CSS Modules, vanilla-extract and Linaria at 156 to 160 ms.

## How it was measured

The scene is generated from one description: 104 design tokens, 45 structural slots and 34 recipe families (buttons, tabs, badges, alerts, inputs, menu items and more) with 1,308 variants. It renders as an issue-tracker screen plus a gallery of every variant, 3,642 elements in all, with the styles in 41 modules. Each library has its own generator, which writes the scene with that library's token layer and API and builds it through its documented Vite integration.

- Machine: Apple M3 Max (16 cores, 64 GB), macOS 26.6.2, Node 24.4.1, Vite 8.3.5, React 19.3.1; Chromium 156 for first paint.
- Every library is its own project with exact pins and a lockfile. The whole wyw-in-js stack is pinned through npm `overrides`, and `npm ls` checks that each pinned package is installed once.
- All projects are installed in one session. The harness then waits 90 s for the file-system indexing that a fresh install triggers, does a warm-up build of each, and runs 7 rounds. A round builds every project cold and then warm, in alternating order, and starts only when the machine is quiet. The tables give the median of the warm builds. Cold builds are at most about 0.1 s slower (Panda's includes its codegen); [RESULTS.md](https://github.com/dx-styles/benchmarks/blob/main/RESULTS.md) has them, with the minimums.
- First paint is measured in headless Chromium on a fast machine with no throttling, so a difference of a few milliseconds means nothing; only the gap of the runtime libraries holds.
- It is one machine and one scene, and the scene is large and regular on purpose, which is not how every app looks. Build times are comparable only within one run.

To rerun it:

```sh
git clone https://github.com/dx-styles/benchmarks
cd benchmarks
npm ci
npx playwright install chromium
npm run bench
```

A full run takes about an hour. If a library is set up unfairly, or a scenario you care about is missing, open a pull request.

## Upgrading

```sh
npm install dx-styles@^1.5.0
npm install -D @wyw-in-js/vite@2.7.1
```

With Next.js, update `@wyw-in-js/nextjs` to 2.7.1 instead; with another bundler, update its wyw-in-js integration. Update the integration together with dx-styles: the build runs the transform that the integration installs, and dx-styles 1.5.0 needs wyw-in-js 2.7.1 or newer.

---

*Anton Evzhakov maintains Linaria and is the author of wyw-in-js, the zero-runtime engine behind Linaria and MUI's Pigment CSS. He builds dx-styles.*
