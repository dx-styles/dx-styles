import { cx } from "dx-styles";
import type { ButtonHTMLAttributes } from "react";

import { button } from "./Button.styles";

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "className"> {
  readonly className?: string;
  readonly size?: "small" | "medium" | "large";
  readonly styleMode?: "contained" | "outline" | "text";
  readonly text: string;
}

export const Button = ({
  className,
  size = "medium",
  styleMode = "contained",
  text,
  type = "button",
  ...props
}: ButtonProps): JSX.Element => {
  return (
    <button className={cx(button({ size, styleMode }), className)} type={type} {...props}>
      {text}
    </button>
  );
};
