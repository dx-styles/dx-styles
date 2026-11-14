/**
 * Property data of the atomic output model.
 *
 * `PROPERTY_CODE_TABLE` gives every listed property its two-character code in
 * atom class names: the index in the table, in base36. Atom names are a
 * contract between packages built with dx-styles, so the table is append-only:
 * new properties go to the end, and nothing is removed or reordered outside a
 * major release. Its initial contents are the standard and SVG property names
 * of csstype 3.2.3, sorted.
 *
 * `SHORTHAND_SUBPROPERTIES` lists the direct sub-properties of each shorthand.
 * It merges the shorthand table of @linaria/atomic (MIT) with the `computed`
 * field of the shorthands in mdn-data (css/properties.json), the shorthands
 * mdn-data marks "asSpecified" (from their specifications), and links the
 * flow-relative box shorthands (`padding-inline`, ...) to the physical box
 * shorthand of their family and the side shorthands (`border-top`, ...) to
 * `border`.
 */
const BASE36_DIGITS = "0123456789abcdefghijklmnopqrstuvwxyz";
// The first character of a table code is one of the first 35 digits: `z` starts
// the hashed code of a property outside the table.
const TABLE_CODE_CAPACITY = 35 * 36;

export type LonghandDepth = 0 | 1 | 2;

