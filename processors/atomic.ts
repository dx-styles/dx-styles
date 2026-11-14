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
import {
  compile,
  type Element,
  KEYFRAMES,
  prefix,
  RULESET,
  serialize,
  stringify,
  tokenize,
} from "stylis";

import {
  type CascadeDeclaration,
  isConditionalAtRule,
  readAtomRepeatCount,
  readSelectorSpecificity,
} from "./atomic-cascade.js";
import { readPropertyCode } from "./atomic-properties.js";
import {
  findClassTokens,
  isOnlyInsideIsOrWhere,
  normalizeSelectorText,
  type SelectorToken,
  serializeTokens,
  tokenizeSelector,
} from "./atomic-selector.js";

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
const URL_PATTERN = /\burl\(\s*(["']?)(.*?)\1\s*\)/giu;
// A target with a scheme (`data:`, `https:`), a protocol-relative or
// root-relative path, or a fragment means the same resource in every module.
const ABSOLUTE_URL_PATTERN = /^(?:[a-z][\d+.a-z-]*:|\/|#)/iu;
const IMPORTANT_PATTERN = /!\s*important\s*$/iu;
const ANIMATION_PROPERTIES = new Set(
  ["", "-webkit-", "-moz-", "-ms-", "-o-"].flatMap((prefix) => [
    `${prefix}animation`,
    `${prefix}animation-name`,
  ]),
);
const UNSUPPORTED_AT_RULES = new Set(["@layer", "@scope"]);

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
 * Replaces the hash of atom codes until `run` settles. Tests use it to force a
 * collision; the build never calls it.
 */
export async function withAtomHashForTesting<TResult>(
  hash: (source: string, width: number) => string,
  run: () => Promise<TResult>,
): Promise<TResult> {
  const previous = atomHash;
  atomHash = hash;

  try {
    return await run();
  } finally {
    atomHash = previous;
  }
}

function hasRelativeUrl(value: string): boolean {
  return [...value.matchAll(URL_PATTERN)].some(
    ([, , target]) => target.length > 0 && !ABSOLUTE_URL_PATTERN.test(target),
  );
}

// The :global() rule of the WyW stylis preprocessor, which the semantic model
// goes through (`stylisGlobalPlugin` of @wyw-in-js/transform, not exported).
// The atomizer needs the selector it produces to tell a rule that selects the
// element of the style from a global rule.
const GLOBAL_SELECTOR_PATTERN = /(&\f( )?)?:global\(/u;

function readNonMediaParent(element: Element): Element | null {
  let { parent } = element;
  while (parent !== null) {
    if (parent.type !== "@media") {
      return parent;
    }
    parent = parent.parent;
  }
  return null;
}

function readGlobalSelectorModifiers(element: Element): { base: boolean; space: boolean } {
  const parent = readNonMediaParent(element);

  if (
    parent !== null &&
    (((parent.children as Element[]).length === 0 && parent.value.includes(":global(")) ||
      !element.value.includes(":global("))
  ) {
    return readGlobalSelectorModifiers(parent);
  }

  const match = GLOBAL_SELECTOR_PATTERN.exec(element.value);
  if (match === null) {
    throw new Error(`dx-styles atomic output cannot read the :global() selector "${element.value}".`);
  }

  return { base: match[1] !== undefined, space: match[2] !== undefined };
}

function resolveGlobalSelector(element: Element, selector: string): string {
  if (!selector.includes(":global(")) {
    return selector;
  }

  const { base, space } = readGlobalSelectorModifiers(element);
  const tokens = tokenize(selector);
  const index = tokens.findIndex((token, at) => token === ":" && tokens[at + 1] === "global");

  if (index < 0) {
    return "";
  }

  return [
    ...(tokens[index + 2] === "()" ? tokens.slice(index + 4) : [tokens[index + 2].slice(1, -1)]),
    space ? " " : "",
    ...(base ? tokens.slice(0, index - 1) : []),
    space ? "" : " ",
  ].join("");
}

/** Replaces the `&` that stands for the styled element; an `&` in a string is text. */
function replaceStyleMarker(selector: string, replacement: string): string {
  const tokens = tokenizeSelector(selector);
  const index = tokens.findIndex((token) => token.kind === "delim" && token.text === "&");

  if (index < 0) {
    throw new Error(`dx-styles atomic output cannot find the styled element in "${selector}".`);
  }

  return [...tokens.slice(0, index), { ...tokens[index], text: replacement }, ...tokens.slice(index + 1)]
    .map((token) => token.text)
    .join("");
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

/**
 * The property and value of a declaration that stylis parsed. Stylis reads
 * `animation::global(spin) 1s` as the property `animation:` with the value
 * `global(spin) 1s`; the WyW preprocessor restores the property `animation`
 * with the value `:global(spin) 1s`, and so does the atomizer, so that both
 * share the key of `animation`.
 */
function readDeclaration(name: string, value: string): readonly [string, string] {
  const withoutColon = name.endsWith(":") ? name.slice(0, -1) : name;

  if (
    withoutColon !== name &&
    ANIMATION_PROPERTIES.has(withoutColon.toLowerCase()) &&
    value.startsWith("global(")
  ) {
    return readDeclaration(withoutColon, `:${value}`);
  }

  // Custom property names are case-sensitive; other names are not.
  return [name.startsWith("--") ? name : name.toLowerCase(), value];
}

interface DeclarationGroup {
  readonly atRules: readonly string[];
  /** The declarations of the group as stylis parsed them, and all declarations of their rule. */
  readonly elements: Element[];
  readonly property: string;
  readonly selectors: readonly string[];
  readonly siblings: readonly Element[];
  readonly values: string[];
}

/** A non-conditional at-rule (`@keyframes`, `@font-face`) and the conditions around it. */
interface PassthroughRule {
  readonly atRules: readonly string[];
  readonly element: Element;
}

interface CollectedStyle {
  readonly className: string;
  /** Rules whose :global() selector leaves the element of the style out. */
  readonly globalRules: string[];
  readonly groups: DeclarationGroup[];
  readonly passthrough: PassthroughRule[];
  readonly place: string;
}

function collectDeclarationGroups(
  elements: readonly Element[],
  atRules: readonly string[],
  style: CollectedStyle,
): void {
  const { groups, passthrough, place } = style;

  elements.forEach((element) => {
    if (element.type === RULESET) {
      let current: DeclarationGroup | null = null;
      const selectors: string[] = [];
      const globalSelectors: string[] = [];

      (element.props as string[]).forEach((selector) => {
        const resolved = resolveGlobalSelector(element, selector);
        if (
          resolved === selector ||
          findStyledElementToken(tokenizeSelector(resolved), style.className) !== undefined
        ) {
          selectors.push(resolved);
        } else {
          globalSelectors.push(selector);
        }
      });

      if (globalSelectors.length > 0) {
        const globalRule = serialize([{ ...element, props: globalSelectors }], stringify);
        if (globalRule.length > 0) {
          style.globalRules.push(wrapInAtRules(atRules, globalRule));
        }
      }

      if (selectors.length === 0) {
        return;
      }

      (element.children as Element[]).forEach((child) => {
        if (child.type !== "decl" || typeof child.children !== "string") {
          return;
        }

        const [property, value] = readDeclaration(String(child.props), child.children);

        if (current?.property === property) {
          current.elements.push(child);
          current.values.push(value);
          return;
        }

        current = {
          atRules,
          elements: [child],
          property,
          selectors,
          siblings: element.children as Element[],
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
        `dx-styles atomic output: ${place} uses "${normalizeSelectorText(element.value)}". The atomic output cannot express ${atRuleName} inside a style object, because atoms are shared between styles. Move this rule to a regular stylesheet, or build with output: "semantic".`,
      );
    }

    if (element.type !== KEYFRAMES && isConditionalAtRule(atRuleName)) {
      collectDeclarationGroups(
        element.children as Element[],
        [...atRules, normalizeSelectorText(element.value)],
        style,
      );
      return;
    }

    passthrough.push({ atRules, element });
  });
}

/**
 * Names of the keyframes that a style scopes. Like the WyW preprocessor, only
 * keyframes at the top level of the style scope the references to them.
 */
function readScopedKeyframes(passthrough: readonly PassthroughRule[]): Set<string> {
  return new Set(
    passthrough
      .filter(({ atRules, element }) => atRules.length === 0 && element.type === KEYFRAMES)
      .map(({ element }) => String((element.props as string[])[0] ?? ""))
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

/**
 * The `.` token of the class of the style that stands for the styled element:
 * the last one outside brackets, else the last one that only `:is()` and
 * `:where()` with one selector enclose, as in `:where(&)`.
 */
function findStyledElementToken(
  tokens: readonly SelectorToken[],
  className: string,
): number | undefined {
  const references = findClassTokens(tokens, className);

  return (
    references.filter((index) => tokens[index].depth === 0).at(-1) ??
    references.filter((index) => isOnlyInsideIsOrWhere(tokens, index)).at(-1)
  );
}

/**
 * Puts `&` in place of the class of the style that stands for the styled
 * element; any other reference to that class stays and needs the class.
 */
function toRelativeSelector(
  selector: string,
  className: string,
  place: string,
): readonly [string, boolean] {
  const tokens = tokenizeSelector(selector);
  const index = findStyledElementToken(tokens, className);

  if (index === undefined) {
    throw new Error(
      `dx-styles atomic output: ${place} uses the selector "${selector}", which does not select the element of the style. An atom styles only the element of its style, and a reference to the style inside :not() or :has(), or inside :is() or :where() next to other selectors, selects other elements. Move this rule to a regular stylesheet, or build with output: "semantic".`,
    );
  }

  const relative = serializeTokens([
    ...tokens.slice(0, index),
    { ...tokens[index], kind: "delim", text: "&" },
    ...tokens.slice(index + 2),
  ]);
  return [relative, findClassTokens(tokens, className).length > 1];
}

// The stylis prefixer gets the declarations of the rule around a declaration
// (`prefixer` of stylis 4 passes them on); its type leaves that argument out.
const prefixAmong = prefix as unknown as (
  value: string,
  length: number,
  siblings: readonly Element[],
) => string;

function prefixAll(elements: readonly Element[], siblings: readonly Element[]): string {
  return elements.map((element) => prefixAmong(element.value, element.length, siblings)).join("");
}

/**
 * The properties that the WyW preprocessor emits for an atom once the stylis
 * prefixer has run. Fails when the semantic model prefixes the declarations
 * differently because of their neighbours in the rule, which an atom lacks.
 */
function readEmittedProperties(
  group: DeclarationGroup,
  declarationText: string,
  place: string,
): string[] {
  const alone = prefixAll(group.elements, group.elements);
  const inRule = prefixAll(group.elements, group.siblings);

  if (alone !== inRule) {
    const neighbours = group.siblings
      .filter(
        (sibling) =>
          sibling.type === "decl" &&
          !group.elements.includes(sibling) &&
          prefixAll(group.elements, [...group.elements, sibling]) !== alone,
      )
      .map((sibling) => String(sibling.props));
    throw new Error(
      `dx-styles atomic output: ${place} sets "${group.property}: ${group.values.join(", ")}" next to "${neighbours.join('", "')}", and the vendor prefixes it gets there ("${inRule}") differ from those of an atom alone ("${alone}"). To fix it, set them with their shorthand (for example grid-row instead of grid-row-start and grid-row-end).`,
    );
  }

  const atomElements = (compile(`a{${declarationText}}`)[0]?.children ?? []) as Element[];
  const emitted = (compile(`a{${prefixAll(atomElements, atomElements)}}`)[0]?.children ??
    []) as Element[];
  return [...new Set(emitted.map((element) => readDeclaration(String(element.props), "")[0]))];
}

function wrapInAtRules(atRules: readonly string[], cssText: string): string {
  return atRules.reduceRight((inner, atRule) => `${atRule}{${inner}}`, cssText);
}

/** Turns one style into atoms: their rules, names and declarations for the order check. */
export function atomizeStyle(input: AtomizeStyleInput): AtomizedStyle {
  const elements = compile(`.${input.className}{${input.cssText}}`);
  const collected: CollectedStyle = {
    className: input.className,
    globalRules: [],
    groups: [],
    passthrough: [],
    place: input.place,
  };
  collectDeclarationGroups(elements, [], collected);
  const { globalRules, groups, passthrough } = collected;

  const keyframes = readScopedKeyframes(passthrough);
  const keyframesSuffix = input.className.replace(/[^a-zA-Z0-9_-]/gu, "");
  const rules: Record<string, ICSSRule> = {};
  const atoms: string[] = [];
  const declarations: CascadeDeclaration[] = [];
  let needsStyleClass = false;

  groups.forEach((group) => {
    const relativeSelectors = group.selectors.map((selector) => {
      const [relative, referencesStyleClass] = toRelativeSelector(selector, input.className, input.place);
      needsStyleClass ||= referencesStyleClass;
      return relative;
    });
    const values = ANIMATION_PROPERTIES.has(group.property)
      ? group.values.map((value) => scopeAnimationReferences(value, keyframes, keyframesSuffix))
      : group.values;
    const relativeUrlScope = values.some(hasRelativeUrl)
      ? input.moduleDirectory
      : "";
    const valueCode = atomHash(
      `value\u0000${JSON.stringify([values, relativeUrlScope])}`,
      VALUE_CODE_WIDTH,
    );
    const key = `${readPropertyKeyCode(group.property)}${readConditionKeyCode(group.atRules, relativeSelectors)}`;
    const name = `dx-${key}_${valueCode}`;
    const declarationText = values.map((value) => `${group.property}:${value};`).join("");
    const properties = readEmittedProperties(group, declarationText, input.place);
    const repeatCounts = relativeSelectors.map((selector) =>
      readAtomRepeatCount(group.property, group.atRules, selector),
    );
    const selectorText = relativeSelectors
      .map((selector, index) => replaceStyleMarker(selector, "&".repeat(repeatCounts[index])))
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
      properties,
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

  if (passthrough.length > 0 || globalRules.length > 0) {
    rules[`.${input.className}`] = {
      className: input.className,
      cssText: `${passthrough
        .map(({ atRules, element }) => wrapInAtRules(atRules, serialize([element], stringify)))
        .join("")}${globalRules.join("")}`,
      displayName: input.displayName,
      start: input.location?.start,
    };
  }

  return { atoms, declarations, needsStyleClass, rules };
}
