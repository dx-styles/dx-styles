# Recipes

Use `recipe(...)` when a single element has a base class and a finite set of variant axes.

```ts
import { recipe } from "dx-styles";

export const button = recipe({
  base: {
    alignItems: "center",
    borderRadius: "999px",
    display: "inline-flex",
    justifyContent: "center",
  },
  variants: {
    size: {
      sm: { minHeight: "28px", paddingInline: "10px" },
      md: { minHeight: "36px", paddingInline: "14px" },
    },
    tone: {
      neutral: { backgroundColor: "var(--button-neutral-bg)" },
      accent: { backgroundColor: "var(--button-accent-bg)" },
    },
  },
  defaultVariants: {
    size: "md",
    tone: "neutral",
  },
  compoundVariants: [
    {
      size: "sm",
      tone: "accent",
      css: {
        fontWeight: 700,
      },
    },
  ],
});
```

At runtime, the recipe only selects already extracted classes:

```tsx
<button className={button({ tone: "accent" })}>Save</button>
```

Variant names and values are inferred from the recipe config, so invalid selections fail typecheck.
