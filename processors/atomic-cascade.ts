/**
 * The order check of the atomic output model.
 *
 * The semantic model resolves two declarations of one element by `!important`,
 * then specificity, then their order in the CSS. Atoms are shared between
 * styles, so their order in the CSS means nothing: the atomic model resolves
 * them by `!important` and specificity alone. The check compares both models
 * on every pair of declarations that can meet on one element and fails when
 * they pick a different winner, or when the atomic model cannot pick one.
 */
import { propertiesOverlap, readLonghandDepth } from "./atomic-properties.js";
import {
  findClosingToken,
  type SelectorToken,
  serializeTokens,
  splitTokenList,
  tokenizeSelector,
  unescapeCss,
} from "./atomic-selector.js";

export type Specificity = readonly [number, number, number];

/** One declaration of a style, as the order check sees it. */
export interface CascadeDeclaration {
  /** At-rule preludes around the declaration, outermost first (`@media (…)`). */
  readonly atRules: readonly string[];
  readonly atomicSpecificity: Specificity;
  readonly important: boolean;
  /** The atom key: the property and the condition. */
  readonly key: string;
  /** The properties the atom emits after the vendor prefixer, the property itself included. */
  readonly properties: readonly string[];
  readonly property: string;
  /** One complex selector relative to the styled element, which is `&`. */
  readonly selector: string;
  readonly semanticSpecificity: Specificity;
  readonly value: string;
}

/** A group of declarations that reaches an element through one class string. */
export interface CascadePart {
  /** Whether pairs inside the part are checked; false for known style handles. */
  readonly checkWithin: boolean;
  readonly declarations: readonly CascadeDeclaration[];
  /** Where the part comes from, for the error message (`recipe() variant "tone.accent"`). */
  readonly place: string;
  /** Recipe node, for the hint about `&:disabled` in a recipe base. */
  readonly node?: "base" | "compound" | "variant";
}

interface SimpleSelector {
  /** Tokens inside the brackets of an attribute or a functional pseudo-class. */
  readonly argument?: readonly SelectorToken[];
  readonly kind:
    | "amp"
    | "attribute"
    | "class"
    | "id"
    | "pseudo-class"
    | "pseudo-element"
    | "type"
    | "universal";
  readonly name: string;
  readonly raw: string;
}

interface ComplexSelector {
  readonly compounds: readonly (readonly SimpleSelector[])[];
}

const legacyPseudoElements = new Set(["after", "before", "first-letter", "first-line"]);

/**
 * Ranks of the pseudo-classes of the styled element. A higher rank wins over a
 * lower one whatever the order of the declarations.
 */
const pseudoClassRanks = new Map<string, number>([
  ["hover", 1],
  ["focus", 2],
  ["focus-visible", 2],
  ["focus-within", 2],
  ["active", 3],
  ["disabled", 4],
]);

const conditionalAtRules = new Set([
  "@container",
  "@document",
  "@media",
  "@starting-style",
  "@supports",
]);

/** Splits a selector list on its top-level commas. */
function splitSelectorList(tokens: readonly SelectorToken[]): string[] {
  return splitTokenList(tokens).map(serializeTokens);
}

// Pure results, cached per process: a recipe compares every pair of its declarations.
const parsedSelectors = new Map<string, ComplexSelector>();
const parsedWidthRanges = new Map<string, Map<string, WidthInterval>>();

function parseComplexSelector(source: string): ComplexSelector {
  const cached = parsedSelectors.get(source);
  if (cached !== undefined) {
    return cached;
  }

  const parsed = parseComplexSelectorTokens(source, tokenizeSelector(source));
  parsedSelectors.set(source, parsed);
  return parsed;
}

