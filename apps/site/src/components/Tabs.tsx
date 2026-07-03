import { type JSX, type KeyboardEvent, type ReactNode, useRef } from "react";

import { tab, tabList } from "./Tabs.styles";

export interface TabDescriptor<TValue extends string> {
  readonly value: TValue;
  readonly label: ReactNode;
  readonly id?: string;
  readonly panelId?: string;
}

export interface TabsProps<TValue extends string> {
  readonly tabs: readonly TabDescriptor<TValue>[];
  readonly value: TValue;
  readonly onChange: (next: TValue) => void;
  readonly ariaLabel?: string;
}

export const Tabs = <TValue extends string>({
  tabs,
  value,
  onChange,
  ariaLabel,
}: TabsProps<TValue>): JSX.Element => {
  const buttonRefs = useRef(new Map<TValue, HTMLButtonElement>());
  const activeIndex = tabs.findIndex((descriptor) => descriptor.value === value);

  const focusTab = (next: TValue): void => {
    onChange(next);
    queueMicrotask(() => {
      buttonRefs.current.get(next)?.focus();
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (tabs.length === 0) {
      return;
    }
    const lastIndex = tabs.length - 1;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      const nextIndex = activeIndex >= lastIndex ? 0 : activeIndex + 1;
      focusTab(tabs[nextIndex].value);
      return;
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      const nextIndex = activeIndex <= 0 ? lastIndex : activeIndex - 1;
      focusTab(tabs[nextIndex].value);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      focusTab(tabs[0].value);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      focusTab(tabs[lastIndex].value);
    }
  };

  return (
    <div
      className={tabList}
      role="tablist"
      aria-label={ariaLabel}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
    >
      {tabs.map((descriptor) => {
        const active = descriptor.value === value;
        return (
          <button
            key={descriptor.value}
            id={descriptor.id}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={descriptor.panelId}
            tabIndex={active ? 0 : -1}
            ref={(element) => {
              if (element === null) {
                buttonRefs.current.delete(descriptor.value);
                return;
              }
              buttonRefs.current.set(descriptor.value, element);
            }}
            className={tab({ active: active ? "yes" : "no" })}
            onClick={() => {
              onChange(descriptor.value);
            }}
          >
            {descriptor.label}
          </button>
        );
      })}
    </div>
  );
};
