import { recipe } from "dx-styles";

import { siteTokens } from "../spike/theme";

export const pill = recipe({
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: siteTokens["space-2"],
    paddingInline: siteTokens["space-3"],
    paddingBlock: siteTokens["space-1"],
    borderRadius: siteTokens["radius-pill"],
    fontSize: "12px",
    fontWeight: 600,
    letterSpacing: "0.04em",
    border: `1px solid ${siteTokens["color-border"]}`,
    backgroundColor: siteTokens["color-bg-elevated"],
    color: siteTokens["color-fg-muted"],
  },
  variants: {
    tone: {
      neutral: {},
      accent: {
        backgroundColor: siteTokens["color-accent-soft"],
        borderColor: "transparent",
        color: siteTokens["color-accent"],
      },
      success: {
        backgroundColor: "rgba(58, 210, 159, 0.14)",
        borderColor: "transparent",
        color: siteTokens["color-success"],
      },
    },
  },
  defaultVariants: {
    tone: "neutral",
  },
});
