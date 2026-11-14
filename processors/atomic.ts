/**
 * The atomizer of the atomic output model: one style becomes one shared class,
 * an atom, per declaration.
 *
 * The nested CSS of a style is laid out with `compile` from stylis, the layout
 * the WyW extractor uses, so the declarations come in the order the semantic
 * model emits them. Each declaration becomes an ordinary WyW rule keyed by its
 * atom selector, so the WyW preprocessor (stylis) prefixes it and rewrites its
 * relative `url()` exactly as it does in the semantic model.
 */
import { createHash } from "node:crypto";

import type { ICSSRule } from "@wyw-in-js/shared";
import { compile, type Element, KEYFRAMES, RULESET, serialize, stringify, tokenize } from "stylis";

import {
  type CascadeDeclaration,
  isConditionalAtRule,
  readAtomRepeatCount,
  readSelectorSpecificity,
} from "./atomic-cascade.js";
import { readPropertyCode } from "./atomic-properties.js";

type SourceLocation = {
  readonly start?: ICSSRule["start"];
} | null;

export interface AtomizeStyleInput {
  /** The class of the style in the semantic model: its label, anchor and keyframes scope. */
  readonly className: string;
  /** Nested CSS text of the style (`toCSSStyle`). */
  readonly cssText: string;
  readonly displayName: string;
  readonly location: SourceLocation;
  /** Directory of the module, part of the value code of a relative `url()`. */
  readonly moduleDirectory: string;
  /** Where the style comes from, for error messages. */
  readonly place: string;
}

export interface AtomizedStyle {
  /** Atom class names in the order of the declarations. */
  readonly atoms: readonly string[];
  readonly declarations: readonly CascadeDeclaration[];
  /** Whether a selector of the style references its class (`& + &`). */
  readonly needsStyleClass: boolean;
  readonly rules: Record<string, ICSSRule>;
}

interface RegisteredAtom {
  readonly body: string;
  readonly declarations: readonly CascadeDeclaration[];
}

// The atoms of the build process (D-41g3): a name with another body, or a code
// with another property or condition, is a hash collision and fails the build.
const atomRegistry = new Map<string, RegisteredAtom>();
const keyCodeRegistry = new Map<string, string>();

