import type { ReactNode } from "react";

import { card } from "./Card.styles";

export interface CardProps {
  readonly title: ReactNode;
  readonly description?: ReactNode;
  readonly children?: ReactNode;
  readonly footer?: ReactNode;
  readonly eyebrow?: ReactNode;
  readonly emphasis?: "flat" | "raised" | "accent";
}

export const Card = ({
  title,
  description,
  children,
  footer,
  eyebrow,
  emphasis = "flat",
}: CardProps): JSX.Element => {
  const slots = card({ emphasis });
  return (
    <div className={slots.root}>
      <div className={slots.header}>
        {eyebrow !== undefined ? <div>{eyebrow}</div> : null}
        <div className={slots.title}>{title}</div>
        {description !== undefined ? <p className={slots.description}>{description}</p> : null}
      </div>
      {children !== undefined ? <div className={slots.body}>{children}</div> : null}
      {footer !== undefined ? <div className={slots.footer}>{footer}</div> : null}
    </div>
  );
};
