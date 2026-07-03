import { type CSSProperties, type JSX, useState } from "react";

import { CodeBlock } from "../components/CodeBlock";
import { Tabs } from "../components/Tabs";
import { container, eyebrow, section, sectionLead, sectionTitle } from "../styles/layout";
import {
  apiName,
  codeStack,
  codeStep,
  codeStepBullet,
  layout,
  summary,
} from "./ApiShowcase.styles";

type ApiKey = "css" | "recipe" | "slotRecipe" | "createTheme" | "assignVars";

interface ApiTab {
  readonly value: ApiKey;
  readonly label: string;
  readonly summary: string;
  readonly definition: { readonly filename: string; readonly snippet: string };
  readonly usage: { readonly filename: string; readonly snippet: string };
}

const getApiTabId = (value: ApiKey): string => `api-showcase-tab-${value}`;
const getApiPanelId = (value: ApiKey): string => `api-showcase-panel-${value}`;

const getApiPanelStyle = (active: boolean): CSSProperties => ({
  display: active ? undefined : "none",
});

const tabs: readonly ApiTab[] = [
  {
    value: "css",
    label: "css()",
    summary:
      "Compose deterministic class names from style objects. Inputs are previously declared css() results, plain style objects, or public StyleHandle values.",
    definition: {
      filename: "Button.tsx — colocated",
      snippet: `import { css } from "dx-styles";

const base = css({
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
});

export const button = css(base, {
  minHeight: "32px",
  paddingInline: "12px",
  borderRadius: "999px",
});`,
    },
    usage: {
      filename: "Button.tsx — JSX",
      snippet: `export const Button = (props: ButtonProps) => (
  <button className={button} {...props} />
);`,
    },
  },
  {
    value: "recipe",
    label: "recipe()",
    summary:
      "Variant-driven runtime selector over statically compiled class groups. Default variants resolve at the call site without bundle-time conditionals.",
    definition: {
      filename: "Button.tsx — colocated",
      snippet: `import { recipe } from "dx-styles";

export const button = recipe({
  base: { display: "inline-flex", alignItems: "center" },
  variants: {
    appearance: {
      primary: { backgroundColor: "var(--button-bg-primary)" },
      secondary: { backgroundColor: "var(--button-bg-secondary)" },
    },
    size: {
      sm: { minHeight: "28px", paddingInline: "10px" },
      md: { minHeight: "32px", paddingInline: "12px" },
    },
  },
  defaultVariants: { appearance: "primary", size: "md" },
});`,
    },
    usage: {
      filename: "Button.tsx — JSX",
      snippet: `export const Button = ({ appearance, size, ...rest }: ButtonProps) => (
  <button className={button({ appearance, size })} {...rest} />
);

// renders class "button_root primary md"
<Button appearance="secondary" size="sm" />;`,
    },
  },
  {
    value: "slotRecipe",
    label: "slotRecipe()",
    summary:
      "Multipart variant selector. Every slot is declared up front; each variant value updates the relevant slots only. Returns an object keyed by the declared slots.",
    definition: {
      filename: "popover.styles.ts",
      snippet: `import { slotRecipe } from "dx-styles";

export const popover = slotRecipe({
  slots: ["root", "content", "arrow"] as const,
  base: {
    root: { position: "relative" },
    content: { borderRadius: "12px", padding: "12px" },
    arrow: { position: "absolute" },
  },
  variants: {
    tone: {
      neutral: { content: { backgroundColor: "var(--popover-bg)" } },
      danger:  { content: { backgroundColor: "var(--popover-bg-danger)" } },
    },
  },
  defaultVariants: { tone: "neutral" },
});`,
    },
    usage: {
      filename: "Popover.tsx — JSX",
      snippet: `import { popover } from "./popover.styles";

export const Popover = ({ tone, children }: PopoverProps) => {
  const slots = popover({ tone });
  return (
    <div className={slots.root}>
      <div className={slots.content}>{children}</div>
      <span className={slots.arrow} aria-hidden />
    </div>
  );
};`,
    },
  },
  {
    value: "createTheme",
    label: "createTheme()",
    summary:
      "Token contracts produce stable CSS variable names. createTheme() emits a single themed class — apply it once at the root, swap themes by toggling classes, or scope per-subtree.",
    definition: {
      filename: "button-theme.ts",
      snippet: `import {
  createTheme,
  createTokenContract,
} from "dx-styles";

export const buttonTokens = createTokenContract(
  { background: null, foreground: null, focus: null },
  { prefix: "button" },
);

export const buttonTheme = createTheme(buttonTokens, {
  background: "#0057ff",
  foreground: "#ffffff",
  focus: "#7aa2ff",
});`,
    },
    usage: {
      filename: "ThemeProvider.tsx — JSX",
      snippet: `import { buttonTheme } from "./button-theme";

export const ThemedSection = ({ children }: Props) => (
  <section className={buttonTheme}>
    {/* every nested .button reads var(--button-background) */}
    {children}
  </section>
);`,
    },
  },
  {
    value: "assignVars",
    label: "assignVars()",
    summary:
      "The runtime escape hatch for dynamic values. assignVars() returns inline style props bound to a token contract — typed, scoped to a subtree, and free of generated CSS rules.",
    definition: {
      filename: "grid-layout.ts",
      snippet: `import {
  assignVars,
  createTokenContract,
} from "dx-styles";

export const layoutVars = createTokenContract(
  { rowHeight: null, columnWidth: null },
  { prefix: "grid-layout" },
);

export const layoutInline = (height: string, width: string) =>
  assignVars(layoutVars, {
    rowHeight: height,
    columnWidth: width,
  });`,
    },
    usage: {
      filename: "Grid.tsx — JSX",
      snippet: `import { layoutInline } from "./grid-layout";

export const Grid = ({ rowHeight, columnWidth, children }: Props) => (
  // dynamic dimensions cross the boundary as variables, not new rules.
  <div style={layoutInline(rowHeight, columnWidth)}>
    {children}
  </div>
);

// no new CSS — just two custom-property assignments on the element.`,
    },
  },
];

