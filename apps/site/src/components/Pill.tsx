import type { ReactNode } from "react";

import { pill } from "./Pill.styles";

export interface PillProps {
  readonly children: ReactNode;
  readonly tone?: "neutral" | "accent" | "success";
}

export const Pill = ({ children, tone = "neutral" }: PillProps): JSX.Element => {
  return <span className={pill({ tone })}>{children}</span>;
};
