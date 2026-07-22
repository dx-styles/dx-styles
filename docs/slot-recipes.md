# Slot Recipes

Use `slotRecipe(...)` for components that style multiple coordinated elements.

```ts
import { slotRecipe } from "dx-styles";

export const field = slotRecipe({
  slots: ["root", "label", "control", "message"],
  base: {
    root: { display: "grid", gap: "6px" },
    label: { fontWeight: 600 },
    control: { border: "1px solid var(--field-border)" },
    message: { fontSize: "12px" },
  },
  variants: {
    state: {
      valid: {
        message: { color: "var(--field-success)" },
      },
      invalid: {
        control: { borderColor: "var(--field-danger)" },
        message: { color: "var(--field-danger)" },
      },
    },
  },
  defaultVariants: {
    state: "valid",
  },
});
```

Use the returned slot map in component markup:

```tsx
const slots = field({ state: error ? "invalid" : "valid" });

return (
  <label className={slots.root}>
    <span className={slots.label}>Email</span>
    <input className={slots.control} />
    <span className={slots.message}>{error}</span>
  </label>
);
```

Slot recipes keep class selection explicit and avoid runtime style object allocation.

Components that expose slot recipe variants as props can use `RecipeVariantProps<typeof field>`
for their variant type and `splitSlotRecipeProps(field, props)` to separate those variants from the
props forwarded to the root element. The result has the same `{ variantProps, otherProps }` shape as
`splitRecipeProps(...)`.
