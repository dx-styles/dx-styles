import { recipe } from "dx-styles";

import { siteTokens } from "../theme";

export const button = recipe({
  base: {
    alignItems: "center",
    border: "1px solid transparent",
    borderRadius: siteTokens["radius-pill"],
    cursor: "pointer",
    display: "inline-flex",
    fontFamily: siteTokens["font-body"],
    fontWeight: 700,
    gap: siteTokens["space-2"],
    justifyContent: "center",
    lineHeight: 1,
    transition:
      "background-color 160ms ease, border-color 160ms ease, color 160ms ease, transform 160ms ease",
    userSelect: "none",
    ":hover": {
      transform: "translateY(-1px)",
    },
    ":focus-visible": {
      outline: `2px solid ${siteTokens["color-accent"]}`,
      outlineOffset: "2px",
    },
    ":disabled": {
      cursor: "not-allowed",
      opacity: 0.52,
      transform: "none",
    },
  },
  variants: {
    size: {
      small: {
        fontSize: "13px",
        minHeight: "28px",
        paddingInline: siteTokens["space-3"],
      },
      medium: {
        fontSize: "14px",
        minHeight: "36px",
        paddingInline: siteTokens["space-4"],
      },
      large: {
        fontSize: "15px",
        minHeight: "44px",
        paddingInline: siteTokens["space-5"],
      },
    },
    styleMode: {
      contained: {
        backgroundColor: siteTokens["color-accent-strong"],
        color: "#ffffff",
      },
      outline: {
        backgroundColor: "#ffffff",
        borderColor: "rgba(84, 104, 255, 0.34)",
        color: siteTokens["color-accent-strong"],
      },
      text: {
        backgroundColor: "transparent",
        color: siteTokens["color-accent-strong"],
      },
    },
  },
  defaultVariants: {
    size: "medium",
    styleMode: "contained",
  },
});
