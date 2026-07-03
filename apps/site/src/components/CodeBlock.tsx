import { codeBlock, tokenColor } from "./CodeBlock.styles";

const KEYWORDS = new Set([
  "import",
  "from",
  "export",
  "const",
  "let",
  "return",
  "as",
  "default",
  "interface",
  "type",
  "function",
]);

interface Token {
  readonly text: string;
  readonly cls?: string;
}

function tokenize(source: string): readonly Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    if (ch === "/" && source[i + 1] === "/") {
      let j = i;
      while (j < source.length && source[j] !== "\n") j += 1;
      tokens.push({ text: source.slice(i, j), cls: tokenColor.comment });
      i = j;
    } else if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      let j = i + 1;
      while (j < source.length && source[j] !== quote) {
        if (source[j] === "\\") j += 2;
        else j += 1;
      }
      j += 1;
      tokens.push({ text: source.slice(i, j), cls: tokenColor.string });
      i = j;
    } else if (/[0-9]/.test(ch)) {
      let j = i;
      while (j < source.length && /[0-9.]/.test(source[j])) j += 1;
      tokens.push({ text: source.slice(i, j), cls: tokenColor.number });
      i = j;
    } else if (/[A-Za-z_$]/.test(ch)) {
      let j = i;
      while (j < source.length && /[A-Za-z0-9_$]/.test(source[j])) j += 1;
      const word = source.slice(i, j);
      if (KEYWORDS.has(word)) {
        tokens.push({ text: word, cls: tokenColor.keyword });
      } else if (source[j] === "(") {
        tokens.push({ text: word, cls: tokenColor.fn });
      } else {
        tokens.push({ text: word });
      }
      i = j;
    } else if (/[(){}[\],;:.<>=]/.test(ch)) {
      tokens.push({ text: ch, cls: tokenColor.punct });
      i += 1;
    } else {
      tokens.push({ text: ch });
      i += 1;
    }
  }
  return tokens;
}

export interface CodeBlockProps {
  readonly children: string;
  readonly language?: string;
  readonly filename?: string;
  readonly size?: "xs" | "sm" | "md";
  readonly wrap?: boolean;
}

export const CodeBlock = ({
  children,
  language = "ts",
  filename,
  size = "md",
  wrap = false,
}: CodeBlockProps): JSX.Element => {
  const slots = codeBlock({ size, wrap: wrap ? "yes" : "no" });
  const tokens = tokenize(children);
  return (
    <div className={slots.root}>
      <div className={slots.header}>
        <span className={slots.filename}>{filename ?? "—"}</span>
        <span className={slots.language}>{language}</span>
      </div>
      <pre className={slots.pre}>
        <code className={slots.code}>
          {tokens.map((tok, idx) => (
            <span key={`${tok.text}-${String(idx)}`} className={tok.cls}>
              {tok.text}
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
};
