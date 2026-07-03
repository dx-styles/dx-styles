# Tokens and Themes

Create a token contract with an explicit custom-property prefix.

```ts
import { createTheme, createTokenContract } from "dx-styles";

export const tokens = createTokenContract(
  {
    color: {
      bg: null,
      fg: null,
      accent: null,
    },
    radius: {
      md: null,
    },
  },
  { prefix: "app" },
);
```

Use contract values in styles:

```ts
import { css } from "dx-styles";

export const card = css({
  backgroundColor: tokens.color.bg,
  borderRadius: tokens.radius.md,
  color: tokens.color.fg,
});
```

Create a theme class from the full contract:

```ts
export const darkTheme = createTheme(tokens, {
  color: {
    bg: "#10131a",
    fg: "#f5f7fb",
    accent: "#7c8cff",
  },
  radius: {
    md: "8px",
  },
});
```

Apply the class at any stable boundary, such as the document root or an application shell.
