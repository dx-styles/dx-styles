import { css, slotRecipe } from "dx-styles";

import { siteTokens } from "../spike/theme";

export const grid = css({
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
  gap: siteTokens["space-6"],
  marginTop: siteTokens["space-10"],
});

export const dxCard = slotRecipe({
  slots: ["root", "header", "title", "description", "code"] as const,
  base: {
    root: {
      display: "flex",
      flexDirection: "column",
      gap: siteTokens["space-4"],
      padding: siteTokens["space-6"],
      borderRadius: siteTokens["radius-lg"],
      border: `1px solid ${siteTokens["color-border"]}`,
      backgroundColor: siteTokens["color-bg-elevated"],
      boxShadow: siteTokens["shadow-card"],
    },
    header: {
      display: "flex",
      flexDirection: "column",
      gap: siteTokens["space-2"],
    },
    title: {
      fontFamily: siteTokens["font-display"],
      fontSize: "20px",
      fontWeight: 600,
      color: siteTokens["color-fg"],
    },
    description: {
      fontSize: "14.5px",
      color: siteTokens["color-fg-muted"],
      lineHeight: 1.6,
    },
    code: {
      marginTop: "auto",
    },
  },
  variants: {},
});

export const banner = css({
  display: "grid",
  gridTemplateColumns: "1.1fr 0.9fr",
  gap: siteTokens["space-10"],
  alignItems: "center",
  marginTop: siteTokens["space-12"],
  padding: siteTokens["space-8"],
  borderRadius: siteTokens["radius-lg"],
  border: `1px solid ${siteTokens["color-border"]}`,
  backgroundImage: `radial-gradient(circle at 0% 100%, rgba(58, 210, 159, 0.18), transparent 65%), linear-gradient(160deg, ${siteTokens["color-bg-muted"]}, ${siteTokens["color-bg-elevated"]})`,
  "@media (max-width: 960px)": {
    gridTemplateColumns: "1fr",
  },
});

export const bannerHead = css({
  display: "flex",
  flexDirection: "column",
  gap: siteTokens["space-3"],
});

export const bannerTitle = css({
  fontFamily: siteTokens["font-display"],
  fontSize: "clamp(22px, 2.4vw, 30px)",
  fontWeight: 700,
  color: siteTokens["color-fg"],
  letterSpacing: "-0.01em",
});

export const bannerLead = css({
  color: siteTokens["color-fg-muted"],
  fontSize: "15px",
  lineHeight: 1.6,
  maxWidth: "440px",
});
