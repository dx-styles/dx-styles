export const DX_STYLES_DESCRIPTOR_KEY = "__dxStyles";
export const STYLE_HANDLE_DESCRIPTOR_KIND = "styleHandle";

// The shape of an atom class name of the atomic output model,
// `dx-<property code><condition code>_<value code>`. It is a contract shared by
// every package built with dx-styles: it changes only in a major release.
export const ATOM_CLASS_NAME_PATTERN =
  /^dx-((?:[0-9a-y][0-9a-z]|z[0-9a-z]{7})(?:[0-9a-z]{7})?)_[0-9a-z]{8}$/u;

function readAtomKey(token: string): null | string {
  return ATOM_CLASS_NAME_PATTERN.exec(token)?.[1] ?? null;
}

/**
 * Joins class names: the last atom of a key wins, other classes keep their
 * first place and drop their repeats. `cx` at runtime and the build share it.
 */
export function composeAtomicClassNames(
  ...classNames: readonly (false | null | string | undefined)[]
): string {
  const tokens = classNames.flatMap((token) =>
    typeof token === "string"
      ? token.split(/\s+/u).filter((className) => className.length > 0)
      : [],
  );
  const lastAtomIndexByKey = new Map<string, number>();

  tokens.forEach((token, index) => {
    const key = readAtomKey(token);

    if (key !== null) {
      lastAtomIndexByKey.set(key, index);
    }
  });

  const seen = new Set<string>();

  return tokens
    .filter((token, index) => {
      const key = readAtomKey(token);

      if (key !== null) {
        return lastAtomIndexByKey.get(key) === index;
      }

      if (seen.has(token)) {
        return false;
      }

      seen.add(token);
      return true;
    })
    .join(" ");
}
