import { useState } from "react";

import { cx } from "dx-styles";

import { button, card, note, page, row, title } from "./styles";
import { darkTheme, lightTheme } from "./theme";

export const App = () => {
  const [mode, setMode] = useState<"dark" | "light">("dark");
  const theme = mode === "dark" ? darkTheme : lightTheme;

  return (
    <div className={cx(page, theme)}>
      <div className={card}>
        <h1 className={title}>dx-styles starter</h1>
        <p className={note}>
          Every style on this page was extracted to a static CSS file at build time. Switching the
          theme swaps one class — no style runtime ships to the browser.
        </p>
        <div className={row}>
          <button className={button()}>Primary action</button>
          <button
            className={button({ appearance: "ghost" })}
            onClick={() => setMode(mode === "dark" ? "light" : "dark")}
          >
            Switch to {mode === "dark" ? "light" : "dark"}
          </button>
        </div>
      </div>
    </div>
  );
};