// prettier-ignore
export const PROPERTY_CODE_TABLE: readonly string[] = [
  "accent-color", "align-content", "align-items", "align-self", "align-tracks",
  "alignment-baseline", "all", "anchor-name", "anchor-scope", "animation", "animation-composition",
  "animation-delay", "animation-direction", "animation-duration", "animation-fill-mode",
  "animation-iteration-count", "animation-name", "animation-play-state", "animation-range",
  "animation-range-end", "animation-range-start", "animation-timeline",
  "animation-timing-function", "appearance", "aspect-ratio", "backdrop-filter",
  "backface-visibility", "background", "background-attachment", "background-blend-mode",
  "background-clip", "background-color", "background-image", "background-origin",
  "background-position", "background-position-x", "background-position-y", "background-repeat",
  "background-size", "baseline-shift", "block-size", "border", "border-block",
  "border-block-color", "border-block-end", "border-block-end-color", "border-block-end-style",
  "border-block-end-width", "border-block-start", "border-block-start-color",
  "border-block-start-style", "border-block-start-width", "border-block-style",
  "border-block-width", "border-bottom", "border-bottom-color", "border-bottom-left-radius",
  "border-bottom-right-radius", "border-bottom-style", "border-bottom-width", "border-collapse",
  "border-color", "border-end-end-radius", "border-end-start-radius", "border-image",
  "border-image-outset", "border-image-repeat", "border-image-slice", "border-image-source",
  "border-image-width", "border-inline", "border-inline-color", "border-inline-end",
  "border-inline-end-color", "border-inline-end-style", "border-inline-end-width",
  "border-inline-start", "border-inline-start-color", "border-inline-start-style",
  "border-inline-start-width", "border-inline-style", "border-inline-width", "border-left",
  "border-left-color", "border-left-style", "border-left-width", "border-radius", "border-right",
  "border-right-color", "border-right-style", "border-right-width", "border-spacing",
  "border-start-end-radius", "border-start-start-radius", "border-style", "border-top",
  "border-top-color", "border-top-left-radius", "border-top-right-radius", "border-top-style",
  "border-top-width", "border-width", "bottom", "box-decoration-break", "box-shadow", "box-sizing",
  "break-after", "break-before", "break-inside", "caption-side", "caret", "caret-color",
  "caret-shape", "clear", "clip", "clip-path", "clip-rule", "color", "color-adjust",
  "color-interpolation", "color-interpolation-filters", "color-rendering", "color-scheme",
  "column-count", "column-fill", "column-gap", "column-rule", "column-rule-color",
  "column-rule-style", "column-rule-width", "column-span", "column-width", "columns", "contain",
  "contain-intrinsic-block-size", "contain-intrinsic-height", "contain-intrinsic-inline-size",
  "contain-intrinsic-size", "contain-intrinsic-width", "container", "container-name",
  "container-type", "content", "content-visibility", "counter-increment", "counter-reset",
  "counter-set", "cursor", "cx", "cy", "d", "direction", "display", "dominant-baseline",
  "empty-cells", "field-sizing", "fill", "fill-opacity", "fill-rule", "filter", "flex",
  "flex-basis", "flex-direction", "flex-flow", "flex-grow", "flex-shrink", "flex-wrap", "float",
  "flood-color", "flood-opacity", "font", "font-family", "font-feature-settings", "font-kerning",
  "font-language-override", "font-optical-sizing", "font-palette", "font-size", "font-size-adjust",
  "font-smooth", "font-stretch", "font-style", "font-synthesis", "font-synthesis-position",
  "font-synthesis-small-caps", "font-synthesis-style", "font-synthesis-weight", "font-variant",
  "font-variant-alternates", "font-variant-caps", "font-variant-east-asian", "font-variant-emoji",
  "font-variant-ligatures", "font-variant-numeric", "font-variant-position",
  "font-variation-settings", "font-weight", "font-width", "forced-color-adjust", "gap",
  "glyph-orientation-vertical", "grid", "grid-area", "grid-auto-columns", "grid-auto-flow",
  "grid-auto-rows", "grid-column", "grid-column-end", "grid-column-start", "grid-row",
  "grid-row-end", "grid-row-start", "grid-template", "grid-template-areas",
  "grid-template-columns", "grid-template-rows", "hanging-punctuation", "height",
  "hyphenate-character", "hyphenate-limit-chars", "hyphens", "image-orientation",
  "image-rendering", "image-resolution", "initial-letter", "initial-letter-align", "inline-size",
  "inset", "inset-block", "inset-block-end", "inset-block-start", "inset-inline",
  "inset-inline-end", "inset-inline-start", "interpolate-size", "isolation", "justify-content",
  "justify-items", "justify-self", "justify-tracks", "left", "letter-spacing", "lighting-color",
  "line-break", "line-clamp", "line-height", "line-height-step", "list-style", "list-style-image",
  "list-style-position", "list-style-type", "margin", "margin-block", "margin-block-end",
  "margin-block-start", "margin-bottom", "margin-inline", "margin-inline-end",
  "margin-inline-start", "margin-left", "margin-right", "margin-top", "margin-trim", "marker",
  "marker-end", "marker-mid", "marker-start", "mask", "mask-border", "mask-border-mode",
  "mask-border-outset", "mask-border-repeat", "mask-border-slice", "mask-border-source",
  "mask-border-width", "mask-clip", "mask-composite", "mask-image", "mask-mode", "mask-origin",
  "mask-position", "mask-repeat", "mask-size", "mask-type", "masonry-auto-flow", "math-depth",
  "math-shift", "math-style", "max-block-size", "max-height", "max-inline-size", "max-lines",
  "max-width", "min-block-size", "min-height", "min-inline-size", "min-width", "mix-blend-mode",
  "motion", "motion-distance", "motion-path", "motion-rotation", "object-fit", "object-position",
  "object-view-box", "offset", "offset-anchor", "offset-distance", "offset-path",
  "offset-position", "offset-rotate", "offset-rotation", "opacity", "order", "orphans", "outline",
  "outline-color", "outline-offset", "outline-style", "outline-width", "overflow",
  "overflow-anchor", "overflow-block", "overflow-clip-box", "overflow-clip-margin",
  "overflow-inline", "overflow-wrap", "overflow-x", "overflow-y", "overlay", "overscroll-behavior",
  "overscroll-behavior-block", "overscroll-behavior-inline", "overscroll-behavior-x",
  "overscroll-behavior-y", "padding", "padding-block", "padding-block-end", "padding-block-start",
  "padding-bottom", "padding-inline", "padding-inline-end", "padding-inline-start", "padding-left",
  "padding-right", "padding-top", "page", "paint-order", "perspective", "perspective-origin",
  "place-content", "place-items", "place-self", "pointer-events", "position", "position-anchor",
  "position-area", "position-try", "position-try-fallbacks", "position-try-order",
  "position-visibility", "print-color-adjust", "quotes", "r", "resize", "right", "rotate",
  "row-gap", "ruby-align", "ruby-merge", "ruby-overhang", "ruby-position", "rx", "ry", "scale",
  "scroll-behavior", "scroll-initial-target", "scroll-margin", "scroll-margin-block",
  "scroll-margin-block-end", "scroll-margin-block-start", "scroll-margin-bottom",
  "scroll-margin-inline", "scroll-margin-inline-end", "scroll-margin-inline-start",
  "scroll-margin-left", "scroll-margin-right", "scroll-margin-top", "scroll-padding",
  "scroll-padding-block", "scroll-padding-block-end", "scroll-padding-block-start",
  "scroll-padding-bottom", "scroll-padding-inline", "scroll-padding-inline-end",
  "scroll-padding-inline-start", "scroll-padding-left", "scroll-padding-right",
  "scroll-padding-top", "scroll-snap-align", "scroll-snap-margin", "scroll-snap-margin-bottom",
  "scroll-snap-margin-left", "scroll-snap-margin-right", "scroll-snap-margin-top",
  "scroll-snap-stop", "scroll-snap-type", "scroll-timeline", "scroll-timeline-axis",
  "scroll-timeline-name", "scrollbar-color", "scrollbar-gutter", "scrollbar-width",
  "shape-image-threshold", "shape-margin", "shape-outside", "shape-rendering", "speak-as",
  "stop-color", "stop-opacity", "stroke", "stroke-color", "stroke-dasharray", "stroke-dashoffset",
  "stroke-linecap", "stroke-linejoin", "stroke-miterlimit", "stroke-opacity", "stroke-width",
  "tab-size", "table-layout", "text-align", "text-align-last", "text-anchor", "text-autospace",
  "text-box", "text-box-edge", "text-box-trim", "text-combine-upright", "text-decoration",
  "text-decoration-color", "text-decoration-line", "text-decoration-skip",
  "text-decoration-skip-ink", "text-decoration-style", "text-decoration-thickness",
  "text-emphasis", "text-emphasis-color", "text-emphasis-position", "text-emphasis-style",
  "text-indent", "text-justify", "text-orientation", "text-overflow", "text-rendering",
  "text-shadow", "text-size-adjust", "text-spacing-trim", "text-transform",
  "text-underline-offset", "text-underline-position", "text-wrap", "text-wrap-mode",
  "text-wrap-style", "timeline-scope", "top", "touch-action", "transform", "transform-box",
  "transform-origin", "transform-style", "transition", "transition-behavior", "transition-delay",
  "transition-duration", "transition-property", "transition-timing-function", "translate",
  "unicode-bidi", "user-select", "vector-effect", "vertical-align", "view-timeline",
  "view-timeline-axis", "view-timeline-inset", "view-timeline-name", "view-transition-class",
  "view-transition-name", "visibility", "white-space", "white-space-collapse", "widows", "width",
  "will-change", "word-break", "word-spacing", "word-wrap", "writing-mode", "x", "y", "z-index",
  "zoom",
];

