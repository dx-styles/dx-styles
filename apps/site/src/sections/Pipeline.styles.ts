import { css, recipe } from "dx-styles";

import { siteTokens } from "../spike/theme";

export const flow = css({
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: siteTokens["space-4"],
  alignItems: "stretch",
  marginTop: siteTokens["space-10"],
  position: "relative",
  "@media (max-width: 800px)": {
    gridTemplateColumns: "1fr",
  },
});

export const stage = recipe({
  base: {
    display: "flex",
    flexDirection: "column",
    gap: siteTokens["space-3"],
    padding: siteTokens["space-6"],
    borderRadius: siteTokens["radius-lg"],
    border: `1px solid ${siteTokens["color-border"]}`,
    backgroundColor: siteTokens["color-bg-elevated"],
    position: "relative",
    minHeight: "180px",
  },
  variants: {
    tone: {
      input: {
        borderColor: "rgba(124, 140, 255, 0.32)",
        backgroundImage: `linear-gradient(150deg, ${siteTokens["color-accent-soft"]}, transparent 70%)`,
      },
      transform: {
        borderColor: "rgba(255, 168, 58, 0.28)",
        backgroundImage: "linear-gradient(150deg, rgba(255, 168, 58, 0.16), transparent 70%)",
      },
      output: {
        borderColor: "rgba(58, 210, 159, 0.32)",
        backgroundImage: "linear-gradient(150deg, rgba(58, 210, 159, 0.18), transparent 70%)",
      },
    },
  },
});

export const stageStep = css({
  fontFamily: siteTokens["font-mono"],
  fontSize: "12px",
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: siteTokens["color-fg-subtle"],
});

export const stageTitle = css({
  fontFamily: siteTokens["font-display"],
  fontSize: "20px",
  fontWeight: 600,
  color: siteTokens["color-fg"],
});

export const stageBody = css({
  fontSize: "14px",
  color: siteTokens["color-fg-muted"],
  lineHeight: 1.6,
});

export const stageHint = css({
  marginTop: "auto",
  fontSize: "12.5px",
  color: siteTokens["color-fg-subtle"],
  fontFamily: siteTokens["font-mono"],
});

export const arrow = css({
  position: "absolute",
  top: "50%",
  insetInlineEnd: "-14px",
  transform: "translateY(-50%)",
  width: "28px",
  height: "28px",
  borderRadius: "50%",
  backgroundColor: siteTokens["color-bg"],
  border: `1px solid ${siteTokens["color-border-strong"]}`,
  display: "grid",
  placeItems: "center",
  fontSize: "14px",
  color: siteTokens["color-accent"],
  zIndex: 1,
  "@media (max-width: 800px)": {
    display: "none",
  },
});

export const promise = css({
  marginTop: siteTokens["space-10"],
  padding: siteTokens["space-6"],
  borderRadius: siteTokens["radius-lg"],
  border: `1px dashed ${siteTokens["color-border-strong"]}`,
  backgroundColor: siteTokens["color-bg-muted"],
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "space-between",
  gap: siteTokens["space-4"],
});

export const promiseText = css({
  fontSize: "16px",
  color: siteTokens["color-fg"],
  fontWeight: 500,
});
