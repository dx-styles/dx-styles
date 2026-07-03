export interface StyleHandleRegistry<TStyle> {
  collectStyleHandleClassNames(parts: readonly unknown[]): string[];
  normalizeStyleParts(parts: readonly unknown[]): TStyle;
  registerStyle(className: string, style: TStyle): void;
  registerStyleHandleClassName(className: string): void;
}

interface StyleHandleRegistryOptions<TStyle> {
  cloneStyle(style: TStyle): TStyle;
  createEmptyStyle(): TStyle;
  normalizeStyleParts(
    parts: readonly unknown[],
    readToken: (token: string) => null | TStyle,
  ): TStyle;
  readCssDescriptorClassNameRefs(value: unknown): readonly string[];
  readStyleHandleClassName(value: unknown): null | string;
}

function splitClassNameTokens(className: string): string[] {
  return className.split(/\s+/u).filter((token) => token.length > 0);
}

export function normalizeStyleHandleClassName(className: string): string {
  const normalizedClassName = Array.from(new Set(splitClassNameTokens(className))).join(" ");
  if (normalizedClassName.length === 0) {
    throw new Error("dx-styles style handles require a non-empty class name.");
  }

  return normalizedClassName;
}

export function createStyleHandleRegistry<TStyle>(
  options: StyleHandleRegistryOptions<TStyle>,
): StyleHandleRegistry<TStyle> {
  const styleRegistry = new Map<string, TStyle>();
  const classRefRegistry = new Set<string>();

  function readRegisteredStyleToken(token: string): null | TStyle {
    if (classRefRegistry.has(token)) {
      return options.cloneStyle(styleRegistry.get(token) ?? options.createEmptyStyle());
    }

    const style = styleRegistry.get(token);
    return style === undefined ? null : options.cloneStyle(style);
  }

  function registerStyleHandleClassName(className: string): void {
    splitClassNameTokens(className).forEach((token) => {
      classRefRegistry.add(token);

      if (!styleRegistry.has(token)) {
        styleRegistry.set(token, options.createEmptyStyle());
      }
    });
  }

  return {
    collectStyleHandleClassNames(parts) {
      const seen = new Set<string>();

      parts.forEach((part) => {
        if (typeof part === "string") {
          splitClassNameTokens(part)
            .filter((token) => classRefRegistry.has(token))
            .forEach((token) => {
              seen.add(token);
            });
          return;
        }

        const descriptorClassNameRefs = options.readCssDescriptorClassNameRefs(part);
        if (descriptorClassNameRefs.length > 0) {
          descriptorClassNameRefs.forEach((className) => {
            registerStyleHandleClassName(className);
            seen.add(className);
          });
          return;
        }

        const className = options.readStyleHandleClassName(part);
        if (className === null) {
          return;
        }

        registerStyleHandleClassName(className);
        splitClassNameTokens(className).forEach((token) => {
          seen.add(token);
        });
      });

      return [...seen];
    },
    normalizeStyleParts(parts) {
      return options.normalizeStyleParts(parts, readRegisteredStyleToken);
    },
    registerStyle(className, style) {
      styleRegistry.set(className, options.cloneStyle(style));
    },
    registerStyleHandleClassName,
  };
}