// prettier-ignore
export const SHORTHAND_SUBPROPERTIES: Readonly<Record<string, readonly string[]>> = {
  "animation": [
    "animation-name", "animation-duration", "animation-timing-function", "animation-delay",
    "animation-direction", "animation-iteration-count", "animation-fill-mode",
    "animation-play-state", "animation-timeline",
  ],
  "animation-range": ["animation-range-start", "animation-range-end"],
  "background": [
    "background-image", "background-position", "background-size", "background-repeat",
    "background-origin", "background-clip", "background-attachment", "background-color",
  ],
  "background-position": ["background-position-x", "background-position-y"],
  "border": [
    "border-width", "border-style", "border-color", "border-top", "border-right", "border-bottom",
    "border-left",
  ],
  "border-block": ["border-block-width", "border-block-style", "border-block-color"],
  "border-block-color": ["border-block-start-color", "border-block-end-color"],
  "border-block-end": [
    "border-block-end-width", "border-block-end-style", "border-block-end-color",
  ],
  "border-block-start": [
    "border-block-start-width", "border-block-start-style", "border-block-start-color",
  ],
  "border-block-style": ["border-block-start-style", "border-block-end-style"],
  "border-block-width": ["border-block-start-width", "border-block-end-width"],
  "border-bottom": ["border-bottom-width", "border-bottom-style", "border-bottom-color"],
  "border-color": [
    "border-top-color", "border-right-color", "border-bottom-color", "border-left-color",
  ],
  "border-image": [
    "border-image-source", "border-image-slice", "border-image-width", "border-image-outset",
    "border-image-repeat",
  ],
  "border-inline": ["border-inline-width", "border-inline-style", "border-inline-color"],
  "border-inline-color": ["border-inline-start-color", "border-inline-end-color"],
  "border-inline-end": [
    "border-inline-end-width", "border-inline-end-style", "border-inline-end-color",
  ],
  "border-inline-start": [
    "border-inline-start-width", "border-inline-start-style", "border-inline-start-color",
  ],
  "border-inline-style": ["border-inline-start-style", "border-inline-end-style"],
  "border-inline-width": ["border-inline-start-width", "border-inline-end-width"],
  "border-left": ["border-left-width", "border-left-style", "border-left-color"],
  "border-radius": [
    "border-top-left-radius", "border-top-right-radius", "border-bottom-right-radius",
    "border-bottom-left-radius",
  ],
  "border-right": ["border-right-width", "border-right-style", "border-right-color"],
  "border-style": [
    "border-top-style", "border-right-style", "border-bottom-style", "border-left-style",
  ],
  "border-top": ["border-top-width", "border-top-style", "border-top-color"],
  "border-width": [
    "border-top-width", "border-right-width", "border-bottom-width", "border-left-width",
  ],
  "caret": ["caret-color", "caret-animation", "caret-shape"],
  "column-rule": ["column-rule-width", "column-rule-style", "column-rule-color"],
  "columns": ["column-width", "column-count", "column-height"],
  "contain-intrinsic-size": ["contain-intrinsic-width", "contain-intrinsic-height"],
  "container": ["container-name", "container-type"],
  "corner-block-end-shape": ["corner-end-start-shape", "corner-end-end-shape"],
  "corner-block-start-shape": ["corner-start-start-shape", "corner-start-end-shape"],
  "corner-bottom-shape": ["corner-bottom-left-shape", "corner-bottom-right-shape"],
  "corner-inline-end-shape": ["corner-start-end-shape", "corner-end-end-shape"],
  "corner-inline-start-shape": ["corner-start-start-shape", "corner-start-end-shape"],
  "corner-left-shape": ["corner-top-left-shape", "corner-bottom-left-shape"],
  "corner-right-shape": ["corner-top-right-shape", "corner-bottom-right-shape"],
  "corner-shape": [
    "corner-top-left-shape", "corner-top-right-shape", "corner-bottom-left-shape",
    "corner-bottom-right-shape",
  ],
  "corner-top-shape": ["corner-top-left-shape", "corner-top-right-shape"],
  "flex": ["flex-grow", "flex-shrink", "flex-basis"],
  "flex-flow": ["flex-direction", "flex-wrap"],
  "font": [
    "font-style", "font-variant", "font-weight", "font-stretch", "font-size", "line-height",
    "font-family",
  ],
  "font-synthesis": [
    "font-synthesis-position", "font-synthesis-small-caps", "font-synthesis-style",
    "font-synthesis-weight",
  ],
  "font-variant": [
    "font-variant-alternates", "font-variant-caps", "font-variant-east-asian", "font-variant-emoji",
    "font-variant-ligatures", "font-variant-numeric", "font-variant-position",
  ],
  "gap": ["row-gap", "column-gap"],
  "grid": [
    "grid-template-rows", "grid-template-columns", "grid-template-areas", "grid-auto-rows",
    "grid-auto-columns", "grid-auto-flow", "grid-column-gap", "grid-row-gap", "column-gap",
    "row-gap",
  ],
  "grid-area": ["grid-row-start", "grid-column-start", "grid-row-end", "grid-column-end"],
  "grid-column": ["grid-column-start", "grid-column-end"],
  "grid-gap": ["grid-row-gap", "grid-column-gap"],
  "grid-row": ["grid-row-start", "grid-row-end"],
  "grid-template": ["grid-template-columns", "grid-template-rows", "grid-template-areas"],
  "inset": ["top", "bottom", "left", "right", "inset-block", "inset-inline"],
  "inset-block": ["inset-block-start", "inset-block-end"],
  "inset-inline": ["inset-inline-start", "inset-inline-end"],
  "interest-delay": ["interest-delay-start", "interest-delay-end"],
  "list-style": ["list-style-image", "list-style-position", "list-style-type"],
  "margin": [
    "margin-bottom", "margin-left", "margin-right", "margin-top", "margin-block", "margin-inline",
  ],
  "margin-block": ["margin-block-start", "margin-block-end"],
  "margin-inline": ["margin-inline-start", "margin-inline-end"],
  "mask": [
    "mask-image", "mask-mode", "mask-repeat", "mask-position", "mask-clip", "mask-origin",
    "mask-size", "mask-composite",
  ],
  "mask-border": [
    "mask-border-mode", "mask-border-outset", "mask-border-repeat", "mask-border-slice",
    "mask-border-source", "mask-border-width",
  ],
  "offset": ["offset-position", "offset-path", "offset-distance", "offset-anchor", "offset-rotate"],
  "outline": ["outline-width", "outline-style", "outline-color"],
  "overflow": ["overflow-x", "overflow-y"],
  "overscroll-behavior": ["overscroll-behavior-x", "overscroll-behavior-y"],
  "padding": [
    "padding-bottom", "padding-left", "padding-right", "padding-top", "padding-block",
    "padding-inline",
  ],
  "padding-block": ["padding-block-start", "padding-block-end"],
  "padding-inline": ["padding-inline-start", "padding-inline-end"],
  "place-content": ["align-content", "justify-content"],
  "place-items": ["align-items", "justify-items"],
  "place-self": ["align-self", "justify-self"],
  "position-try": ["position-try-fallbacks", "position-try-order"],
  "scroll-margin": [
    "scroll-margin-bottom", "scroll-margin-left", "scroll-margin-right", "scroll-margin-top",
    "scroll-margin-block", "scroll-margin-inline",
  ],
  "scroll-margin-block": ["scroll-margin-block-start", "scroll-margin-block-end"],
  "scroll-margin-inline": ["scroll-margin-inline-start", "scroll-margin-inline-end"],
  "scroll-padding": [
    "scroll-padding-bottom", "scroll-padding-left", "scroll-padding-right", "scroll-padding-top",
    "scroll-padding-block", "scroll-padding-inline",
  ],
  "scroll-padding-block": ["scroll-padding-block-start", "scroll-padding-block-end"],
  "scroll-padding-inline": ["scroll-padding-inline-start", "scroll-padding-inline-end"],
  "scroll-timeline": ["scroll-timeline-name", "scroll-timeline-axis"],
  "text-decoration": [
    "text-decoration-line", "text-decoration-style", "text-decoration-color",
    "text-decoration-thickness",
  ],
  "text-emphasis": ["text-emphasis-style", "text-emphasis-color"],
  "text-wrap": ["text-wrap-mode", "text-wrap-style"],
  "timeline-trigger": [
    "timeline-trigger-name", "timeline-trigger-source", "timeline-trigger-activation-range",
    "timeline-trigger-active-range",
  ],
  "timeline-trigger-activation-range": [
    "timeline-trigger-activation-range-start", "timeline-trigger-activation-range-end",
  ],
  "timeline-trigger-active-range": [
    "timeline-trigger-active-range-start", "timeline-trigger-active-range-end",
  ],
  "transition": [
    "transition-delay", "transition-duration", "transition-property", "transition-timing-function",
    "transition-behavior",
  ],
  "view-timeline": ["view-timeline-name", "view-timeline-axis"],
  "white-space": ["text-wrap-mode", "white-space-collapse"],
};

