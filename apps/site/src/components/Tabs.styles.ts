import { css, recipe } from "dx-styles";

import { siteTokens } from "../spike/theme";

export const tabList = css({
  display: "inline-flex",
  flexWrap: "wrap",
  gap: siteTokens["space-2"],
  padding: siteTokens["space-1"],
  borderRadius: siteTokens["radius-pill"],
  backgroundColor: siteTokens["color-bg-elevated"],
  border: `1px solid ${siteTokens["color-border"]}`,
});

export const tab = recipe({
  base: {
    appearance: "none",
    border: "none",
    background: "transparent",
    paddingInline: siteTokens["space-4"],
    paddingBlock: siteTokens["space-2"],
    borderRadius: siteTokens["radius-pill"],
    color: siteTokens["color-fg-muted"],
    fontSize: "13px",
    fontWeight: 600,
    letterSpacing: "0.02em",
    cursor: "pointer",
    transition: "background-color 120ms ease, color 120ms ease",
    "&:focus-visible": {
      outline: `2px solid ${siteTokens["color-accent"]}`,
      outlineOffset: "2px",
    },
  },
  variants: {
    active: {
      yes: {
        backgroundColor: siteTokens["color-bg"],
        color: siteTokens["color-fg"],
        boxShadow: `inset 0 0 0 1px ${siteTokens["color-border-strong"]}`,
      },
      no: {
        backgroundColor: "transparent",
      },
    },
  },
  defaultVariants: {
    active: "no",
  },
});