function parseComplexSelectorTokens(
  source: string,
  tokens: readonly SelectorToken[],
): ComplexSelector {
  const compounds: SimpleSelector[][] = [[]];
  const fail = () => new Error(`dx-styles atomic output cannot parse the selector "${source}".`);
  let index = 0;

  const current = () => compounds[compounds.length - 1];
  const push = (kind: SimpleSelector["kind"], name: string, end: number, argument?: readonly SelectorToken[]) => {
    current().push({ argument, kind, name, raw: serializeTokens(tokens.slice(index, end)) });
    index = end;
  };

  while (index < tokens.length) {
    const { kind, text } = tokens[index];
    const next = tokens[index + 1];

    if (kind === "whitespace" || (kind === "delim" && /^[>+~]$/u.test(text))) {
      if (current().length > 0) {
        compounds.push([]);
      }
      index += 1;
    } else if (kind === "delim" && (text === "&" || text === "*")) {
      push(text === "&" ? "amp" : "universal", text, index + 1);
    } else if (kind === "delim" && (text === "." || text === "#") && next?.kind === "word") {
      push(text === "." ? "class" : "id", unescapeCss(next.text), index + 2);
    } else if (kind === "open" && text === "[") {
      const end = findClosingToken(tokens, index);
      push("attribute", serializeTokens(tokens.slice(index, end)), end, tokens.slice(index + 1, end - 1));
    } else if (kind === "delim" && text === ":") {
      const isElement = next?.kind === "delim" && next.text === ":";
      const nameToken = tokens[index + (isElement ? 2 : 1)];
      if (nameToken?.kind !== "word") {
        throw fail();
      }
      const name = unescapeCss(nameToken.text).toLowerCase();
      const nameEnd = index + (isElement ? 3 : 2);
      const hasArgument = tokens[nameEnd]?.kind === "open" && tokens[nameEnd].text === "(";
      const end = hasArgument ? findClosingToken(tokens, nameEnd) : nameEnd;
      push(
        isElement || legacyPseudoElements.has(name) ? "pseudo-element" : "pseudo-class",
        name,
        end,
        hasArgument ? tokens.slice(nameEnd + 1, end - 1) : undefined,
      );
    } else if (kind === "word") {
      push("type", unescapeCss(text).toLowerCase(), index + 1);
    } else {
      throw fail();
    }
  }

  return { compounds: compounds.filter((compound) => compound.length > 0) };
}

function addSpecificity(left: Specificity, right: Specificity): Specificity {
  return [left[0] + right[0], left[1] + right[1], left[2] + right[2]];
}

function compareSpecificity(left: Specificity, right: Specificity): number {
  return left[0] - right[0] || left[1] - right[1] || left[2] - right[2];
}

function maxSpecificity(selectors: readonly string[], ampSpecificity: Specificity): Specificity {
  return selectors
    .map((selector) => readSelectorSpecificity(selector, ampSpecificity))
    .reduce<Specificity>(
      (max, next) => (compareSpecificity(next, max) > 0 ? next : max),
      [0, 0, 0],
    );
}

function readSimpleSpecificity(simple: SimpleSelector, ampSpecificity: Specificity): Specificity {
  switch (simple.kind) {
    case "amp":
      return ampSpecificity;
    case "id":
      return [1, 0, 0];
    case "class":
    case "attribute":
      return [0, 1, 0];
    case "type":
    case "pseudo-element":
      return [0, 0, 1];
    case "universal":
      return [0, 0, 0];
    case "pseudo-class":
      break;
  }

  const argument = simple.argument ?? [];

  if (simple.name === "where") {
    return [0, 0, 0];
  }

  if (
    simple.name === "is" ||
    simple.name === "not" ||
    simple.name === "has" ||
    simple.name === "global"
  ) {
    // A relative selector of :has() starts with a combinator.
    return maxSpecificity(
      splitTokenList(argument).map((item) =>
        serializeTokens(item).replace(/^[>+~]/u, "").trim(),
      ),
      ampSpecificity,
    );
  }

  const of = argument.findIndex(
    (token) =>
      token.kind === "word" &&
      token.text.toLowerCase() === "of" &&
      token.depth === argument[0].depth &&
      (simple.name === "nth-child" || simple.name === "nth-last-child"),
  );

  return of < 0
    ? [0, 1, 0]
    : addSpecificity(
        [0, 1, 0],
        maxSpecificity(splitSelectorList(argument.slice(of + 1)), ampSpecificity),
      );
}

/** Specificity of a complex selector (Selectors Level 4, §16), `&` counting as given. */
export function readSelectorSpecificity(
  selector: string,
  ampSpecificity: Specificity,
): Specificity {
  return parseComplexSelector(selector)
    .compounds.flat()
    .reduce<Specificity>(
      (total, simple) => addSpecificity(total, readSimpleSpecificity(simple, ampSpecificity)),
      [0, 0, 0],
    );
}

function findAmpCompound(selector: ComplexSelector): readonly SimpleSelector[] {
  return (
    selector.compounds.find((compound) => compound.some((simple) => simple.kind === "amp")) ?? []
  );
}

