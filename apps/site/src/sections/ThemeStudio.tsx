import type { ReactElement } from "react";

import { CodeBlock } from "../components/CodeBlock";
import { Pill } from "../components/Pill";
import { container, eyebrow, section, sectionLead, sectionTitle } from "../styles/layout";
import { siteTokens } from "../spike/theme";
import type { OklchColor, SitePalette } from "../themePalette";
import {
  colorInput,
  colorMeta,
  colorReadout,
  colorValue,
  footPill,
  layout,
  pickerPanel,
  proofContained,
  proofOutline,
  proofRow,
  proofText,
  sideCopy,
  stageFooter,
  stageHead,
  stageHint,
  stageTitle,
  swatchCard,
  swatchChip,
  swatchGrid,
  themeStage,
} from "./ThemeStudio.styles";

const SNIPPET = [
  'import { assignVars } from "dx-styles";',
  "",
  "const palette = getSitePalette(baseColor);",
  "const vars = assignVars(siteTokens, palette);",
  "",
  "for (const [name, value] of Object.entries(vars)) {",
  "  document.documentElement.style.setProperty(name, String(value));",
  "}",
  "",
  "// The fallback createTheme() class stays mounted.",
  "// Runtime variables only override the token values.",
].join("\n");

export interface ThemeStudioProps {
  readonly baseColor: string;
  readonly baseOklch: OklchColor;
  readonly palette: SitePalette;
  readonly onBaseColorChange: (next: string) => void;
}

const formatOklch = ({ l, c, h }: OklchColor): string => `oklch(${l} ${c} ${h})`;

const readPalette = (palette: SitePalette, key: keyof SitePalette): string =>
  String(palette[key] ?? "transparent");

export const ThemeStudio = ({
  baseColor,
  baseOklch,
  palette,
  onBaseColorChange,
}: ThemeStudioProps): ReactElement => {
  return (
    <section className={section({ tone: "base" })} id="theme-studio">
      <div className={container}>
        <div className={eyebrow}>Theme studio</div>
        <h2 className={sectionTitle}>One base color. A live OKLCH scheme.</h2>
        <p className={sectionLead}>
          Pick a seed color and the site recomputes a balanced dark token set at runtime. Static
          extraction still owns the CSS rules; the picker only assigns typed CSS variables at the
          root boundary.
        </p>
        <div className={layout}>
          <div className={sideCopy}>
            <Pill tone="accent">OKLCH · assignVars</Pill>
            <p style={{ color: siteTokens["color-fg-muted"], fontSize: "15.5px", lineHeight: 1.6 }}>
              The base hue drives accents, borders, cards, and dark surfaces. Every section keeps
              reading the same token contract, so the whole page shifts without regenerating rules
              or adding a provider.
            </p>
            <div className={pickerPanel}>
              <input
                type="color"
                className={colorInput}
                value={baseColor}
                aria-label="Base theme color"
                onInput={(event) => {
                  onBaseColorChange(event.currentTarget.value);
                }}
                onChange={(event) => {
                  onBaseColorChange(event.currentTarget.value);
                }}
              />
              <div className={colorReadout}>
                <span className={colorValue}>{baseColor.toUpperCase()}</span>
                <span className={colorMeta}>{formatOklch(baseOklch)}</span>
              </div>
            </div>
            <CodeBlock filename="theme-runtime.ts" language="ts" size="sm">
              {SNIPPET}
            </CodeBlock>
          </div>
          <div className={themeStage}>
            <div className={stageHead}>
              <div>
                <div className={stageHint}>Runtime surface</div>
                <div className={stageTitle}>Tokens follow the base hue</div>
              </div>
              <span className={footPill}>base={baseColor}</span>
            </div>
            <div className={proofRow}>
              <span className={proofContained}>Contained</span>
              <span className={proofOutline}>Outline</span>
              <span className={proofText}>Text</span>
            </div>
            <div className={swatchGrid}>
              <div className={swatchCard}>
                <span
                  className={swatchChip}
                  style={{ backgroundColor: readPalette(palette, "color-bg-elevated") }}
                />
                Surface
              </div>
              <div className={swatchCard}>
                <span
                  className={swatchChip}
                  style={{ backgroundColor: readPalette(palette, "color-accent") }}
                />
                Accent
              </div>
              <div className={swatchCard}>
                <span
                  className={swatchChip}
                  style={{ backgroundColor: readPalette(palette, "color-success") }}
                />
                Success
              </div>
              <div className={swatchCard}>
                <span
                  className={swatchChip}
                  style={{ backgroundColor: readPalette(palette, "color-warn") }}
                />
                Warning
              </div>
              <div className={swatchCard}>
                <span
                  className={swatchChip}
                  style={{ backgroundColor: readPalette(palette, "color-border-strong") }}
                />
                Border
              </div>
            </div>
            <div className={stageFooter}>
              <span className={footPill}>theme fallback</span>
              <span className={footPill}>oklch palette</span>
              <span className={footPill}>runtime vars</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
