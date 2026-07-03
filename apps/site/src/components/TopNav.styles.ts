import { css } from "dx-styles";

import { siteTokens } from "../spike/theme";

export const wrapper = css({
  position: "fixed",
  top: siteTokens["space-3"],
  insetInlineStart: "50%",
  transform: "translateX(-50%)",
  zIndex: 20,
  display: "flex",
  width: "min(1000px, calc(100% - 24px))",
  alignItems: "center",
  justifyContent: "space-between",
  gap: siteTokens["space-4"],
  paddingInline: siteTokens["space-4"],
  paddingBlock: siteTokens["space-2"],
  borderRadius: siteTokens["radius-pill"],
  border: `1px solid ${siteTokens["color-border"]}`,
  backgroundColor: "rgba(11, 14, 26, 0.72)",
  backdropFilter: "blur(14px)",
  WebkitBackdropFilter: "blur(14px)",
  boxShadow: siteTokens["shadow-card"],
});

export const brand = css({
  display: "inline-flex",
  alignItems: "center",
  gap: siteTokens["space-2"],
  color: siteTokens["color-fg"],
  fontWeight: 700,
  letterSpacing: "-0.005em",
});

export const glyph = css({
  display: "inline-grid",
  placeItems: "center",
  width: "28px",
  height: "28px",
  borderRadius: "8px",
  backgroundImage: `linear-gradient(135deg, ${siteTokens["color-accent"]}, ${siteTokens["color-success"]})`,
  color: "#0b0f1c",
  fontFamily: siteTokens["font-mono"],
  fontSize: "12px",
  fontWeight: 700,
});

export const links = css({
  display: "inline-flex",
  alignItems: "center",
  gap: siteTokens["space-1"],
  "@media (max-width: 720px)": {
    display: "none",
  },
});

export const link = css({
  paddingInline: siteTokens["space-3"],
  paddingBlock: siteTokens["space-2"],
  borderRadius: siteTokens["radius-pill"],
  fontSize: "13px",
  fontWeight: 600,
  color: siteTokens["color-fg-muted"],
  transition: "color 120ms ease, background-color 120ms ease",
  "&:hover": {
    color: siteTokens["color-fg"],
    backgroundColor: "rgba(255, 255, 255, 0.06)",
  },
  "&:focus-visible": {
    outline: `2px solid ${siteTokens["color-accent"]}`,
    outlineOffset: "2px",
  },
});

export const ctaLink = css({
  display: "inline-flex",
  alignItems: "center",
  gap: siteTokens["space-2"],
  paddingInline: siteTokens["space-4"],
  paddingBlock: siteTokens["space-2"],
  borderRadius: siteTokens["radius-pill"],
  fontSize: "13px",
  fontWeight: 600,
  color: "#fff",
  backgroundColor: siteTokens["color-accent-strong"],
  boxShadow: "0 6px 18px rgba(84, 104, 255, 0.3)",
  "&:hover": {
    backgroundColor: "#3f53e8",
    color: "#fff",
  },
});