/**
 * The highest rank of the top-level pseudo-classes in the compound of `&`.
 * Pseudo-classes inside `:not()`, `:is()`, `:where()` and `:has()` do not count.
 */
export function readPseudoClassRank(selector: string): number {
  return findAmpCompound(parseComplexSelector(selector)).reduce(
    (rank, simple) =>
      simple.kind === "pseudo-class"
        ? Math.max(rank, pseudoClassRanks.get(simple.name) ?? 0)
        : rank,
    0,
  );
}

/** Whether an at-rule prelude is a condition of the declaration (`@media`, `@supports`, ...). */
export function isConditionalAtRule(atRule: string): boolean {
  return conditionalAtRules.has(/^@[\w-]+/u.exec(atRule)?.[0].toLowerCase() ?? "");
}

/** The atom's repeat count of its class: `1 + L + 3·A + 6·P`. */
export function readAtomRepeatCount(
  property: string,
  atRules: readonly string[],
  selector: string,
): number {
  const depth = readLonghandDepth(property);
  const inAtRule = atRules.some(isConditionalAtRule) ? 1 : 0;

  return 1 + depth + 3 * inAtRule + 6 * readPseudoClassRank(selector);
}

interface WidthInterval {
  readonly high: number;
  readonly highInclusive: boolean;
  readonly low: number;
  readonly lowInclusive: boolean;
}

const lengthPattern = String.raw`(-?(?:\d+\.?\d*|\.\d+))(px|rem|em)`;

function intersectIntervals(left: WidthInterval, right: WidthInterval): WidthInterval {
  const low = left.low > right.low || (left.low === right.low && !left.lowInclusive) ? left : right;
  const high =
    left.high < right.high || (left.high === right.high && !left.highInclusive) ? left : right;

  return {
    high: high.high,
    highInclusive: high.highInclusive,
    low: low.low,
    lowInclusive: low.lowInclusive,
  };
}

function isEmptyInterval(interval: WidthInterval): boolean {
  return (
    interval.low > interval.high ||
    (interval.low === interval.high && !(interval.lowInclusive && interval.highInclusive))
  );
}

function boundFrom(operator: string, value: number, widthOnLeft: boolean): WidthInterval {
  const unbounded: WidthInterval = {
    high: Number.POSITIVE_INFINITY,
    highInclusive: false,
    low: Number.NEGATIVE_INFINITY,
    lowInclusive: false,
  };
  // `width < x` and `x > width` both bound width from above.
  const isUpper = widthOnLeft ? operator.startsWith("<") : operator.startsWith(">");
  const inclusive = operator.endsWith("=");

  return isUpper
    ? { ...unbounded, high: value, highInclusive: inclusive }
    : { ...unbounded, low: value, lowInclusive: inclusive };
}

function readWidthFeature(feature: string): null | readonly [string, WidthInterval] {
  const text = feature.trim().toLowerCase();
  const minMax = new RegExp(String.raw`^(min|max)-width\s*:\s*${lengthPattern}$`, "u").exec(text);

  if (minMax !== null) {
    const value = Number(minMax[2]);
    return [
      minMax[3],
      minMax[1] === "min"
        ? { high: Number.POSITIVE_INFINITY, highInclusive: false, low: value, lowInclusive: true }
        : { high: value, highInclusive: true, low: Number.NEGATIVE_INFINITY, lowInclusive: false },
    ];
  }

  const widthFirst = new RegExp(String.raw`^width\s*(<=|>=|<|>)\s*${lengthPattern}$`, "u").exec(
    text,
  );
  if (widthFirst !== null) {
    return [widthFirst[3], boundFrom(widthFirst[1], Number(widthFirst[2]), true)];
  }

  const valueFirst = new RegExp(
    String.raw`^${lengthPattern}\s*(<=|>=|<|>)\s*width(?:\s*(<=|>=|<|>)\s*${lengthPattern})?$`,
    "u",
  ).exec(text);
  if (valueFirst !== null) {
    const first = boundFrom(valueFirst[3], Number(valueFirst[1]), false);

    if (valueFirst[4] === undefined) {
      return [valueFirst[2], first];
    }

    if (valueFirst[6] !== valueFirst[2]) {
      return null;
    }

    return [
      valueFirst[2],
      intersectIntervals(first, boundFrom(valueFirst[4], Number(valueFirst[5]), true)),
    ];
  }

  return null;
}

