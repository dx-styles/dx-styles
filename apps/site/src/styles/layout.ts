import { css, recipe } from "dx-styles";

import { siteTokens } from "../spike/theme";

export const page = css({
  display: "flex",
  flexDirection: "column",
  minHeight: "100vh",
});

export const container = css({
  width: "100%",
  maxWidth: "1120px",
  marginInline: "auto",
  paddingInline: siteTokens["space-6"],
});

export const section = recipe({
  base: {
    paddingBlock: `clamp(64px, 10vw, 120px)`,
    position: "relative",
  },
  variants: {
    tone: {
      base: {
        backgroundColor: "transparent",
      },
      muted: {
        backgroundColor: siteTokens["color-bg-elevated"],
        borderTop: `1px solid ${siteTokens["color-border"]}`,
        borderBottom: `1px solid ${siteTokens["color-border"]}`,
      },
      bleed: {
        backgroundColor: siteTokens["color-bg-muted"],
        borderTop: `1px solid ${siteTokens["color-border"]}`,
      },
    },
  },
  defaultVariants: {
    tone: "base",
  },
});

export const eyebrow = css({
  textTransform: "uppercase",
  letterSpacing: "0.18em",
  fontSize: "12px",
  fontWeight: 600,
  color: siteTokens["color-accent"],
  marginBottom: siteTokens["space-3"],
});

export const sectionTitle = css({
  fontSize: "clamp(28px, 3.4vw, 44px)",
  lineHeight: 1.1,
  fontWeight: 700,
  color: siteTokens["color-fg"],
  maxWidth: "880px",
});

export const sectionLead = css({
  marginTop: siteTokens["space-4"],
  fontSize: "clamp(16px, 1.4vw, 18px)",
  color: siteTokens["color-fg-muted"],
  maxWidth: "780px",
});

export const stack = recipe({
  base: {
    display: "flex",
    flexDirection: "column",
  },
  variants: {
    gap: {
      "2": { gap: siteTokens["space-2"] },
      "3": { gap: siteTokens["space-3"] },
      "4": { gap: siteTokens["space-4"] },
      "6": { gap: siteTokens["space-6"] },
      "8": { gap: siteTokens["space-8"] },
    },
  },
  defaultVariants: {
    gap: "4",
  },
});
