import { css, recipe } from "dx-styles";

import { siteTokens } from "../spike/theme";

export const cta = css({
  display: "grid",
  gridTemplateColumns: "minmax(0, 0.55fr) minmax(0, 0.45fr)",
  gap: siteTokens["space-10"],
  alignItems: "center",
  paddingBlock: siteTokens["space-12"],
  paddingInline: siteTokens["space-12"],
  borderRadius: siteTokens["radius-lg"],
  border: `1px solid ${siteTokens["color-border-strong"]}`,
  backgroundImage: `radial-gradient(circle at 100% 0%, ${siteTokens["color-accent-soft"]}, transparent 60%), linear-gradient(160deg, ${siteTokens["color-bg-muted"]}, ${siteTokens["color-bg-elevated"]})`,
  boxShadow: siteTokens["shadow-elevated"],
  "@media (max-width: 960px)": {
    gridTemplateColumns: "1fr",
    paddingInline: siteTokens["space-6"],
    paddingBlock: siteTokens["space-8"],
  },
});

export const ctaTitle = css({
  fontSize: "clamp(28px, 3.4vw, 40px)",
  lineHeight: 1.1,
  fontWeight: 700,
  color: siteTokens["color-fg"],
  marginBottom: siteTokens["space-4"],
  letterSpacing: "-0.015em",
});

export const ctaLead = css({
  color: siteTokens["color-fg-muted"],
  fontSize: "16.5px",
  marginBottom: siteTokens["space-6"],
  maxWidth: "440px",
  lineHeight: 1.6,
});

export const linkRow = css({
  display: "flex",
  flexWrap: "wrap",
  gap: siteTokens["space-3"],
});

export const inlineLink = css({
  color: siteTokens["color-accent"],
  textDecoration: "underline",
  textUnderlineOffset: "3px",
  textDecorationThickness: "1px",
  "&:hover": {
    color: siteTokens["color-accent-strong"],
  },
});

export const link = recipe({
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: siteTokens["space-2"],
    paddingInline: siteTokens["space-5"],
    paddingBlock: siteTokens["space-3"],
    borderRadius: siteTokens["radius-pill"],
    fontSize: "14px",
    fontWeight: 600,
    textDecoration: "none",
    transition: "background-color 140ms ease, transform 140ms ease",
  },
  variants: {
    intent: {
      primary: {
        backgroundColor: siteTokens["color-fg"],
        color: siteTokens["color-bg"],
        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.35)",
        "&:hover": {
          backgroundColor: "#dfe3ee",
          color: siteTokens["color-bg"],
          transform: "translateY(-1px)",
        },
      },
      ghost: {
        backgroundColor: "transparent",
        color: siteTokens["color-fg"],
        border: `1px solid ${siteTokens["color-border-strong"]}`,
        "&:hover": {
          backgroundColor: siteTokens["color-bg-elevated"],
          color: siteTokens["color-fg"],
        },
      },
    },
  },
  defaultVariants: {
    intent: "primary",
  },
});

export const footer = css({
  paddingBlock: siteTokens["space-8"],
  borderTop: `1px solid ${siteTokens["color-border"]}`,
  marginTop: siteTokens["space-12"],
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "space-between",
  gap: siteTokens["space-4"],
  color: siteTokens["color-fg-subtle"],
  fontSize: "13px",
});
