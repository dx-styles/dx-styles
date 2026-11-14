/**
 * The one reader of selector text in the atomic output model. Every place that
 * reads or rewrites a selector goes through these tokens, so a quoted string,
 * an escape, an attribute or a pseudo-class argument is never taken for a part
 * of the selector around it (CSS Syntax 3, §4).
 */
export interface SelectorToken {
  /** Nesting of `()` and `[]` around the token; an opening bracket has the outer depth. */
  readonly depth: number;
  /** Whether the token is inside an attribute selector. */
  readonly inAttribute: boolean;
  readonly kind: "close" | "delim" | "open" | "string" | "whitespace" | "word";
  readonly text: string;
}

const MAX_CODE_POINT = 0x10ffff;
const WORD_PATTERN = /(?:[\w-]|\P{ASCII}|\\(?:[\da-f]{1,6}[\t\n\f\r ]?|[\s\S]))+/iuy;
const STRING_PATTERN = /"(?:[^"\\]|\\[\s\S])*"?|'(?:[^'\\]|\\[\s\S])*'?/uy;
const WHITESPACE_PATTERN = /\s+/uy;

const tokenCache = new Map<string, readonly SelectorToken[]>();

function readAt(pattern: RegExp, source: string, index: number): null | string {
  pattern.lastIndex = index;
  return pattern.exec(source)?.[0] ?? null;
}

/** Splits selector (or at-rule prelude) text into tokens. */
export function tokenizeSelector(source: string): readonly SelectorToken[] {
  const cached = tokenCache.get(source);
  if (cached !== undefined) {
    return cached;
  }

  const tokens: SelectorToken[] = [];
  const open: string[] = [];
  let index = 0;

  while (index < source.length) {
    const character = source[index];
    const depth = open.length;
    const inAttribute = open.includes("[");
    let kind: SelectorToken["kind"] = "delim";
    let text =
      readAt(WHITESPACE_PATTERN, source, index) ??
      (character === '"' || character === "'" ? readAt(STRING_PATTERN, source, index) : null) ??
      readAt(WORD_PATTERN, source, index);

    if (text === null) {
      text = character;
      if (character === "(" || character === "[") {
        kind = "open";
        open.push(character);
      } else if ((character === ")" || character === "]") && depth > 0) {
        kind = "close";
        open.pop();
      }
    } else {
      kind = /^\s/u.test(text) ? "whitespace" : /^["']/u.test(text) ? "string" : "word";
    }

    tokens.push({ depth: kind === "close" ? depth - 1 : depth, inAttribute, kind, text });
    index += text.length;
  }

  tokenCache.set(source, tokens);
  return tokens;
}

/** The text of tokens with every run of whitespace as one space, trimmed. */
export function serializeTokens(tokens: readonly SelectorToken[]): string {
  return tokens
    .map((token) => (token.kind === "whitespace" ? " " : token.text))
    .join("")
    .trim();
}

/** Text with its whitespace collapsed outside strings and escapes. */
export function normalizeSelectorText(source: string): string {
  return serializeTokens(tokenizeSelector(source));
}

/** Splits tokens on the commas at the given depth (a selector list). */
export function splitTokenList(
  tokens: readonly SelectorToken[],
  depth = tokens[0]?.depth ?? 0,
): SelectorToken[][] {
  const items: SelectorToken[][] = [[]];
  tokens.forEach((token) => {
    if (token.kind === "delim" && token.text === "," && token.depth === depth) {
      items.push([]);
    } else {
      items[items.length - 1].push(token);
    }
  });
  return items.filter((item) => item.some((token) => token.kind !== "whitespace"));
}

/** The index after the bracket that `start` opens. */
export function findClosingToken(tokens: readonly SelectorToken[], start: number): number {
  const end = tokens.findIndex(
    (token, index) => index > start && token.kind === "close" && token.depth === tokens[start].depth,
  );
  return end < 0 ? tokens.length : end + 1;
}

/** Resolves the escapes of a CSS string or identifier (CSS Syntax 3, §4.3.7). */
export function unescapeCss(text: string): string {
  return text.replace(
    /\\(?:([\da-f]{1,6})(?:\r\n|[\t\n\f\r ])?|(\r\n|[\n\f\r])|([\s\S]))/giu,
    (_match, hex: string | undefined, newline: string | undefined, other: string | undefined) => {
      if (hex !== undefined) {
        const codePoint = Number.parseInt(hex, 16);
        return codePoint === 0 ||
          (codePoint >= 0xd800 && codePoint <= 0xdfff) ||
          codePoint > MAX_CODE_POINT
          ? "�"
          : String.fromCodePoint(codePoint);
      }

      return newline === undefined ? (other ?? "") : "";
    },
  );
}

/** Indexes of the `.` tokens of class selectors with this name, outside attributes. */
export function findClassTokens(tokens: readonly SelectorToken[], className: string): number[] {
  return tokens.flatMap((token, index) => {
    const name = tokens[index + 1];
    return token.kind === "delim" &&
      token.text === "." &&
      !token.inAttribute &&
      name?.kind === "word" &&
      unescapeCss(name.text) === className
      ? [index]
      : [];
  });
}

function isIsOrWhereOpening(tokens: readonly SelectorToken[], index: number): boolean {
  const [before, colon, name, open] = [index - 3, index - 2, index - 1, index].map(
    (position) => (position < 0 ? undefined : tokens[position]),
  );
  return (
    open?.kind === "open" &&
    open.text === "(" &&
    name?.kind === "word" &&
    /^(?:is|where)$/iu.test(unescapeCss(name.text)) &&
    colon?.kind === "delim" &&
    colon.text === ":" &&
    !(before?.kind === "delim" && before.text === ":")
  );
}

/**
 * Whether the token is outside brackets, or inside `:is()` and `:where()` only,
 * each with one selector (`:where(&)`, `:is(.dark &)`). There a selector
 * matches the element of the token as it does without them (Selectors 4,
 * §4.2 and §4.4); a token inside `:not()`, `:has()` or a list selects other
 * elements.
 */
export function isOnlyInsideIsOrWhere(tokens: readonly SelectorToken[], index: number): boolean {
  let depth = tokens[index]?.depth ?? 0;

  for (let open = index - 1; open >= 0 && depth > 0; open -= 1) {
    if (tokens[open].kind !== "open" || tokens[open].depth !== depth - 1) {
      continue;
    }

    const argument = tokens.slice(open + 1, findClosingToken(tokens, open) - 1);
    if (!isIsOrWhereOpening(tokens, open) || splitTokenList(argument, depth).length !== 1) {
      return false;
    }
    depth -= 1;
  }

  return depth === 0;
}
