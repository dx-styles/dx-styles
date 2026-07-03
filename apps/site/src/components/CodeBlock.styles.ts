import { css, slotRecipe } from "dx-styles";

import { siteTokens } from "../spike/theme";

export const codeBlock = slotRecipe({
  slots: ["root", "header", "language", "filename", "pre", "code"] as const,
  base: {
    root: {
      display: "flex",
      flexDirection: "column",
      borderRadius: siteTokens["radius-md"],
      backgroundColor: siteTokens["color-bg-code"],
      border: `1px solid ${siteTokens["color-border"]}`,
      overflow: "hidden",
      boxShadow: siteTokens["shadow-card"],
    },
    header: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      paddingInline: siteTokens["space-4"],
      paddingBlock: siteTokens["space-2"],
      borderBottom: `1px solid ${siteTokens["color-border"]}`,
      backgroundColor: "rgba(255, 255, 255, 0.02)",
      color: siteTokens["color-fg-subtle"],
      fontSize: "12px",
      letterSpacing: "0.04em",
    },
    filename: {
      fontFamily: siteTokens["font-mono"],
      color: siteTokens["color-fg-muted"],
    },
    language: {
      textTransform: "uppercase",
      fontWeight: 600,
      color: siteTokens["color-accent"],
    },
    pre: {
      margin: 0,
      paddingInline: siteTokens["space-5"],
      paddingBlock: siteTokens["space-5"],
      overflowX: "auto",
      fontSize: "13.5px",
      lineHeight: 1.65,
    },
    code: {
      color: siteTokens["color-fg"],
      whiteSpace: "pre",
    },
  },
  variants: {
    size: {
      md: {
        pre: {
          paddingBlock: siteTokens["space-5"],
        },
      },
      sm: {
        pre: {
          paddingBlock: siteTokens["space-3"],
          fontSize: "12.5px",
        },
      },
      xs: {
        pre: {
          paddingInline: siteTokens["space-4"],
          paddingBlock: siteTokens["space-3"],
          fontSize: "11.5px",
          lineHeight: 1.6,
        },
      },
    },
    wrap: {
      yes: {
        code: {
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        },
      },
      no: {},
    },
  },
  defaultVariants: {
    size: "md",
    wrap: "no",
  },
});

export const tokenColor = {
  keyword: css({ color: "#c594ff" }),
  string: css({ color: "#7be39c" }),
  comment: css({ color: "#5d6480", fontStyle: "italic" }),
  property: css({ color: "#9ad9ff" }),
  punct: css({ color: "#7a8198" }),
  number: css({ color: "#ffb877" }),
  fn: css({ color: "#ffd479" }),
};