if (PROPERTY_CODE_TABLE.length > TABLE_CODE_CAPACITY) {
  throw new Error("dx-styles property code table exceeds its capacity.");
}

const propertyCodes = new Map(
  PROPERTY_CODE_TABLE.map((property, index) => [
    property,
    `${BASE36_DIGITS[Math.floor(index / 36)]}${BASE36_DIGITS[index % 36]}`,
  ]),
);

const shorthandParents = new Map<string, string[]>();
Object.entries(SHORTHAND_SUBPROPERTIES).forEach(([shorthand, subProperties]) => {
  subProperties.forEach((subProperty) => {
    shorthandParents.set(subProperty, [...(shorthandParents.get(subProperty) ?? []), shorthand]);
  });
});

/** The table code of a property, or null when the property is outside the table. */
export function readPropertyCode(property: string): null | string {
  return propertyCodes.get(property) ?? null;
}

/**
 * 0 for a shorthand or a property outside any family, 1 for a shorthand that is
 * part of another shorthand (`border-top`, `border-color`), 2 for a longhand of
 * a family (`border-top-color`, `padding-top`).
 */
export function readLonghandDepth(property: string): LonghandDepth {
  if (!shorthandParents.has(property)) {
    return 0;
  }

  return Object.hasOwn(SHORTHAND_SUBPROPERTIES, property) ? 1 : 2;
}

