import { css } from "dx-styles";

import { siteTokens } from "../spike/theme";

export const corner = css({
  position: "absolute",
  top: 0,
  insetInlineEnd: 0,
  zIndex: 10,
  color: siteTokens["color-bg"],
  "&:dir(rtl)": {
    transform: "scale(-1, 1)",
  },
  "&:hover [data-octo-arm]": {
    animation: "octocat-wave 560ms ease-in-out",
  },
  "&:focus-visible": {
    outline: `2px solid ${siteTokens["color-accent"]}`,
    outlineOffset: "-2px",
  },
  "@media (max-width: 1200px)": {
    display: "none",
  },
  "@media (prefers-reduced-motion: reduce)": {
    "&:hover [data-octo-arm]": {
      animation: "none",
    },
  },
});

export const graphic = css({
  display: "block",
  fill: siteTokens["color-fg"],
});

export const octoArm = css({
  transformOrigin: "130px 106px",
});
