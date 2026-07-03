import { CodeBlock } from "../components/CodeBlock";
import { Pill } from "../components/Pill";
import { Button, Checkbox } from "../spike/components";
import { container, eyebrow, section, sectionLead, sectionTitle } from "../styles/layout";
import { callout, calloutLabel, groupLabel, row, showcase, stage } from "./LiveDemo.styles";

const SOURCE_SNIPPET = `import { recipe } from "dx-styles";

import { siteTokens } from "../theme";

export const buttonRoot = recipe({
  base: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  variants: {
    size: {
      small:  { minHeight: "24px", paddingInline: "8px"  },
      medium: { minHeight: "32px", paddingInline: "12px" },
      large:  { minHeight: "40px", paddingInline: "16px" },
    },
    styleMode: {
      contained: { backgroundColor: siteTokens["color-accent-strong"] },
      outline:   { backgroundColor: "transparent" },
      text:      { backgroundColor: "transparent" },
    },
  },
});`;

export const LiveDemo = (): JSX.Element => {
  return (
    <section className={section({ tone: "muted" })} id="live-demo">
      <div className={container}>
        <div className={eyebrow}>Live demo</div>
        <h2 className={sectionTitle}>The same recipe, every component below.</h2>
        <p className={sectionLead}>
          These site-local spike components are rendered with the recipes you see on the right. No
          runtime style insertion: open the network tab and the CSS arrived as a static asset.
        </p>
        <div className={stage}>
          <div className={showcase}>
            <div>
              <div className={groupLabel}>Button · styleMode</div>
              <div className={row} style={{ marginTop: 12 }}>
                <Button text="Contained" styleMode="contained" />
                <Button text="Outline" styleMode="outline" />
                <Button text="Text" styleMode="text" />
              </div>
            </div>
            <div>
              <div className={groupLabel}>Button · size</div>
              <div className={row} style={{ marginTop: 12 }}>
                <Button text="Small" size="small" />
                <Button text="Medium" size="medium" />
                <Button text="Large" size="large" />
              </div>
            </div>
            <div>
              <div className={groupLabel}>Checkbox · appearance</div>
              <div className={row} style={{ marginTop: 12 }}>
                <Checkbox label="Default · unchecked" />
                <Checkbox label="Default · checked" defaultChecked />
                <Checkbox label="Indeterminate" indeterminate />
              </div>
            </div>
            <div className={callout}>
              <span className={calloutLabel}>What you&apos;re seeing</span>
              Every variant on this page is a precompiled class. The component just selects between
              them — there is no style object passed at runtime, no provider in the tree.
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Pill tone="accent">From apps/site/src/spike/components/Button.styles.ts</Pill>
            <CodeBlock filename="Button.styles.ts" language="ts">
              {SOURCE_SNIPPET}
            </CodeBlock>
          </div>
        </div>
      </div>
    </section>
  );
};
