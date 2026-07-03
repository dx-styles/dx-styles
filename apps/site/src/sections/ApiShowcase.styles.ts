import { css } from "dx-styles";

import { siteTokens } from "../spike/theme";

export const layout = css({
  display: "grid",
  gridTemplateColumns: "minmax(0, 0.42fr) minmax(0, 0.58fr)",
  gap: siteTokens["space-10"],
  alignItems: "start",
  marginTop: siteTokens["space-10"],
  "@media (max-width: 960px)": {
    gridTemplateColumns: "1fr",
    gap: siteTokens["space-6"],
  },
});

export const summary = css({
  fontSize: "16px",
  color: siteTokens["color-fg-muted"],
  lineHeight: 1.65,
  marginTop: siteTokens["space-5"],
});

export const apiName = css({
  fontFamily: siteTokens["font-mono"],
  fontSize: "clamp(22px, 2.4vw, 28px)",
  fontWeight: 600,
  color: siteTokens["color-fg"],
  marginTop: siteTokens["space-4"],
});

export const codeStack = css({
  display: "flex",
  flexDirection: "column",
  gap: siteTokens["space-4"],
});

export const codeStep = css({
  display: "flex",
  alignItems: "center",
  gap: siteTokens["space-3"],
  fontSize: "12px",
  fontWeight: 600,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: siteTokens["color-fg-subtle"],
});

export const codeStepBullet = css({
  display: "inline-grid",
  placeItems: "center",
  width: "22px",
  height: "22px",
  borderRadius: siteTokens["radius-pill"],
  backgroundColor: siteTokens["color-accent-soft"],
  color: siteTokens["color-accent"],
  fontFamily: siteTokens["font-mono"],
  fontSize: "11px",
  fontWeight: 700,
});
