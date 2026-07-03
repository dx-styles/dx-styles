import { css, recipe } from "dx-styles";

import { siteTokens } from "../spike/theme";

export const heroSection = css({
  paddingBlockStart: "clamp(96px, 14vw, 168px)",
  paddingBlockEnd: "clamp(64px, 10vw, 128px)",
  position: "relative",
  isolation: "isolate",
});

export const heroGrid = css({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.05fr) minmax(0, 0.95fr)",
  gap: siteTokens["space-12"],
  alignItems: "center",
  "@media (max-width: 960px)": {
    gridTemplateColumns: "1fr",
    gap: siteTokens["space-8"],
  },
});

export const heroEyebrow = css({
  display: "flex",
  alignItems: "center",
  gap: siteTokens["space-3"],
  marginBottom: siteTokens["space-6"],
});

export const heroTitle = css({
  fontSize: "clamp(40px, 6vw, 72px)",
  lineHeight: 1.02,
  letterSpacing: "-0.025em",
  fontWeight: 700,
  color: siteTokens["color-fg"],
  marginBottom: siteTokens["space-6"],
});

export const heroAccent = css({
  background: `linear-gradient(120deg, ${siteTokens["color-accent"]} 0%, ${siteTokens["color-success"]} 100%)`,
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  backgroundClip: "text",
});

export const heroLead = css({
  fontSize: "clamp(17px, 1.6vw, 20px)",
  color: siteTokens["color-fg-muted"],
  maxWidth: "560px",
  marginBottom: siteTokens["space-8"],
});

export const ctaRow = css({
  display: "flex",
  flexWrap: "wrap",
  gap: siteTokens["space-3"],
  alignItems: "center",
});

export const cta = recipe({
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: siteTokens["space-2"],
    paddingInline: siteTokens["space-6"],
    paddingBlock: siteTokens["space-3"],
    borderRadius: siteTokens["radius-pill"],
    fontSize: "15px",
    fontWeight: 600,
    letterSpacing: "0.01em",
    cursor: "pointer",
    textDecoration: "none",
    transition: "transform 140ms ease, box-shadow 140ms ease, background-color 140ms ease",
  },
  variants: {
    intent: {
      primary: {
        backgroundColor: siteTokens["color-accent-strong"],
        color: "#fff",
        boxShadow: "0 8px 24px rgba(84, 104, 255, 0.35)",
        "&:hover": {
          backgroundColor: "#3f53e8",
          color: "#fff",
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

export const heroStats = css({
  display: "flex",
  gap: siteTokens["space-8"],
  marginTop: siteTokens["space-12"],
  flexWrap: "wrap",
});

export const statBlock = css({
  display: "flex",
  flexDirection: "column",
  gap: siteTokens["space-1"],
});

export const statValue = css({
  fontFamily: siteTokens["font-display"],
  fontSize: "28px",
  fontWeight: 700,
  color: siteTokens["color-fg"],
});

export const statLabel = css({
  fontSize: "13px",
  color: siteTokens["color-fg-subtle"],
  textTransform: "uppercase",
  letterSpacing: "0.12em",
});
