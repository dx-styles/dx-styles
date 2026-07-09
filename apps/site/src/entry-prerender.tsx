import { StrictMode } from "react";
import { renderToString } from "react-dom/server";

import { App } from "./App";
import { siteTheme } from "./spike/theme";
import { siteResetCss } from "./styles/global";

export function render(): string {
  return renderToString(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

export { siteResetCss, siteTheme };
