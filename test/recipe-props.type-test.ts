import type { ComponentPropsWithRef } from "react";

import {
  type RecipeVariantProps,
  recipe,
  slotRecipe,
  splitRecipeProps,
  splitSlotRecipeProps,
} from "dx-styles";

function expectType<TValue>(value: TValue): TValue {
  return value;
}

const button = recipe({
  variants: {
    appearance: {
      ghost: { color: "blue" },
      primary: { color: "white" },
    },
    size: {
      large: { minHeight: 40 },
      small: { minHeight: 28 },
    },
  },
});

type ButtonVariantProps = RecipeVariantProps<typeof button>;
type ButtonProps = ButtonVariantProps &
  Omit<ComponentPropsWithRef<"button">, keyof ButtonVariantProps>;

const buttonProps: ButtonProps = {
  appearance: "primary",
  children: "Save",
  onClick: () => undefined,
  size: "small",
  type: "button",
};
const splitButtonProps = splitRecipeProps(button, buttonProps);
const splitButtonPropsWithoutVariants = splitRecipeProps(button, { id: "plain" });

expectType<"ghost" | "primary" | undefined>(splitButtonProps.variantProps.appearance);
expectType<"large" | "small" | undefined>(splitButtonProps.variantProps.size);
expectType<"button" | "reset" | "submit" | undefined>(splitButtonProps.otherProps.type);
expectType<ComponentPropsWithRef<"button">["onClick"]>(splitButtonProps.otherProps.onClick);
expectType<string>(splitButtonPropsWithoutVariants.otherProps.id);

// @ts-expect-error Variant props are removed from the remaining component props.
expectType(splitButtonProps.otherProps.appearance);

// @ts-expect-error Recipe variants only accept declared values.
splitRecipeProps(button, { appearance: "outline" });

const toggle = recipe({
  compoundVariants: [
    {
      checked: true,
      css: { fontWeight: 700 },
    },
  ],
  defaultVariants: {
    checked: false,
  },
  variants: {
    checked: {
      true: { color: "green" },
    },
  },
});
type ToggleVariantProps = RecipeVariantProps<typeof toggle>;
const toggleProps: ToggleVariantProps = { checked: true };
const splitToggleProps = splitRecipeProps(toggle, toggleProps);

toggle({ checked: false });
toggle({ checked: "true" });
expectType<boolean | "true" | undefined>(splitToggleProps.variantProps.checked);

// @ts-expect-error Boolean recipe axes continue to reject undeclared string values.
toggle({ checked: "false" });

const field = slotRecipe({
  slots: ["root", "control"] as const,
  variants: {
    density: {
      compact: { control: { minHeight: 28 } },
      comfortable: { control: { minHeight: 36 } },
    },
  },
});
type FieldVariantProps = RecipeVariantProps<typeof field>;
const fieldProps: FieldVariantProps & { readonly id: string } = {
  density: "compact",
  id: "email",
};
const splitFieldProps = splitSlotRecipeProps(field, fieldProps);

expectType<"compact" | "comfortable" | undefined>(splitFieldProps.variantProps.density);
expectType<string>(splitFieldProps.otherProps.id);

// @ts-expect-error Slot recipe variants are removed from the remaining component props.
expectType(splitFieldProps.otherProps.density);

const switchField = slotRecipe({
  slots: ["root"] as const,
  variants: {
    checked: {
      false: { root: { color: "gray" } },
      true: { root: { color: "green" } },
    },
  },
});
type SwitchFieldVariantProps = RecipeVariantProps<typeof switchField>;

expectType<boolean | "false" | "true" | undefined>(
  expectType<SwitchFieldVariantProps>({ checked: false }).checked,
);
switchField({ checked: true });
switchField({ checked: "false" });
