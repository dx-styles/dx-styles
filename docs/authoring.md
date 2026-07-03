# Authoring Styles

Use `css(...)` for deterministic style objects and composition.

```ts
import { css } from "dx-styles";

const focusRing = css({
  ":focus-visible": {
    outline: "2px solid var(--focus-ring)",
    outlineOffset: "2px",
  },
});

export const button = css(focusRing, {
  alignItems: "center",
  borderRadius: "999px",
  display: "inline-flex",
  minHeight: "32px",
  paddingInline: "12px",
});
```

Style objects support nested selectors and at-rules:

```ts
export const panel = css({
  backgroundColor: "Canvas",
  "@media (forced-colors: active)": {
    border: "1px solid CanvasText",
  },
  "&:hover": {
    backgroundColor: "color-mix(in srgb, Canvas, CanvasText 8%)",
  },
});
```

Use `cx(...)` to join class names at runtime:

```ts
import { cx } from "dx-styles";

export const className = cx(button, isActive && "is-active");
```

Public style handles are symbolic inputs for extension surfaces. They can be passed back to
`css(...)`, `createRecipeStyleHandles(...)`, and `createSlotRecipeStyleHandles(...)`; their internal
descriptor is reserved for the extractor.
