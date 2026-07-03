import { slotRecipe } from "dx-styles";

import { siteTokens } from "../spike/theme";

export const card = slotRecipe({
  slots: ["root", "header", "title", "description", "body", "footer"] as const,
  base: {
    root: {
      display: "flex",
      flexDirection: "column",
      gap: siteTokens["space-4"],
      padding: siteTokens["space-6"],
      borderRadius: siteTokens["radius-lg"],
      border: `1px solid ${siteTokens["color-border"]}`,
      backgroundColor: siteTokens["color-bg-elevated"],
      boxShadow: siteTokens["shadow-card"],
      transition: "border-color 160ms ease, transform 160ms ease",
    },
    header: {
      display: "flex",
      flexDirection: "column",
      gap: siteTokens["space-2"],
    },
    title: {
      fontFamily: siteTokens["font-display"],
      fontSize: "20px",
      fontWeight: 600,
      color: siteTokens["color-fg"],
      letterSpacing: "-0.005em",
    },
    description: {
      fontSize: "15px",
      color: siteTokens["color-fg-muted"],
      lineHeight: 1.55,
    },
    body: {
      display: "flex",
      flexDirection: "column",
      gap: siteTokens["space-3"],
      color: siteTokens["color-fg-muted"],
      fontSize: "15px",
    },
    footer: {
      marginTop: "auto",
      display: "flex",
      alignItems: "center",
      gap: siteTokens["space-3"],
      color: siteTokens["color-fg-subtle"],
      fontSize: "13px",
    },
  },
  variants: {
    emphasis: {
      flat: {
        root: {},
      },
      raised: {
        root: {
          borderColor: siteTokens["color-border-strong"],
          backgroundColor: siteTokens["color-bg-muted"],
        },
      },
      accent: {
        root: {
          borderColor: "transparent",
          backgroundImage: `linear-gradient(140deg, ${siteTokens["color-accent-soft"]}, transparent 60%)`,
          backgroundColor: siteTokens["color-bg-elevated"],
        },
      },
    },
  },
  defaultVariants: {
    emphasis: "flat",
  },
});