/** Width ranges per unit that every `@media` of the chain requires. */
function readWidthRanges(atRules: readonly string[]): Map<string, WidthInterval> {
  const cacheKey = atRules.join("\u0000");
  const cached = parsedWidthRanges.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  const ranges = readWidthRangesOf(atRules);
  parsedWidthRanges.set(cacheKey, ranges);
  return ranges;
}

function readWidthRangesOf(atRules: readonly string[]): Map<string, WidthInterval> {
  const ranges = new Map<string, WidthInterval>();

  atRules.forEach((atRule) => {
    const media = /^@media\s+(.*)$/isu.exec(atRule.trim())?.[1].toLowerCase();

    if (media === undefined || /,|\bnot\b|\bor\b/u.test(media)) {
      return;
    }

    media
      .replace(/^(?:only\s+)?[a-z]+\s+and\s+/u, "")
      .split(/\)\s*and\s*\(/u)
      .map((feature) => feature.replace(/^\s*\(|\)\s*$/gu, ""))
      .forEach((feature) => {
        const bound = readWidthFeature(feature);

        if (bound !== null) {
          const [unit, interval] = bound;
          const existing = ranges.get(unit);
          ranges.set(
            unit,
            existing === undefined ? interval : intersectIntervals(existing, interval),
          );
        }
      });
  });

  return ranges;
}

interface AttributeValue {
  /** Whether the value is compared case-sensitively for sure. */
  readonly caseSensitive: boolean;
  /** The value with its escapes resolved. */
  readonly value: string;
}

/** `[name=value]` or `[name=value i|s]`; other attribute selectors give null. */
function readEqualityAttribute(
  argument: readonly SelectorToken[],
): null | readonly [string, AttributeValue] {
  const [name, operator, value, flag, ...rest] = argument.filter(
    (token) => token.kind !== "whitespace",
  );

  if (
    name?.kind !== "word" ||
    operator?.kind !== "delim" ||
    operator.text !== "=" ||
    (value?.kind !== "word" && value?.kind !== "string") ||
    (flag !== undefined && (flag.kind !== "word" || !/^[is]$/iu.test(flag.text))) ||
    rest.length > 0
  ) {
    return null;
  }

  const attribute = unescapeCss(name.text).toLowerCase();
  const modifier = flag?.text.toLowerCase();
  // HTML matches the values of some attributes (`type`, `lang`, ...)
  // case-insensitively; `data-*` attributes and the `s` flag never do.
  const caseSensitive =
    modifier === "s" || (modifier === undefined && attribute.startsWith("data-"));
  const text = value.kind === "string" ? value.text.slice(1, -1) : value.text;
  return [attribute, { caseSensitive, value: unescapeCss(text) }];
}

function readEqualityAttributes(compound: readonly SimpleSelector[]): Map<string, AttributeValue> {
  return new Map(
    compound.flatMap((simple) => {
      const attribute =
        simple.kind === "attribute" ? readEqualityAttribute(simple.argument ?? []) : null;
      return attribute === null ? [] : [attribute];
    }),
  );
}

function areAttributeValuesDifferent(left: AttributeValue, right: AttributeValue): boolean {
  return left.caseSensitive && right.caseSensitive
    ? left.value !== right.value
    : left.value.toLowerCase() !== right.value.toLowerCase();
}

function readNegations(compound: readonly SimpleSelector[]): Set<string> {
  return new Set(
    compound.flatMap((simple) =>
      simple.kind === "pseudo-class" && simple.name === "not"
        ? splitSelectorList(simple.argument ?? [])
        : [],
    ),
  );
}

function readSubjectTypes(selector: ComplexSelector): Set<string> {
  const subject = selector.compounds[selector.compounds.length - 1] ?? [];
  return new Set(subject.filter((simple) => simple.kind === "type").map((simple) => simple.name));
}

function readPseudoElement(selector: ComplexSelector): string {
  const subject = selector.compounds[selector.compounds.length - 1] ?? [];
  return subject
    .filter((simple) => simple.kind === "pseudo-element")
    .map((simple) => simple.name)
    .join("");
}

/**
 * Whether two declarations can never apply to one element at once. Proved for
 * a closed list of forms; any other pair counts as able to meet.
 */
