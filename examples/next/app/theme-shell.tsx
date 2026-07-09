"use client";

import { useState } from "react";
import type { ReactNode } from "react";

import { cx } from "dx-styles";

import { button, card, page, row } from "./styles";
import { darkTheme, lightTheme } from "./theme";

export const ThemeShell = ({ children }: { children: ReactNode }) => {
  const [mode, setMode] = useState<"dark" | "light">("dark");
  const theme = mode === "dark" ? darkTheme : lightTheme;

  return (
    <div className={cx(page, theme)}>
      <div className={card}>
        {children}
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
