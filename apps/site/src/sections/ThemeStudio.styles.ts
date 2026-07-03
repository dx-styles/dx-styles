import { css } from "dx-styles";

import { siteTokens } from "../spike/theme";

export const themeStage = css({
  "--studio-radius": "10px",
  display: "flex",
  flexDirection: "column",
  gap: siteTokens["space-5"],
  padding: siteTokens["space-6"],
  borderRadius: siteTokens["radius-lg"],
  border: `1px solid ${siteTokens["color-border"]}`,
  backgroundColor: siteTokens["color-bg-elevated"],
  color: siteTokens["color-fg"],
  transition: "background-color 220ms ease, color 220ms ease, border-color 220ms ease",
  boxShadow: siteTokens["shadow-card"],
});

export const layout = css({
  display: "grid",
  gridTemplateColumns: "minmax(0, 0.45fr) minmax(0, 0.55fr)",
  gap: siteTokens["space-10"],
  alignItems: "stretch",
  marginTop: siteTokens["space-10"],
  "@media (max-width: 960px)": {
    gridTemplateColumns: "1fr",
    gap: siteTokens["space-6"],
  },
});

export const sideCopy = css({
  display: "flex",
  flexDirection: "column",
  gap: siteTokens["space-5"],
});

export const pickerPanel = css({
  display: "grid",
  gridTemplateColumns: "auto minmax(0, 1fr)",
  gap: siteTokens["space-4"],
  alignItems: "center",
  padding: siteTokens["space-4"],
  borderRadius: siteTokens["radius-md"],
  border: `1px solid ${siteTokens["color-border"]}`,
  backgroundColor: siteTokens["color-bg-elevated"],
});

export const colorInput = css({
  width: "56px",
  height: "56px",
  padding: "0",
  border: "none",
  borderRadius: siteTokens["radius-md"],
  backgroundColor: "transparent",
  cursor: "pointer",
});

export const colorReadout = css({
  display: "grid",
  gap: siteTokens["space-1"],
  minWidth: 0,
});

export const colorValue = css({
  fontFamily: siteTokens["font-mono"],
  fontSize: "14px",
  fontWeight: 700,
  color: siteTokens["color-fg"],
});

export const colorMeta = css({
  fontFamily: siteTokens["font-mono"],
  fontSize: "12px",
  color: siteTokens["color-fg-subtle"],
});

export const stageHead = css({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "space-between",
  gap: siteTokens["space-3"],
});

export const stageHint = css({
  fontSize: "12px",
  fontWeight: 600,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: siteTokens["color-fg-subtle"],
});

export const stageTitle = css({
  fontFamily: siteTokens["font-display"],
  fontSize: "18px",
  fontWeight: 700,
  color: siteTokens["color-fg"],
});

export const proofRow = css({
  display: "flex",
  flexWrap: "wrap",
  gap: siteTokens["space-3"],
});

const proofControl = css({
  display: "inline-flex",
  alignItems: "center",
  paddingInline: siteTokens["space-4"],
  paddingBlock: siteTokens["space-2"],
  borderRadius: "var(--studio-radius)",
  fontSize: "14px",
  fontWeight: 600,
  border: "1px solid transparent",
});

export const proofContained = css(proofControl, {
  backgroundColor: siteTokens["color-accent"],
  color: siteTokens["color-bg"],
});

export const proofOutline = css(proofControl, {
  borderColor: siteTokens["color-border-strong"],
  backgroundColor: siteTokens["color-bg-elevated"],
  color: siteTokens["color-fg"],
});

export const proofText = css(proofControl, {
  backgroundColor: "transparent",
  color: siteTokens["color-accent"],
});

export const swatchGrid = css({
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(92px, 1fr))",
  gap: siteTokens["space-2"],
});

export const swatchCard = css({
  display: "flex",
  flexDirection: "column",
  gap: siteTokens["space-2"],
  padding: siteTokens["space-3"],
  borderRadius: "var(--studio-radius)",
  border: `1px solid ${siteTokens["color-border"]}`,
  backgroundColor: siteTokens["color-bg-muted"],
  fontSize: "12px",
  fontWeight: 600,
  color: siteTokens["color-fg-muted"],
});

export const swatchChip = css({
  height: "28px",
  borderRadius: "6px",
  border: `1px solid ${siteTokens["color-border-strong"]}`,
});

export const stageFooter = css({
  display: "flex",
  flexWrap: "wrap",
  gap: siteTokens["space-2"],
  alignItems: "center",
  marginTop: "auto",
  paddingTop: siteTokens["space-3"],
  borderTop: `1px solid ${siteTokens["color-border"]}`,
});

export const footPill = css({
  display: "inline-flex",
  paddingInline: siteTokens["space-3"],
  paddingBlock: "4px",
  borderRadius: siteTokens["radius-pill"],
  fontSize: "12px",
  fontWeight: 600,
  color: siteTokens["color-fg-muted"],
  backgroundColor: siteTokens["color-bg-muted"],
  border: `1px solid ${siteTokens["color-border"]}`,
});
