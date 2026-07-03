import { describe, expect, test } from "bun:test";

import {
  DEFAULT_BASE_COLOR,
  getBaseColorOklch,
  getSitePalette,
  getSiteThemeVars,
} from "./themePalette";

describe("OKLCH site palette", () => {
  test("keeps the default base color aligned with the static theme accent", () => {
    expect(DEFAULT_BASE_COLOR).toBe("#7c8cff");
    expect(getSitePalette(DEFAULT_BASE_COLOR)["color-accent"]).toBe("oklch(0.681 0.169 275)");
  });

  test("derives a balanced dark palette from a single base color", () => {
    const palette = getSitePalette("#00aa66");

    expect(palette["color-bg"]).toBe("oklch(0.126 0.024 156.5)");
    expect(palette["color-bg-elevated"]).toBe("oklch(0.175 0.032 156.5)");
    expect(palette["color-accent"]).toBe("oklch(0.649 0.156 156.5)");
    expect(palette["color-accent-soft"]).toBe("oklch(0.649 0.156 156.5 / 0.18)");
    expect(palette["color-success"]).toBe("oklch(0.68 0.14 186.5)");
    expect(palette["color-warn"]).toBe("oklch(0.72 0.14 96.5)");
  });

  test("exposes runtime assignments for site token variables", () => {
    const vars = getSiteThemeVars("#ff7a1a");

    expect(vars["--dx-site-color-accent"]).toBe("oklch(0.724 0.187 48.9)");
    expect(vars["--dx-site-color-bg"]).toBe("oklch(0.126 0.024 48.9)");
  });

  test("normalizes short hex colors before OKLCH conversion", () => {
    expect(getBaseColorOklch("#abc")).toEqual({
      l: 0.784,
      c: 0.031,
      h: 248.2,
    });
  });
});
