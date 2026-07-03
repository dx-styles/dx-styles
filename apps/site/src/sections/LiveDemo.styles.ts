import { css } from "dx-styles";

import { siteTokens } from "../spike/theme";

export const stage = css({
  display: "grid",
  gridTemplateColumns: "minmax(0, 0.55fr) minmax(0, 0.45fr)",
  gap: siteTokens["space-10"],
  alignItems: "stretch",
  marginTop: siteTokens["space-10"],
  "@media (max-width: 960px)": {
    gridTemplateColumns: "1fr",
    gap: siteTokens["space-6"],
  },
});

export const showcase = css({
  display: "flex",
  flexDirection: "column",
  gap: siteTokens["space-6"],
  padding: siteTokens["space-8"],
  borderRadius: siteTokens["radius-lg"],
  backgroundColor: "#f7f8fc",
  border: "1px solid rgba(0, 0, 0, 0.06)",
  color: "#1d2030",
  colorScheme: "light",
  boxShadow: siteTokens["shadow-card"],
});

export const row = css({
  display: "flex",
  flexWrap: "wrap",
  gap: siteTokens["space-3"],
  alignItems: "center",
});

export const groupLabel = css({
  fontSize: "12px",
  fontWeight: 600,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "#5a6079",
});

export const callout = css({
  padding: siteTokens["space-4"],
  borderRadius: siteTokens["radius-md"],
  backgroundColor: "rgba(124, 140, 255, 0.08)",
  border: "1px solid rgba(84, 104, 255, 0.18)",
  fontSize: "13.5px",
  color: "#1d2030",
  lineHeight: 1.6,
  display: "flex",
  flexDirection: "column",
  gap: siteTokens["space-2"],
});

export const calloutLabel = css({
  fontSize: "12px",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.12em",
  color: siteTokens["color-accent-strong"],
});