const BASE36_DIGITS = "0123456789abcdefghijklmnopqrstuvwxyz";
const CONDITION_CODE_WIDTH = 7;
const PROPERTY_HASH_WIDTH = 7;
const VALUE_CODE_WIDTH = 8;
const RELATIVE_URL_PATTERN = /\burl\((["']?)\.[^)]+?\1\)/u;
const IMPORTANT_PATTERN = /!\s*important\s*$/iu;
const ANIMATION_PROPERTIES = new Set(
  ["", "-webkit-", "-moz-", "-ms-", "-o-"].flatMap((prefix) => [
    `${prefix}animation`,
    `${prefix}animation-name`,
  ]),
);
const UNSUPPORTED_AT_RULES = new Set(["@layer", "@scope"]);

/** The shape of an atom class name; a contract between packages built with dx-styles. */
export const ATOM_CLASS_NAME_PATTERN =
  /^dx-((?:[0-9a-y][0-9a-z]|z[0-9a-z]{7})(?:[0-9a-z]{7})?)_[0-9a-z]{8}$/u;

function hashToBase36(source: string, width: number): string {
  const digest = createHash("sha256").update(source).digest();
  let value = digest.readBigUInt64BE(0) % 36n ** BigInt(width);
  let code = "";

  for (let index = 0; index < width; index += 1) {
    code = `${BASE36_DIGITS[Number(value % 36n)]}${code}`;
    value /= 36n;
  }

  return code;
}

let atomHash: (source: string, width: number) => string = hashToBase36;

/**
 * Replaces the hash of atom codes for the duration of `run`. Tests use it to
 * force a collision; the build never calls it.
 */
export function withAtomHashForTesting<TResult>(
  hash: (source: string, width: number) => string,
  run: () => TResult,
): TResult {
  const previous = atomHash;
  atomHash = hash;

  try {
    return run();
  } finally {
    atomHash = previous;
  }
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[$()*+.?[\\\]^{|}]/gu, "\\$&");
}

function registerKeyCode(code: string, meaning: string, kind: string): void {
  const existing = keyCodeRegistry.get(code);

  if (existing !== undefined && existing !== meaning) {
    throw new Error(
      `dx-styles atomic output: the ${kind} code "${code}" stands for both ${existing} and ${meaning}. This is a hash collision; rename or reword one of them.`,
    );
  }

  keyCodeRegistry.set(code, meaning);
}

function readPropertyKeyCode(property: string): string {
  const tableCode = readPropertyCode(property);

  if (tableCode !== null) {
    return tableCode;
  }

  const code = `z${atomHash(`property\u0000${property}`, PROPERTY_HASH_WIDTH)}`;
  registerKeyCode(code, `property "${property}"`, "property");
  return code;
}

function readConditionKeyCode(atRules: readonly string[], selectors: readonly string[]): string {
  if (atRules.length === 0 && selectors.length === 1 && selectors[0] === "&") {
    return "";
  }

  const condition = JSON.stringify([atRules, selectors]);
  const code = atomHash(`condition\u0000${condition}`, CONDITION_CODE_WIDTH);
  registerKeyCode(`c${code}`, `condition ${condition}`, "condition");
  return code;
}

function registerAtom(name: string, atom: RegisteredAtom, place: string): void {
  const existing = atomRegistry.get(name);

  if (existing !== undefined && existing.body !== atom.body) {
    throw new Error(
      `dx-styles atomic output: ${place} produces the atom "${name}" for "${atom.body}", but the build already has it for "${existing.body}". This is a hash collision; change one of the declarations (for example the order of the values of a shorthand).`,
    );
  }

  atomRegistry.set(name, atom);
}

/** The declarations of known atoms, for the order check of style handles. */
export function readRegisteredAtomDeclarations(name: string): null | readonly CascadeDeclaration[] {
  return atomRegistry.get(name)?.declarations ?? null;
}

export function isAtomClassName(token: string): boolean {
  return ATOM_CLASS_NAME_PATTERN.test(token);
}

export function readAtomKey(token: string): null | string {
  return ATOM_CLASS_NAME_PATTERN.exec(token)?.[1] ?? null;
}

/** Composes class names the way `cx` does: the last atom of a key wins. */
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

interface DeclarationGroup {
  readonly atRules: readonly string[];
  readonly property: string;
  readonly selectors: readonly string[];
  readonly values: string[];
}

function collectDeclarationGroups(
  elements: readonly Element[],
  atRules: readonly string[],
  place: string,
  groups: DeclarationGroup[],
  passthrough: Element[],
): void {
  elements.forEach((element) => {
    if (element.type === RULESET) {
      let current: DeclarationGroup | null = null;

      (element.children as Element[]).forEach((child) => {
        if (child.type !== "decl" || typeof child.children !== "string") {
          return;
        }

        const property = String(child.props).toLowerCase();
        const value = child.children;

        if (current?.property === property) {
          current.values.push(value);
          return;
        }

        current = {
          atRules,
          property,
          selectors: element.props as string[],
          values: [value],
        };
        groups.push(current);
      });
      return;
    }

    if (element.type === "comm") {
      return;
    }

    const atRuleName = element.type.toLowerCase();

    if (UNSUPPORTED_AT_RULES.has(atRuleName)) {
      throw new Error(
        `dx-styles atomic output: ${place} uses "${normalizeWhitespace(element.value)}". The atomic output cannot express ${atRuleName} inside a style object, because atoms are shared between styles. Move this rule to a regular stylesheet, or build with output: "semantic".`,
      );
    }

    if (element.type !== KEYFRAMES && isConditionalAtRule(atRuleName)) {
      collectDeclarationGroups(
        element.children as Element[],
        [...atRules, normalizeWhitespace(element.value)],
        place,
        groups,
        passthrough,
      );
      return;
    }

    passthrough.push(element);
  });
}

function readScopedKeyframes(elements: readonly Element[]): Set<string> {
  return new Set(
    elements
      .filter((element) => element.type === KEYFRAMES)
      .map((element) => String((element.props as string[])[0] ?? ""))
      .filter((name) => name.length > 0 && !name.startsWith(":global(")),
  );
}

function scopeAnimationReferences(
  value: string,
  keyframes: ReadonlySet<string>,
  suffix: string,
): string {
  if (keyframes.size === 0) {
    return value;
  }

  return tokenize(value)
    .map((token) => (keyframes.has(token) ? `${token}-${suffix}` : token))
    .join("");
}

function toRelativeSelector(selector: string, className: string): readonly [string, boolean] {
  const pattern = new RegExp(`\\.${escapeRegExp(className)}(?![\\w-])`, "gu");
  const matches = [...selector.matchAll(pattern)];
  const last = matches[matches.length - 1];

  if (last === undefined) {
    throw new Error(
      `dx-styles atomic output cannot place the selector "${selector}" relative to its style.`,
    );
  }

  const index = last.index;
  const relative = `${selector.slice(0, index)}&${selector.slice(index + last[0].length)}`;
  return [normalizeWhitespace(relative), matches.length > 1];
}

function wrapInAtRules(atRules: readonly string[], cssText: string): string {
  return atRules.reduceRight((inner, atRule) => `${atRule}{${inner}}`, cssText);
}

/** Turns one style into atoms: their rules, names and declarations for the order check. */
export function atomizeStyle(input: AtomizeStyleInput): AtomizedStyle {
  const elements = compile(`.${input.className}{${input.cssText}}`);
  const groups: DeclarationGroup[] = [];
  const passthrough: Element[] = [];
  collectDeclarationGroups(elements, [], input.place, groups, passthrough);

  const keyframes = readScopedKeyframes(passthrough);
  const keyframesSuffix = input.className.replace(/[^a-zA-Z0-9_-]/gu, "");
  const rules: Record<string, ICSSRule> = {};
  const atoms: string[] = [];
  const declarations: CascadeDeclaration[] = [];
  let needsStyleClass = false;

  groups.forEach((group) => {
    const relativeSelectors = group.selectors.map((selector) => {
      const [relative, referencesStyleClass] = toRelativeSelector(selector, input.className);
      needsStyleClass ||= referencesStyleClass;
      return relative;
    });
    const values = ANIMATION_PROPERTIES.has(group.property)
      ? group.values.map((value) => scopeAnimationReferences(value, keyframes, keyframesSuffix))
      : group.values;
    const relativeUrlScope = values.some((value) => RELATIVE_URL_PATTERN.test(value))
      ? input.moduleDirectory
      : "";
    const valueCode = atomHash(
      `value\u0000${JSON.stringify([values, relativeUrlScope])}`,
      VALUE_CODE_WIDTH,
    );
    const key = `${readPropertyKeyCode(group.property)}${readConditionKeyCode(group.atRules, relativeSelectors)}`;
    const name = `dx-${key}_${valueCode}`;
    const declarationText = values.map((value) => `${group.property}:${value};`).join("");
    const repeatCounts = relativeSelectors.map((selector) =>
      readAtomRepeatCount(group.property, group.atRules, selector),
    );
    const selectorText = relativeSelectors
      .map((selector, index) => selector.replace("&", "&".repeat(repeatCounts[index])))
      .join(",");
    const cssText =
      selectorText === "&" && group.atRules.length === 0
        ? declarationText
        : wrapInAtRules(group.atRules, `${selectorText}{${declarationText}}`);
    const value = values.map((entry) => entry.replace(IMPORTANT_PATTERN, "").trim()).join(", ");
    const important = values.some((entry) => IMPORTANT_PATTERN.test(entry));
    const atomDeclarations = relativeSelectors.map((selector, index) => ({
      atRules: group.atRules,
      atomicSpecificity: readSelectorSpecificity(selector, [0, repeatCounts[index], 0]),
      important,
      key,
      property: group.property,
      selector,
      semanticSpecificity: readSelectorSpecificity(selector, [0, 1, 0]),
      value,
    }));

    registerAtom(name, { body: cssText, declarations: atomDeclarations }, input.place);
    rules[`.${name}`] = {
      className: name,
      cssText,
      displayName: input.displayName,
      start: input.location?.start,
    };
    atoms.push(name);
    declarations.push(...atomDeclarations);
  });

  if (passthrough.length > 0) {
    rules[`.${input.className}`] = {
      className: input.className,
      cssText: serialize(passthrough, stringify),
      displayName: input.displayName,
      start: input.location?.start,
    };
  }

  return { atoms, declarations, needsStyleClass, rules };
}
