import { slotRecipe } from "dx-styles";

import { siteTokens } from "../theme";

export const checkbox = slotRecipe({
  slots: ["root", "input", "control", "indicator", "label"],
  base: {
    root: {
      alignItems: "center",
      color: "#1d2030",
      cursor: "pointer",
      display: "inline-flex",
      fontFamily: siteTokens["font-body"],
      fontSize: "14px",
      gap: siteTokens["space-2"],
      lineHeight: 1.4,
      position: "relative",
      userSelect: "none",
    },
    input: {
      blockSize: "1px",
      inlineSize: "1px",
      insetInlineStart: 0,
      margin: 0,
      opacity: 0,
      position: "absolute",
    },
    control: {
      alignItems: "center",
      backgroundColor: "#ffffff",
      blockSize: "18px",
      border: "1px solid rgba(90, 96, 121, 0.36)",
      borderRadius: siteTokens["radius-sm"],
      boxSizing: "border-box",
      color: "#ffffff",
      display: "inline-flex",
      flexShrink: 0,
      inlineSize: "18px",
      justifyContent: "center",
      transition: "background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease",
    },
    indicator: {
      fontSize: "12px",
      fontWeight: 800,
      lineHeight: 1,
      opacity: 0,
      transform: "translateY(-0.5px)",
    },
    label: {
      color: "#1d2030",
    },
  },
  variants: {
    checked: {
      false: {},
      true: {
        control: {
          backgroundColor: siteTokens["color-accent-strong"],
          borderColor: siteTokens["color-accent-strong"],
        },
        indicator: {
          opacity: 1,
          "::before": {
            content: '"\\2713"',
          },
        },
      },
    },
    indeterminate: {
      false: {},
      true: {
        control: {
          backgroundColor: siteTokens["color-accent-strong"],
          borderColor: siteTokens["color-accent-strong"],
        },
        indicator: {
          opacity: 1,
          "::before": {
            content: '"-"',
          },
        },
      },
    },
  },
  defaultVariants: {
    checked: "false",
    indeterminate: "false",
  },
});
