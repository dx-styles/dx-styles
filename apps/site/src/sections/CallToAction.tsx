import { CodeBlock } from "../components/CodeBlock";
import { container, section } from "../styles/layout";
import { cta, ctaLead, ctaTitle, footer, inlineLink, link, linkRow } from "./CallToAction.styles";

const INSTALL_SNIPPET = `bun add dx-styles

// Pick the WyW-in-JS plugin for your bundler:
//   @wyw-in-js/vite      @wyw-in-js/webpack
//   @wyw-in-js/rollup    @wyw-in-js/esbuild
//   @wyw-in-js/next
bun add -d @wyw-in-js/vite @babel/preset-typescript

// vite.config.ts - same options across plugins
import wyw from "@wyw-in-js/vite";
export default {
  plugins: [
    wyw({ babelOptions: { presets: ["@babel/preset-typescript"] } }),
  ],
};

// Component.tsx - inline or in a colocated *.styles.ts
import { recipe } from "dx-styles";`;

export const CallToAction = (): JSX.Element => {
  return (
    <section className={section({ tone: "base" })} id="get-started">
      <div className={container}>
        <div className={cta}>
          <div>
            <h2 className={ctaTitle}>Wire the extractor once. Author the rest as TypeScript.</h2>
            <p className={ctaLead}>
              Add the package, drop the matching <code>@wyw-in-js/*</code> plugin into your bundler
              (Vite, webpack, Rollup, esbuild, Next; see the{" "}
              <a
                className={inlineLink}
                href="https://wyw-in-js.dev/bundlers"
                target="_blank"
                rel="noreferrer"
              >
                WyW-in-JS bundler guide
              </a>
              ), and start authoring. Tokens, themes, and RTL rules stay in TypeScript modules and
              compile into static CSS artifacts.
            </p>
            <div className={linkRow}>
              <a className={link({ intent: "primary" })} href="#api">
                Read the docs
              </a>
              <a
                className={link({ intent: "ghost" })}
                href="https://wyw-in-js.dev/bundlers"
                target="_blank"
                rel="noreferrer"
              >
                Bundler integration
              </a>
              <a
                className={link({ intent: "ghost" })}
                href="https://github.com/dx-styles/dx-styles"
                target="_blank"
                rel="noreferrer"
              >
                View on GitHub
              </a>
            </div>
          </div>
          <CodeBlock language="ts" filename="setup">
            {INSTALL_SNIPPET}
          </CodeBlock>
        </div>
        <div className={footer}>
          <span>
            <strong>dx-styles</strong> · compiler-backed CSS for TypeScript.
          </span>
          <span>Statically extracted. Framework-agnostic. RTL-aware.</span>
        </div>
      </div>
    </section>
  );
};
