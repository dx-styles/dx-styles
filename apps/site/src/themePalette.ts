import { assignVars, type PartialContractValues } from "dx-styles";
import type { CSSProperties } from "react";

import { siteTokens, type SiteTokenShape } from "./spike/theme";

export const DEFAULT_BASE_COLOR = "#7c8cff";

export interface OklchColor {
  readonly l: number;
  readonly c: number;
  readonly h: number;
}

export type SitePalette = PartialContractValues<SiteTokenShape>;

const DEFAULT_HUE = 275;

const round = (value: number, precision: number): number => Number(value.toFixed(precision));

const format = (value: number, precision: number): string => String(round(value, precision));

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const wrapHue = (value: number): number => {
  const wrapped = value % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
};

const toOklch = (lightness: number, chroma: number, hue: number, alpha?: number): string => {
  const base = `oklch(${format(lightness, 3)} ${format(chroma, 3)} ${format(wrapHue(hue), 1)})`;
  return alpha === undefined ? base : base.replace(")", ` / ${format(alpha, 2)})`);
};

const normalizeHexColor = (value: string): string => {
  const trimmed = value.trim();
  const shortMatch = /^#?([0-9a-f]{3})$/i.exec(trimmed);
  if (shortMatch) {
    return `#${shortMatch[1]
      .split("")
      .map((part) => part + part)
      .join("")
      .toLowerCase()}`;
  }

  const fullMatch = /^#?([0-9a-f]{6})$/i.exec(trimmed);
  if (fullMatch) {
    return `#${fullMatch[1].toLowerCase()}`;
  }

  throw new Error(`Expected a 3- or 6-digit hex color, received "${value}".`);
};

const toLinearRgbChannel = (channel: number): number => {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
};

export const getBaseColorOklch = (baseHex: string): OklchColor => {
  const normalized = normalizeHexColor(baseHex);
  const red = toLinearRgbChannel(Number.parseInt(normalized.slice(1, 3), 16));
  const green = toLinearRgbChannel(Number.parseInt(normalized.slice(3, 5), 16));
  const blue = toLinearRgbChannel(Number.parseInt(normalized.slice(5, 7), 16));

  const l = 0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue;
  const m = 0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue;
  const s = 0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue;

  const lRoot = Math.cbrt(l);
  const mRoot = Math.cbrt(m);
  const sRoot = Math.cbrt(s);

  const lightness = 0.2104542553 * lRoot + 0.793617785 * mRoot - 0.0040720468 * sRoot;
  const a = 1.9779984951 * lRoot - 2.428592205 * mRoot + 0.4505937099 * sRoot;
  const b = 0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.808675766 * sRoot;
  const chroma = Math.sqrt(a * a + b * b);
  const hue = chroma < 0.001 ? DEFAULT_HUE : wrapHue((Math.atan2(b, a) * 180) / Math.PI);

  return {
    l: round(lightness, 3),
    c: round(chroma, 3),
    h: round(hue, 1),
  };
};

export const getSitePalette = (baseHex: string): SitePalette => {
  const base = getBaseColorOklch(baseHex);
  const hue = base.c < 0.01 ? DEFAULT_HUE : base.h;
  const accentLightness = clamp(base.l, 0.58, 0.76);
  const accentChroma = clamp(base.c, 0.08, 0.2);

  return {
    "color-bg": toOklch(0.126, 0.024, hue),
    "color-bg-elevated": toOklch(0.175, 0.032, hue),
    "color-bg-muted": toOklch(0.24, 0.038, hue),
    "color-bg-code": toOklch(0.145, 0.028, hue),
    "color-fg": toOklch(0.955, 0.012, hue),
    "color-fg-muted": toOklch(0.79, 0.03, hue),
    "color-fg-subtle": toOklch(0.58, 0.04, hue),
    "color-accent": toOklch(accentLightness, accentChroma, hue),
    "color-accent-strong": toOklch(Math.max(0.5, accentLightness - 0.08), accentChroma, hue),
    "color-accent-soft": toOklch(accentLightness, accentChroma, hue, 0.18),
    "color-border": toOklch(0.82, 0.04, hue, 0.12),
    "color-border-strong": toOklch(0.86, 0.05, hue, 0.22),
    "color-success": toOklch(0.68, 0.14, hue + 30),
    "color-warn": toOklch(0.72, 0.14, hue - 60),
  };
};

export const getSiteThemeVars = (baseHex: string): CSSProperties =>
  assignVars(siteTokens, getSitePalette(baseHex)) as CSSProperties;