export function areConditionsIncompatible(
  left: Pick<CascadeDeclaration, "atRules" | "selector">,
  right: Pick<CascadeDeclaration, "atRules" | "selector">,
): boolean {
  const leftSelector = parseComplexSelector(left.selector);
  const rightSelector = parseComplexSelector(right.selector);

  if (readPseudoElement(leftSelector) !== readPseudoElement(rightSelector)) {
    return true;
  }

  // 1. One attribute with different values (`=`) on the styled element.
  const leftCompound = findAmpCompound(leftSelector);
  const rightCompound = findAmpCompound(rightSelector);
  const leftAttributes = readEqualityAttributes(leftCompound);
  const rightAttributes = readEqualityAttributes(rightCompound);
  if (
    [...leftAttributes].some(([name, value]) => {
      const other = rightAttributes.get(name);
      return other !== undefined && areAttributeValuesDifferent(value, other);
    })
  ) {
    return true;
  }

  // 2. `:x` and `:not(:x)` on the styled element.
  const leftSimples = new Set(leftCompound.map((simple) => simple.raw));
  const rightSimples = new Set(rightCompound.map((simple) => simple.raw));
  if (
    [...readNegations(leftCompound)].some((negated) => rightSimples.has(negated)) ||
    [...readNegations(rightCompound)].some((negated) => leftSimples.has(negated))
  ) {
    return true;
  }

  // 3. Different type selectors on the subject of the selectors.
  const leftTypes = readSubjectTypes(leftSelector);
  const rightTypes = readSubjectTypes(rightSelector);
  if (
    leftTypes.size > 0 &&
    rightTypes.size > 0 &&
    ![...leftTypes].some((type) => rightTypes.has(type))
  ) {
    return true;
  }

  // 4. Width ranges in one unit that do not intersect.
  const leftRanges = readWidthRanges(left.atRules);
  const rightRanges = readWidthRanges(right.atRules);
  return [...leftRanges].some(([unit, interval]) => {
    const other = rightRanges.get(unit);
    return other !== undefined && isEmptyInterval(intersectIntervals(interval, other));
  });
}

function compareWeight(
  left: CascadeDeclaration,
  right: CascadeDeclaration,
  specificity: "atomicSpecificity" | "semanticSpecificity",
): number {
  return (
    Number(left.important) - Number(right.important) ||
    compareSpecificity(left[specificity], right[specificity])
  );
}

function describeCondition(declaration: CascadeDeclaration): string {
  return [...declaration.atRules, declaration.selector].join(" ");
}

function describeDeclaration(part: CascadePart, declaration: CascadeDeclaration): string {
  return `${part.place} sets "${declaration.property}: ${declaration.value}" under "${describeCondition(declaration)}"`;
}

interface DeclarationFacts {
  readonly depth: number;
  readonly inAtRule: boolean;
  readonly rank: number;
}

function readFacts(declaration: CascadeDeclaration): DeclarationFacts {
  return {
    depth: readLonghandDepth(declaration.property),
    inAtRule: declaration.atRules.some(isConditionalAtRule),
    rank: readPseudoClassRank(declaration.selector),
  };
}

function describeAtomicRule(winner: CascadeDeclaration, loser: CascadeDeclaration): string {
  const winnerFacts = readFacts(winner);
  const loserFacts = readFacts(loser);

  if (winner.important !== loser.important) {
    return "an !important declaration wins over a normal one";
  }

  if (winnerFacts.rank !== loserFacts.rank) {
    return "the pseudo-class rank decides (:hover < :focus, :focus-visible, :focus-within < :active < :disabled)";
  }

  if (winnerFacts.inAtRule !== loserFacts.inAtRule) {
    return "a declaration inside an at-rule wins over one outside it";
  }

  if (winnerFacts.depth !== loserFacts.depth) {
    return "a longhand wins over its shorthand";
  }

  return "the remaining selector specificity decides";
}

function describeTieHint(earlier: CascadeDeclaration, later: CascadeDeclaration): string {
  const earlierMedia = earlier.atRules.filter((atRule) => /^@media/iu.test(atRule)).join(" ");
  const laterMedia = later.atRules.filter((atRule) => /^@media/iu.test(atRule)).join(" ");

  if (earlierMedia !== laterMedia && earlierMedia.length > 0 && laterMedia.length > 0) {
    return "overlapping @media conditions on one property have no order rule: rewrite them into ranges that do not overlap, e.g. @media (width >= 40rem) and (width < 64rem)";
  }

  if (earlier.property !== later.property) {
    return `"${earlier.property}" and "${later.property}" have no order rule: set the property in one declaration, or both under one condition`;
  }

  return "these conditions have no order rule: set the property under one condition, or make the conditions exclusive (an attribute with different values, :x and :not(:x), different tags, width ranges that do not overlap)";
}

