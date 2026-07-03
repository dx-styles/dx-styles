import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, test } from "bun:test";

import { ApiShowcase } from "./ApiShowcase";

const getPanels = (container: HTMLElement): NodeListOf<HTMLElement> =>
  container.querySelectorAll<HTMLElement>("#api [role='tabpanel']");

const getVisiblePanels = (container: HTMLElement): NodeListOf<HTMLElement> =>
  container.querySelectorAll<HTMLElement>("#api [role='tabpanel']:not([hidden])");

const getHiddenPanels = (container: HTMLElement): NodeListOf<HTMLElement> =>
  container.querySelectorAll<HTMLElement>("#api [role='tabpanel'][hidden]");

describe("ApiShowcase", () => {
  afterEach(() => {
    cleanup();
  });

  test("keeps exactly one tab panel visible when switching APIs", () => {
    const { container, getByRole } = render(<ApiShowcase />);

    expect(getPanels(container)).toHaveLength(5);
    expect(getVisiblePanels(container)).toHaveLength(1);
    expect(getHiddenPanels(container)).toHaveLength(4);
    expect(getVisiblePanels(container)[0].id).toBe("api-showcase-panel-css");

    fireEvent.click(getByRole("tab", { name: "slotRecipe()" }));

    expect(getVisiblePanels(container)).toHaveLength(1);
    expect(getHiddenPanels(container)).toHaveLength(4);
    expect(getVisiblePanels(container)[0].id).toBe("api-showcase-panel-slotRecipe");
  });
});
