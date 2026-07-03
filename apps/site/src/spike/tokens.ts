import { createTokenContract } from "dx-styles";

export const siteTokenShape = {
  "color-bg": null,
  "color-bg-elevated": null,
  "color-bg-muted": null,
  "color-bg-code": null,
  "color-fg": null,
  "color-fg-muted": null,
  "color-fg-subtle": null,
  "color-accent": null,
  "color-accent-strong": null,
  "color-accent-soft": null,
  "color-border": null,
  "color-border-strong": null,
  "color-success": null,
  "color-warn": null,
  "shadow-card": null,
  "shadow-elevated": null,
  "radius-sm": null,
  "radius-md": null,
  "radius-lg": null,
  "radius-pill": null,
  "space-1": null,
  "space-2": null,
  "space-3": null,
  "space-4": null,
  "space-5": null,
  "space-6": null,
  "space-8": null,
  "space-10": null,
  "space-12": null,
  "space-16": null,
  "font-display": null,
  "font-body": null,
  "font-mono": null,
} as const;

export type SiteTokenShape = typeof siteTokenShape;

export const siteTokens = createTokenContract(siteTokenShape, { prefix: "dx-site" });