function describeContradictionHint(
  semanticWinner: CascadeDeclaration,
  atomicWinner: CascadeDeclaration,
  semanticWinnerPart: CascadePart,
  atomicWinnerPart: CascadePart,
): string {
  const atomicFacts = readFacts(atomicWinner);
  const semanticFacts = readFacts(semanticWinner);

  if (
    atomicWinnerPart.node === "base" &&
    semanticWinnerPart !== atomicWinnerPart &&
    atomicFacts.rank > semanticFacts.rank
  ) {
    const atomicSelector = atomicWinner.selector;
    const semanticSelector = semanticWinner.selector;
    return `move the "${atomicSelector}" declaration of "${atomicWinner.property}" from the recipe base into each variant that sets "${semanticSelector}" on this property, after its "${semanticSelector}": then the rule and the order agree`;
  }

  if (atomicWinner.key === semanticWinner.key) {
    return "give both declarations the same !important, or keep only one of them";
  }

  return `reorder the declarations so that the order agrees with the rule: put "${describeCondition(semanticWinner)}" (${semanticWinner.property}) before "${describeCondition(atomicWinner)}" (${atomicWinner.property}), or set the property in one declaration`;
}

interface PlacedDeclaration {
  readonly declaration: CascadeDeclaration;
  readonly part: number;
}

/**
 * Checks every pair of declarations that can meet on one element. Parts are in
 * class-string order; `canMeet` says whether two parts can be on one element.
 * Throws with the place, the property, both conditions, the rule and a hint.
 */
export function checkAtomicCascade(
  file: string,
  parts: readonly CascadePart[],
  canMeet: (left: number, right: number) => boolean = () => true,
): void {
  const placed: PlacedDeclaration[] = parts.flatMap((part, index) =>
    part.declarations.map((declaration) => ({ declaration, part: index })),
  );

  for (let laterIndex = 1; laterIndex < placed.length; laterIndex += 1) {
    for (let earlierIndex = 0; earlierIndex < laterIndex; earlierIndex += 1) {
      const earlier = placed[earlierIndex];
      const later = placed[laterIndex];
      const x = earlier.declaration;
      const y = later.declaration;

      if (
        (earlier.part === later.part && !parts[earlier.part].checkWithin) ||
        (earlier.part !== later.part && !canMeet(earlier.part, later.part)) ||
        !x.properties.some((left) => y.properties.some((right) => propertiesOverlap(left, right))) ||
        // One property with one value gives one result whichever declaration wins.
        (x.property === y.property && x.value === y.value && x.important === y.important) ||
        areConditionsIncompatible(x, y)
      ) {
        continue;
      }

      const semanticWinner = compareWeight(x, y, "semanticSpecificity") > 0 ? earlier : later;
      const atomicOrder = x.key === y.key ? -1 : compareWeight(x, y, "atomicSpecificity");

      if (atomicOrder === 0) {
        throw new Error(
          `dx-styles atomic output: ${file}: ${describeDeclaration(parts[earlier.part], x)}, and ${describeDeclaration(parts[later.part], y)}. The semantic model applies "${describeCondition(semanticWinner.declaration)}" (${semanticWinner.declaration.property}), but the atomic model has no rule that orders these two declarations. To fix it, ${describeTieHint(x, y)}.`,
        );
      }

      const atomicWinner = atomicOrder > 0 ? earlier : later;
      if (atomicWinner !== semanticWinner) {
        const atomicLoser = atomicWinner === earlier ? later : earlier;
        throw new Error(
          `dx-styles atomic output: ${file}: ${describeDeclaration(parts[earlier.part], x)}, and ${describeDeclaration(parts[later.part], y)}. The semantic model applies "${describeCondition(semanticWinner.declaration)}", but in the atomic model ${describeAtomicRule(atomicWinner.declaration, atomicLoser.declaration)}, so it would apply "${describeCondition(atomicWinner.declaration)}". To fix it, ${describeContradictionHint(semanticWinner.declaration, atomicWinner.declaration, parts[semanticWinner.part], parts[atomicWinner.part])}.`,
        );
      }
    }
  }
}
