# Runtime Values

Runtime styling in `dx-styles` is limited to class selection and CSS custom property assignment.

Use `assignVars(...)` when user input or application state needs to update token values without
creating new CSS rules.

```ts
import { assignVars } from "dx-styles";

import { tokens } from "./tokens";

const style = assignVars(tokens, {
  color: {
    accent: selectedColor,
  },
});
```

In React:

```tsx
<section style={style}>...</section>
```

The returned object maps CSS custom property names to values:

```ts
{
  "--app-color-accent": "#7c8cff";
}
```

Use `assignVars(...)` for values that are intentionally dynamic. Use `css(...)`, `recipe(...)`, and
`slotRecipe(...)` for static classes that should be extracted by the build.
