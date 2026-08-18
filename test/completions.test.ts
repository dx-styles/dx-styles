import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

/**
 * Regression tests for https://github.com/dx-styles/dx-styles/issues/26.
 *
 * Editors drive IntelliSense through the TypeScript language service, so these
 * tests query it directly instead of asserting on type shapes. Two failure
 * modes are covered:
 *
 * 1. `String` members leaking into object literals. Any `string & { brand }`
 *    member of `StylePart` is an object type whose apparent type is `String`,
 *    so TypeScript offers `charAt`, `blink`, and friends as style properties.
 * 2. Falling back to the global identifier list, which is what happens when the
 *    contextual type has no known keys at all.
 */

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const probeFileName = join(projectRoot, "__completions_probe__.ts");
const MARKER = "/*|*/";

// TypeScript normalizes root file names to forward slashes before calling the
// host, while path.join emits backslashes on Windows — a strict string
// comparison would silently drop the virtual probe from the program there.
function isProbePath(fileName: string): boolean {
  return (
    fileName.replaceAll("\\", "/").toLowerCase() ===
    probeFileName.replaceAll("\\", "/").toLowerCase()
  );
}

const IMPORTS = `import { css, recipe, slotRecipe } from "./src/index";\n`;

const compilerOptions: ts.CompilerOptions = {
  jsx: ts.JsxEmit.ReactJSX,
  lib: ["lib.es2023.d.ts", "lib.dom.d.ts"],
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  noEmit: true,
  skipLibCheck: true,
  strict: true,
  target: ts.ScriptTarget.ES2022,
};

let probeText = "";
let probeVersion = 0;

const host: ts.LanguageServiceHost = {
  fileExists: (fileName) => ts.sys.fileExists(fileName),
  getCompilationSettings: () => compilerOptions,
  getCurrentDirectory: () => projectRoot,
  getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
  getDirectories: (directoryName) => ts.sys.getDirectories(directoryName),
  getScriptFileNames: () => [probeFileName],
  getScriptSnapshot: (fileName) => {
    if (isProbePath(fileName)) {
      return ts.ScriptSnapshot.fromString(probeText);
    }

    return existsSync(fileName)
      ? ts.ScriptSnapshot.fromString(readFileSync(fileName, "utf8"))
      : undefined;
  },
  getScriptVersion: (fileName) =>
    isProbePath(fileName) ? String(probeVersion) : "1",
  readDirectory: (path, extensions, exclude, include, depth) =>
    ts.sys.readDirectory(path, extensions, exclude, include, depth),
  readFile: (path, encoding) => ts.sys.readFile(path, encoding),
};

const service = ts.createLanguageService(host, ts.createDocumentRegistry());

function setProbe(body: string): number {
  const source = IMPORTS + body;

  probeText = source.replace(MARKER, "");
  probeVersion += 1;

  return source.indexOf(MARKER);
}

function completionsAt(body: string): string[] {
  const offset = setProbe(body);

  if (offset === -1) {
    throw new Error(`Probe is missing the ${MARKER} marker.`);
  }

  const completions = service.getCompletionsAtPosition(probeFileName, offset, {});

  return completions?.entries.map((entry) => entry.name) ?? [];
}

function diagnosticsFor(body: string): string[] {
  setProbe(body);

  return service
    .getSemanticDiagnostics(probeFileName)
    .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, " "));
}

/** Members of `String` that a `string & { brand }` union member leaks. */
const STRING_MEMBERS = [
  "blink",
  "charAt",
  "concat",
  "endsWith",
  "fontcolor",
  "padStart",
  "substr",
  "toLowerCase",
];

/** Properties every editor should offer inside a style object. */
const CSS_PROPERTIES = [
  "alignItems",
  "backgroundColor",
  "color",
  "display",
  "gridTemplateColumns",
  "padding",
];

/** Present only when TypeScript gave up and listed globals instead. */
const GLOBAL_FALLBACK_MARKER = "AbortController";

const KEY_POSITIONS: Record<string, string> = {
  "css()": `css({ ${MARKER} });`,
  'css() inside "&:hover"': `css({ "&:hover": { ${MARKER} } });`,
  "css() inside @media": `css({ "@media (min-width: 0)": { ${MARKER} } });`,
  "recipe() base": `recipe({ base: { ${MARKER} } });`,
  "recipe() variant value": `recipe({ variants: { size: { small: { ${MARKER} } } } });`,
  "slotRecipe() slot base": `slotRecipe<"root">({ base: { root: { ${MARKER} } } });`,
};

describe("style object completions", () => {
  for (const [label, body] of Object.entries(KEY_POSITIONS)) {
    describe(label, () => {
      it("offers CSS properties", () => {
        const names = completionsAt(body);

        for (const property of CSS_PROPERTIES) {
          expect(names).toContain(property);
        }
      });

      it("does not leak String members", () => {
        const names = completionsAt(body);
        const leaked = STRING_MEMBERS.filter((member) => names.includes(member));

        expect(leaked).toEqual([]);
      });

      it("does not fall back to global identifiers", () => {
        expect(completionsAt(body)).not.toContain(GLOBAL_FALLBACK_MARKER);
      });
    });
  }

  it("offers the $rtl and $noflip markers", () => {
    const names = completionsAt(`css({ ${MARKER} });`);

    expect(names).toContain("$rtl");
    expect(names).toContain("$noflip");
  });

  it("offers CSS values, not globals, in value position", () => {
    const names = completionsAt(`css({ display: ${MARKER} });`);

    expect(names).toContain('"flex"');
    expect(names).toContain('"grid"');
    expect(names).toContain('"block"');
  });
});

describe("style object stays open for authoring", () => {
  const accepted: Record<string, string> = {
    "CSS custom properties": `css({ "--brand": "red" });`,
    "at-rules": `css({ "@media (min-width: 0)": { color: "red" } });`,
    "composing a previous css() result": `const base = css({ color: "red" }); css(base, { padding: 4 });`,
    "fallback value arrays": `css({ color: ["red", "var(--brand)"] });`,
    "nested selectors": `css({ "&:hover": { color: "red" } });`,
    "numeric lengths": `css({ minHeight: 40, padding: 4, zIndex: 1 });`,
    "properties csstype does not know": `css({ paddingStart: 4 });`,
    "the $rtl marker": `css({ $rtl: true, paddingLeft: "8px" });`,
  };

  for (const [label, body] of Object.entries(accepted)) {
    it(`accepts ${label}`, () => {
      expect(diagnosticsFor(body)).toEqual([]);
    });
  }
});

describe("style object still rejects what the runtime throws on", () => {
  const rejected: Record<string, string> = {
    "a boolean value on a real property": `css({ color: true });`,
    "an arbitrary class-name string": `css("not-a-dx-class");`,
    "the $rtl marker set to false": `css({ $rtl: false });`,
  };

  for (const [label, body] of Object.entries(rejected)) {
    it(`rejects ${label}`, () => {
      expect(diagnosticsFor(body).length).toBeGreaterThan(0);
    });
  }
});
