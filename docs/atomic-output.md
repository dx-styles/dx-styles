# Atomic output

dx-styles has two supported output models. The default, **semantic**, emits one class per style:
`css({ color: "red", padding: 4 })` becomes `.button_bhhycyd{color:red;padding:4px;}`. The
**atomic** model emits one shared class per declaration, an atom: the same style becomes
`.dx-39_vtc9dhbe{color:red;}` and `.dx-9b_dfhgmh3l{padding:4px;}`, and every other style that
sets `color: red` reuses the first atom. The CSS stops growing with the number of components.

The model is a build option. Nothing changes in how styles are written; the atomic model rejects
a few forms that it cannot express, listed under [build errors](#build-errors-and-how-to-rewrite).

```ts
import wyw from "@wyw-in-js/vite";

wyw({
  processors: {
    dxStyles: {
      output: "atomic",
      minifyClassNames: true,
    },
  },
});
```

`output` accepts `"semantic"` (the default) and `"atomic"`. Without the option, or with
`output: "semantic"`, the output is byte for byte what it was before the option existed.

## What changes and what does not

In the atomic model:

- `css(...)` returns a string of atoms instead of one class name.
- `recipe(...)` and `slotRecipe(...)` keep their API; each base, variant and compound variant is a
  string of atoms, and the recipe joins them with `cx`, which keeps the last atom of each
  property and condition.
- `css(a, b)` merges the styles at build time, as before, so the result holds the atom of `b` for
  a property both set.
- Style handles (`createStyleHandle`, `createRecipeStyleHandles`, `createSlotRecipeStyleHandles`)
  are strings of atoms; `css(handle, { ... })` keeps the last atom of each key.
- `createTheme`, `createTokenContract`, `createVar` and `keyframes()` are unchanged.
- A `:global()` selector means what it means in the semantic model. A rule that `:global()` takes
  off the styled element (`":global(body)"`) stays a global rule; one that keeps it
  (`"& :global(.dark)"`) becomes an atom.
- Inline `@keyframes` in a style keep the name the semantic model gives them
  (`spin-button_bhhycyd`), and the `animation` of that style refers to it. Keyframes inside
  `@media` or `@supports` stay inside it.
- The cascade of atoms depends only on specificity and `!important`, never on the order of rules
  in the CSS. The fixed rules below say who wins.

For the element of the style itself, a style whose result would depend on the order of its
declarations, or would differ from the semantic model, fails the build. The atomic model never
emits such a style looking silently different, and it never falls back to a per-style class. A
rule of a style for another element (`"& span"`, `"& > summary"`, `"& [data-on]"`) builds without
that promise: see [rules that style other elements](#rules-that-style-other-elements).

## Order rules

Every atom's selector repeats its class `r` times:

```text
r = 1 + L + 3·A + 6·P
```

- `L` — the longhand depth of the property: 0 for a shorthand or a property outside any family
  (`border`, `color`), 1 for a shorthand inside a shorthand (`border-top`, `border-color`,
  `padding-inline`), 2 for a longhand of a family (`border-top-color`, `padding-top`). A
  shorthand also counts the properties it resets but cannot set: `border` resets `border-image`,
  `font` resets `font-kerning`, `font-size-adjust`, `font-feature-settings` and the like, so these
  count as its sub-properties. A legacy name (`word-wrap`, `grid-gap`) counts as the property it
  sets.
- `A` — 1 when the declaration is inside `@media`, `@supports`, `@container` or
  `@starting-style`, otherwise 0.
- `P` — the rank of the pseudo-class of the styled element:

  | Pseudo-class                                | Rank |
  | ------------------------------------------- | ---- |
  | none                                        | 0    |
  | `:hover`                                    | 1    |
  | `:focus`, `:focus-visible`, `:focus-within` | 2    |
  | `:active`                                   | 3    |
  | `:disabled`                                 | 4    |

  With several of them, the highest counts.

The rest of the selector keeps its natural specificity on top. So:

1. A higher pseudo-class rank wins first: `&:hover` beats a declaration inside `@media`, as in
   the semantic model, where `.c:hover` is more specific than `.c` inside `@media`.
2. Then a declaration inside an at-rule beats one outside it.
3. Then a longhand beats its shorthand: `padding-top` beats `padding`, `border-top-color` beats
   `border-top` and `border`.
4. A condition outside the table (`[data-state="open"]`, `:checked`, `:dir(rtl) &`, a descendant)
   keeps its natural specificity, so a conditional declaration still beats an unconditional one.

Only the top-level pseudo-classes of the styled element count. Pseudo-classes inside `:not()`,
`:is()`, `:where()` and `:has()` add their natural specificity only (`:where()` adds none). That
keeps the usual pattern working:

```ts
css({
  "&:hover:not(:disabled)": { backgroundColor: "blue" },
  "&:active:not(:disabled)": { backgroundColor: "navy" },
});
```

`:active` (3) beats `:hover` (1), as it does in the semantic model with this order.

Two declarations with no rule between them have no winner: `:focus` and `:focus-visible` (same
rank), `border-top` and `border-color` (overlapping families of one depth), a physical and a
flow-relative property (`padding-left` and `padding-inline-start`, `width` and `block-size`),
`all` and a property it resets (`color`; custom properties, `direction` and `unicode-bidi` are
not reset by `all`), or two `@media` conditions that overlap. They fail the build, unless both
set one property to one value: then either wins with the same result.

A fallback array (`width: ["100px", "50vw"]`) becomes one atom, but each of its values stays a
declaration of its own, with its own `!important`, and a browser may drop any of them. So the
check compares every value of one array with every value of the other, unless both arrays are the
same:

```ts
// error: with :active and :hover at once the semantic model applies the later
// important 20px, the atomic model the important 10px of :active
css({
  "&:active": { width: ["10px !important", "20px"] },
  "&:hover": { width: ["10px", "20px !important"] },
});
```

The writing mode is not known at build time. In a vertical one the block axis is horizontal, so a
flow-relative side, size or corner can be any physical one: `padding-inline-start` overlaps
`padding-top` as well as `padding-left`. Two flow-relative properties are compared in one writing
mode at a time, so the ones that never meet in any mode stay independent: `padding-inline` and
`padding-block`, `margin-inline-start` and `margin-inline-end`, `inline-size` and `block-size`.

The longest selector is 30 classes, for a longhand under `:disabled` inside `@media`. It
compresses well.

## Build errors and how to rewrite

Every error names the file, the place (`css() "button"`, `recipe() "button" variant
"tone.accent"`, a slot), both declarations with their conditions, the rule, and a rewrite.

**The order contradicts the rules.** The semantic model lets the later declaration win; the
atomic model applies its rule. When they disagree, the build fails:

```ts
css({ paddingTop: 4, padding: 0 }); // error: a longhand wins over its shorthand
css({ padding: 0, paddingTop: 4 }); // fine

css({ "&:active": { color: "navy" }, "&:hover": { color: "blue" } }); // error
css({ "&:hover": { color: "blue" }, "&:active": { color: "navy" } }); // fine
```

**A recipe base against a variant.** Recipe parts are ordered base, variants, compound variants.
A `:disabled` state in the base loses to a `:hover` in a variant in the semantic model, but wins
in the atomic model:

```ts
recipe({
  base: { "&:disabled": { color: "gray" } },
  variants: { tone: { accent: { "&:hover": { color: "blue" } } } },
}); // error
```

Move `&:disabled` from the base into each variant that sets `&:hover` on that property, after its
`&:hover`. Then the rule (`:disabled` beats `:hover`) and the order agree:

```ts
recipe({
  variants: {
    tone: {
      accent: {
        "&:hover": { color: "blue" },
        "&:disabled": { color: "gray" },
      },
    },
  },
});
```

**Overlapping `@media` on one property.** There is no order rule for them. A mobile-first cascade
of several `min-width` queries has to become ranges that do not overlap:

```ts
// error
css({
  "@media (min-width: 40rem)": { gap: 8 },
  "@media (min-width: 64rem)": { gap: 16 },
});

// fine
css({
  "@media (40rem <= width < 64rem)": { gap: 8 },
  "@media (width >= 64rem)": { gap: 16 },
});
```

**A physical and a flow-relative property.** The writing mode is not known at build time, and in
a vertical one the inline start is the top or the bottom, so `marginTop` and `marginInlineStart`
can set the same side. There is no order rule for them, even under one condition. Write both in
one system: the flow-relative counterpart of the physical property when the style follows the
writing direction, or the physical counterpart of the flow-relative one when it does not. The
error names the counterparts:

```ts
css({ marginTop: 8, marginInlineStart: 4 }); // error
css({ marginBlockStart: 8, marginInlineStart: 4 }); // fine
css({ marginTop: 8, marginLeft: 4 }); // fine

css({ position: "fixed", top: 0, insetInlineEnd: 0 }); // error
css({ position: "fixed", insetBlockStart: 0, insetInlineEnd: 0 }); // fine

css({ height: 40, inlineSize: 200 }); // error
css({ blockSize: 40, inlineSize: 200 }); // fine
```

The warning `dx-styles/physical-direction-property` suggests a flow-relative property only for
the inline sides (`paddingLeft` to `paddingInlineStart`, `left` to `insetInlineStart`). In the
atomic model a style that follows it and also sets a block side has to move that side too:
`paddingTop` to `paddingBlockStart`, `top` to `insetBlockStart`.

**Conditions that never meet.** The check skips pairs whose conditions it can prove exclusive.
It proves exactly four forms:

1. one attribute with different values (`=`) on the styled element:
   `&[data-state="open"]` and `&[data-state="closed"]`. Values are compared after their escapes
   are resolved (`"\6f pen"` is `"open"`), and without regard to case, because HTML matches the
   values of attributes such as `type` case-insensitively. Only `data-*` attributes and the `s`
   flag compare case-sensitively;
2. `:x` and `:not(:x)` on the styled element: `&:checked` and `&:not(:checked)`;
3. different tags on the subject of the selector: `button&` and `a&`;
4. `@media` width ranges in one unit (`px`, `rem` or `em`) that do not intersect, from
   `min-width`, `max-width` or the range syntax, with exact bounds: `(width < 40rem)` and
   `(width >= 40rem)` never meet, `(max-width: 40rem)` and `(min-width: 40rem)` meet at 40rem.

Any other pair counts as able to meet, except two different pseudo-elements. The check is
conservative: it can fail on selectors that never match one element in practice; rewrite them
into one of the forms above, or set the property under one condition.

**Vendor prefixes.** Atoms go through the same stylis prefixer, one atom at a time. The check
compares the properties each atom emits after prefixing, so `-webkit-user-select` next to
`userSelect` (which also emits `-webkit-user-select`) is a pair with no order rule; a vendor
property also counts as the property it prefixes, except the `-ms-grid-*` properties of IE 10
and 11, which alias no standard property. Stylis prefixes `grid-row-start` and `grid-row-end`
(and the `grid-column` pair) by each other when they share a rule, which an atom alone cannot do.
Such a pair builds, but with the prefixer on, its `-ms-grid-row-span` (or `-ms-grid-column-span`)
differs from the semantic model: `gridRowStart: 2, gridRowEnd: 4` gives IE a span of 4, not 2.
The build does not report it. If you support IE, set the pair with its shorthand,
`gridRow: "2 / 4"`; with `prefixer: false` both models emit the same declarations.

**A selector that does not select the styled element.** An atom styles only the element of its
style. `&` inside `:is()` or `:where()` with one selector still names that element, so
`":where(&)"` and `":is(.dark &)"` build, with the specificity they have in the semantic model,
and `":is(&):hover"` ranks as `"&:hover"`. A reference only inside `:not()` or `:has()`, or inside
`:is()` or `:where()` next to other selectors (`":is(&, .card)"`), selects other elements and
fails the build. Move such rules to a regular stylesheet, or build in the semantic model.

**`@layer` and `@scope` inside a style.** Atoms are shared between styles, so the atomic model
cannot express a layer order or a scope proximity. Move such rules to a regular stylesheet, or
build in the semantic model.

**A hash collision.** Atom names are hashes. When two different declarations get one name, or
two properties or conditions get one code, in the same build process, the build fails and names
both. Change one of the declarations.

**`preprocessor`.** The order check compares atoms by the layout that stylis gives, and the
atomic model is tested only with WyW's stylis preprocessor (the `preprocessor` option unset or
`"stylis"`). WyW does not pass that option to processors, so with `"none"` or a function the
build neither fails nor checks what that preprocessor makes of the atoms.

**`classNameSlug`.** In either model, a class name that WyW's `classNameSlug` option turns into
the shape of an atom (`dx-<key>_<value>`) fails the build, because `cx` would merge it with atoms.
Remove the `dx-` prefix or the `_` from the template.

## `cx` and the atom name contract

`cx` recognizes an atom by the shape of its name and keeps the last atom of each key; any other
class name is deduplicated as before:

```ts
cx("dx-39_vtc9dhbe dx-9b_dfhgmh3l", "dx-39_vlqtwah4"); // "dx-9b_dfhgmh3l dx-39_vlqtwah4"
```

Always join classes of the atomic model with `cx` (or `css(a, b)`, or a recipe). A string built
around it keeps both atoms of a key, and then the position of their rules in the final CSS
decides, which is chance:

```ts
// Wrong: both color atoms stay, the winner depends on the CSS order.
const className = `${base} ${isActive ? active : ""}`;

// Right
const className = cx(base, isActive && active);
```

The atom name is `dx-<P><C>_<V>`, in lowercase base36:

- `P`, the property code: two characters from the property code table, or `z` and seven
  characters of hash for a property outside it (custom properties, vendor properties, new ones);
- `C`, the condition code: empty without a condition, otherwise seven characters of hash of the
  at-rules and the selector;
- `V`, the value code: eight characters of hash of the values and `!important` (and of the
  absolute module directory, for a relative `url()`: `url(./a.png)` or `url(icon.svg)`, but not
  `url(/a.png)`, `url(#id)` or a URL with a scheme). An atom with a relative `url()` therefore
  differs between checkouts in different directories.

`cx` matches `^dx-(?:[0-9a-y][0-9a-z]|z[0-9a-z]{7})(?:[0-9a-z]{7})?_[0-9a-z]{8}$`. The name does
not depend on the file, `displayName`, `minifyClassNames` or the build mode, so atoms of a
library and of an application built separately are the same and `cx` merges them. The format and
the property code table are a contract between packages: they change only in a major release.

## Two models on one page

Between the two models only CSS applies: a class of the semantic model is a foreign class for
`cx`, which keeps it and never merges it with atoms.

| What meets on one property                                                 | Who decides                                 |
| -------------------------------------------------------------------------- | ------------------------------------------- |
| two atoms of one atomic build, through `cx` or `css(a, b)`                 | the model: the last atom of the key         |
| an atom and an atom of another atomic build (another package), through `cx` | the model: the name format is shared        |
| atoms joined around `cx`                                                   | the order of the stylesheets (chance)       |
| a class of a semantic library and an atom of the application               | specificity, then the order of stylesheets  |
| an atom of a library and a semantic class of the application               | specificity, then the order of stylesheets  |
| `css(handle, …)` with a handle from a semantic library                     | specificity, then the order of stylesheets  |
| `css(handle, …)` with a handle of an atomic build that this build knows    | the model, with the order check             |

A handle is known to the build when its atoms were built in the same build process. The check
compares known handles with each other and with the local style; the build of each handle has
already checked the pairs inside it. For a handle whose atoms the build has not seen, the order
check cannot run; the atoms still compose by key.

Ship libraries in the semantic model: their class names are stable and serve as the contract for
`createStyleHandle`.

## Overriding atoms with external CSS

An atom's selector repeats its class up to 30 times, so an ordinary selector of external CSS does
not beat it, and CSS inside `@layer` always loses to atoms, which are outside layers. Three ways
work:

1. Pass the value through a CSS variable that the style reads:

   ```ts
   const badge = css({ color: "var(--badge-color, black)" });
   ```

   ```css
   .sidebar {
     --badge-color: white;
   }
   ```

2. Add a dx-styles style of your own through `cx` or `css(handle, …)`, so the model decides:

   ```ts
   const inverted = css({ color: "white" });
   const className = cx(badge, inverted);
   ```

3. As a last resort, `!important` in the external rule:

   ```css
   .sidebar .badge-slot {
     color: white !important;
   }
   ```

## Deduplication, minifier and chunks

Repeated atoms inside one module collapse in WyW, which keys the rules of a module by selector.
Between modules the CSS minifier of the bundler removes them. Measured on two modules that emit
the same atoms, one inside `@media`:

| Minifier            | Repeated top-level atom | Repeated atom inside `@media` |
| ------------------- | ----------------------- | ----------------------------- |
| esbuild 0.28.2      | removed                 | removed                       |
| cssnano 9.9.0       | removed                 | removed                       |
| lightningcss 1.33.0 | removed                 | **kept**                      |

So:

- In Vite, lightningcss is the default CSS minifier; with atoms inside at-rules set
  `build.cssMinify: "esbuild"` (and install `esbuild`, an optional peer dependency of Vite 8).
- In webpack, use cssnano through `css-minimizer-webpack-plugin`.
- CSS code splitting (`build.cssCodeSplit`) copies an atom into every chunk that needs it.
- Without minification (the dev server, `build.minify: false`) atomic CSS is larger than
  semantic CSS, because the repeats stay.

## Style label and explain

While `minifyClassNames` is not `true` (the default), every class string of the atomic model also
holds a label: the class name the same style gets in the semantic model
(`button_bhhycyd__tone-accent`). The label has no CSS rule, so it does not change the cascade; it
tells you in devtools which style an element comes from. With `minifyClassNames: true` there is no
label.

A style whose selectors reference `&` more than once (`"& + &"`) keeps its class in the string in
either build, because the extra `&` becomes that class. It carries no declarations.

The label costs JavaScript: each class string carries the label and a space, the length of the
semantic name plus one byte per style (for recipes, per base and variant value). Measured on
`examples/vite/src/styles.ts` (five `css()` styles and a recipe with a base and two variants), the
transformed module is 1 163 bytes with labels and 1 008 bytes with `minifyClassNames: true`,
155 bytes for 8 labels. Use `minifyClassNames: true` for production builds.

[Explain](./explain.md) records of the atomic model are keyed by the label and list the atoms:

```text
button_bhhycyd__tone-accent
  symbol: button
  source: src/button.styles.ts:3:23
  kind: recipe
  node: variant
  variant: tone=accent
  atoms: dx-39_vlqtwah4
  compose: none
```

`bun run explain -- <manifest> <atom>` lists every style that uses the atom: an atom belongs to
all of them, not to one source. The atoms of a record are those of its class string, so a style
that gets an atom through a style handle is listed too.

## Known limits

- The collision registry lives in one build process. WyW workers in separate processes do not see
  each other's atoms, so a collision between them is not reported; the hash widths keep it
  unlikely (about 36 bits for a condition, 41 bits for a value).
- `css(handle, …)` with a handle whose atoms the build has not seen composes without the order
  check.
- Class strings joined around `cx` keep both atoms of a key; nothing at build time sees that.
- The check of exclusive conditions stops at the four forms above: `height` ranges, mixed units,
  `@supports` and `@container` conditions count as able to meet.
- Rules of a style for another element are not compared with that element's own style; see
  below.

## Rules that style other elements

A rule of a style can select another element: a descendant (`"& span"`), a child
(`"& > summary"`), a sibling (`"& + *"`). In the atomic model it builds as before: its
declarations become atoms with that selector. The order check compares only the declarations
that a style sets on its own element, within one style, one recipe or a composition with handles
that the build knows. The build does not know the DOM, so it cannot see that a rule for a
descendant meets the descendant's own style on one property. There the result can differ from
the semantic model, and nothing fails:

- **The order of rules decides.** A list sets `"& [data-on]": { opacity: 0.25 }`, and the item has
  its own `"&[data-on]": { opacity: 0.5 }`. Both atoms, `.<atom> [data-on]` and
  `.<atom>[data-on]`, have the specificity (0,2,0), so the later rule wins. In the semantic model
  that is the order of the stylesheets of the modules. In the atomic model an atom is shared, and
  the minifier keeps its last copy, so another module that repeats the atom decides where it
  ends up: the semantic model gives `0.25`, the atomic one can give `0.5`.
- **A longhand wins over a shorthand of the ancestor.** A toolbar sets `"& span": { padding: 4 }`,
  and the label inside has its own `paddingLeft: 8`. In the semantic model `.toolbar span` (0,1,1)
  beats `.label` (0,1,0), and `padding-left` is `4px`. In the atomic model the longhand of the
  label repeats its class three times, (0,3,0), and beats the toolbar's atom (0,1,1): `8px`.
- **The rules of atoms apply inside such a rule too.** `"& span": { paddingTop: 2, padding: 4 }`
  gives `padding-top: 4px` in the semantic model, where the later declaration wins, and `2px` in
  the atomic one, where the longhand repeats its class, (0,3,1) against (0,1,1). Inside a rule for
  another element, order the declarations as the order rules above require, or set the property
  in one declaration.

To keep both models equal, let the ancestor set a CSS variable and the element read it in its own
style. Then only the element's style sets the property:

```ts
const list = css({ "& [data-on]": { "--item-opacity": "0.25" } });
const item = css({ "&[data-on]": { opacity: "var(--item-opacity, 0.5)" } });
```

A variable from `createVar` works the same way.