export const ApiShowcase = (): JSX.Element => {
  const [active, setActive] = useState<ApiKey>(tabs[0].value);

  return (
    <section className={section({ tone: "base" })} id="api">
      <div className={container}>
        <div className={eyebrow}>The API</div>
        <h2 className={sectionTitle}>Five primitives. Everything you need for a design system.</h2>
        <p className={sectionLead}>
          Authoring stays in TypeScript. Composition is statically analyzable. Tab through the
          tagged APIs that participate in extraction — <code>css</code>, <code>recipe</code>,{" "}
          <code>slotRecipe</code>, <code>createTheme</code> — plus the runtime boundary{" "}
          <code>assignVars</code>. Each tab shows the declaration and the JSX that consumes it.
        </p>
        <div style={{ marginTop: 32 }}>
          <Tabs<ApiKey>
            tabs={tabs.map((t) => ({
              value: t.value,
              label: t.label,
              id: getApiTabId(t.value),
              panelId: getApiPanelId(t.value),
            }))}
            value={active}
            onChange={setActive}
            ariaLabel="dx-styles APIs"
          />
        </div>
        {tabs.map((current) => {
          const activePanel = current.value === active;
          return (
            <div
              key={current.value}
              id={getApiPanelId(current.value)}
              className={layout}
              role="tabpanel"
              aria-labelledby={getApiTabId(current.value)}
              tabIndex={activePanel ? 0 : -1}
              hidden={!activePanel}
              style={getApiPanelStyle(activePanel)}
            >
              <div>
                <div className={apiName}>{current.label}</div>
                <p className={summary}>{current.summary}</p>
              </div>
              <div className={codeStack}>
                <div className={codeStep}>
                  <span className={codeStepBullet}>1</span>
                  Declare
                </div>
                <CodeBlock language="ts" filename={current.definition.filename}>
                  {current.definition.snippet}
                </CodeBlock>
                <div className={codeStep}>
                  <span className={codeStepBullet}>2</span>
                  Consume
                </div>
                <CodeBlock language="tsx" filename={current.usage.filename}>
                  {current.usage.snippet}
                </CodeBlock>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