function collectLonghands(property: string, into: Set<string>): Set<string> {
  const subProperties = Object.hasOwn(SHORTHAND_SUBPROPERTIES, property)
    ? SHORTHAND_SUBPROPERTIES[property]
    : undefined;

  if (subProperties === undefined) {
    into.add(property);
    return into;
  }

  subProperties.forEach((subProperty) => collectLonghands(subProperty, into));
  return into;
}

const physicalSides = ["top", "right", "bottom", "left"] as const;
const physicalCorners = ["top-left", "top-right", "bottom-right", "bottom-left"] as const;

// Physical properties a flow-relative longhand can set (CSS Logical Properties
// and Values Level 1). The writing mode is not known at build time, and a
// vertical one maps the block axis to x and the inline axis to y, so a
// flow-relative side, corner, size or axis may be any of its physical ones.
function readPhysicalEquivalents(longhand: string): string[] {
  if (/^border-(?:start|end)-(?:start|end)-radius$/u.test(longhand)) {
    return physicalCorners.map((corner) => `border-${corner}-radius`);
  }

  const size = /^(min-|max-|contain-intrinsic-)?(?:block|inline)-size$/u.exec(longhand);
  if (size !== null) {
    return ["height", "width"].map((dimension) => `${size[1] ?? ""}${dimension}`);
  }

  const axis = /^(overflow|overscroll-behavior)-(?:block|inline)$/u.exec(longhand);
  if (axis !== null) {
    return [`${axis[1]}-x`, `${axis[1]}-y`];
  }

  const side = /^(.*?)-?(?:block|inline)-(?:start|end)(-.*)?$/u.exec(longhand);
  if (side === null) {
    return [];
  }

  const [, prefix, suffix = ""] = side;

  return physicalSides.map((physicalSide) =>
    prefix === "inset" || prefix === ""
      ? `${physicalSide}${suffix}`
      : `${prefix}-${physicalSide}${suffix}`,
  );
}

const affectedLonghands = new Map<string, Set<string>>();

function collectAffectedLonghands(property: string): Set<string> {
  const cached = affectedLonghands.get(property);
  if (cached !== undefined) {
    return cached;
  }

  const longhands = collectLonghands(property, new Set());
  affectedLonghands.set(property, longhands);

  [...longhands].forEach((longhand) => {
    readPhysicalEquivalents(longhand).forEach((physical) => longhands.add(physical));
  });

  return longhands;
}

/** Whether two declarations can set the same longhand of one element. */
export function propertiesOverlap(left: string, right: string): boolean {
  if (left === right || left === "all" || right === "all") {
    return true;
  }

  const leftLonghands = collectAffectedLonghands(left);
  return [...collectAffectedLonghands(right)].some((longhand) => leftLonghands.has(longhand));
}
