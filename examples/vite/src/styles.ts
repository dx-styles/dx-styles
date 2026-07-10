import { css, recipe } from "dx-styles";

import { tokens } from "./theme";

export const page = css({
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  backgroundColor: tokens.color.bg,
  color: tokens.color.fg,
  fontFamily: "system-ui, sans-serif",
  transition: "background-color 0.2s ease, color 0.2s ease",
});

export const card = css({
  display: "grid",
  gap: "12px",
  maxWidth: "380px",
  padding: "32px",
  backgroundColor: tokens.color.surface,
  borderRadius: tokens.radius.md,
});

export const title = css({
  margin: 0,
  fontSize: "22px",
});

export const note = css({
  margin: 0,
  color: tokens.color.muted,
  fontSize: "14px",
  lineHeight: 1.55,
});

export const row = css({
  display: "flex",
  gap: "8px",
  marginTop: "8px",
});

export const button = recipe({
  base: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "36px",
    paddingInline: "16px",
    borderRadius: "999px",
    border: "none",
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: "14px",
    fontWeight: 600,
  },
  variants: {
    appearance: {
      primary: {
        backgroundColor: tokens.color.accent,
        color: tokens.color.accentFg,
      },
      ghost: {
        backgroundColor: "transparent",
        color: tokens.color.accent,
      },
    },
  },
  defaultVariants: {
    appearance: "primary",
  },
});
