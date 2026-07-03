import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test } from "bun:test";

import { App } from "./App";

describe("App runtime theme", () => {
  afterEach(() => {
    cleanup();
    document.documentElement.removeAttribute("style");
  });

  test("updates root site token variables when the base color changes", async () => {
    document.documentElement.style.setProperty("--dx-site-color-accent", "hotpink");

    const { getByLabelText, unmount } = render(<App />);
    const colorInput = getByLabelText("Base theme color");

    await waitFor(() => {
      expect(document.documentElement.style.getPropertyValue("--dx-site-color-accent")).toBe(
        "oklch(0.681 0.169 275)",
      );
    });

    fireEvent.input(colorInput, { target: { value: "#00aa66" } });

    await waitFor(() => {
      expect(document.documentElement.style.getPropertyValue("--dx-site-color-accent")).toBe(
        "oklch(0.649 0.156 156.5)",
      );
      expect(document.documentElement.style.getPropertyValue("--dx-site-color-bg")).toBe(
        "oklch(0.126 0.024 156.5)",
      );
    });

    unmount();

    expect(document.documentElement.style.getPropertyValue("--dx-site-color-accent")).toBe(
      "hotpink",
    );
    expect(document.documentElement.style.getPropertyValue("--dx-site-color-bg")).toBe("");
  });
});
