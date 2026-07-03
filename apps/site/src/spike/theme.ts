import { createTheme } from "dx-styles";

import { siteTokens } from "./tokens";

export { siteTokens, type SiteTokenShape } from "./tokens";

export const siteTheme = createTheme(siteTokens, {
  "color-bg": "#080a12",
  "color-bg-elevated": "#0f1320",
  "color-bg-muted": "#161b2c",
  "color-bg-code": "#0b0f1c",
  "color-fg": "#f1f3f9",
  "color-fg-muted": "#b6bdcd",
  "color-fg-subtle": "#7a8198",
  "color-accent": "#7c8cff",
  "color-accent-strong": "#5468ff",
  "color-accent-soft": "rgba(124, 140, 255, 0.18)",
  "color-border": "rgba(255, 255, 255, 0.08)",
  "color-border-strong": "rgba(255, 255, 255, 0.16)",
  "color-success": "#3ad29f",
  "color-warn": "#ffa83a",
  "shadow-card": "0 12px 32px rgba(2, 6, 23, 0.55)",
  "shadow-elevated": "0 24px 60px rgba(2, 6, 23, 0.65)",
  "radius-sm": "6px",
  "radius-md": "12px",
  "radius-lg": "20px",
  "radius-pill": "999px",
  "space-1": "4px",
  "space-2": "8px",
  "space-3": "12px",
  "space-4": "16px",
  "space-5": "20px",
  "space-6": "24px",
  "space-8": "32px",
  "space-10": "40px",
  "space-12": "48px",
  "space-16": "64px",
  "font-display":
    '"Inter", "SF Pro Display", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  "font-body": '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  "font-mono": '"JetBrains Mono", "SF Mono", "Menlo", "Consolas", monospace',
});
