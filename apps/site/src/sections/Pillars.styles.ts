import { css } from "dx-styles";

import { siteTokens } from "../spike/theme";

export const grid = css({
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: siteTokens["space-6"],
  marginTop: siteTokens["space-12"],
});

export const numberLabel = css({
  fontFamily: siteTokens["font-mono"],
  fontSize: "13px",
  color: siteTokens["color-fg-subtle"],
  letterSpacing: "0.08em",
});
