import { cx } from "dx-styles";
import type { ChangeEvent, InputHTMLAttributes } from "react";
import { useId, useState } from "react";

import { checkbox } from "./Checkbox.styles";

export interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "children" | "className" | "type"> {
  readonly className?: string;
  readonly indeterminate?: boolean;
  readonly label: string;
}

export const Checkbox = ({
  checked,
  className,
  defaultChecked = false,
  disabled,
  id,
  indeterminate = false,
  label,
  onChange,
  ...props
}: CheckboxProps): JSX.Element => {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [uncontrolledChecked, setUncontrolledChecked] = useState(Boolean(defaultChecked));
  const resolvedChecked = checked ?? uncontrolledChecked;
  const slots = checkbox({
    checked: resolvedChecked ? "true" : "false",
    indeterminate: indeterminate ? "true" : "false",
  });

  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    if (checked === undefined) {
      setUncontrolledChecked(event.currentTarget.checked);
    }
    onChange?.(event);
  };

  return (
    <label className={cx(slots.root, className)} htmlFor={inputId}>
      <input
        {...props}
        checked={resolvedChecked}
        className={slots.input}
        disabled={disabled}
        id={inputId}
        onChange={handleChange}
        ref={(input) => {
          if (input !== null) {
            input.indeterminate = indeterminate;
          }
        }}
        type="checkbox"
      />
      <span className={slots.control} aria-hidden="true">
        <span className={slots.indicator} />
      </span>
      <span className={slots.label}>{label}</span>
    </label>
  );
};
