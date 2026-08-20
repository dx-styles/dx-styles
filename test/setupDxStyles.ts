import { mock } from "bun:test";

import {
  assignVars,
  createRecipeStyleHandles,
  createSlotRecipeStyleHandles,
  createStyleHandle,
  createTheme,
  createTokenContract,
  css,
  cx,
  keyframes,
  recipe,
  slotRecipe,
  splitRecipeProps,
  splitSlotRecipeProps,
} from "../src/test-support";

await mock.module("dx-styles", () => ({
  assignVars,
  createRecipeStyleHandles,
  createSlotRecipeStyleHandles,
  createStyleHandle,
  createTheme,
  createTokenContract,
  css,
  cx,
  keyframes,
  recipe,
  slotRecipe,
  splitRecipeProps,
  splitSlotRecipeProps,
}));
