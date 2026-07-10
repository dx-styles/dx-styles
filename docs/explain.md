# Explain Tooling

The extraction pipeline can emit `dx-styles:explain` metadata that maps generated classes back to
authoring symbols, variant branches, source locations, and composition edges.

Run the repository helper against a WyW metadata artifact:

```sh
bun run explain -- path/to/file.wyw-in-js.json button_bhhycyd__tone-accent
```

Example output:

```text
class    button_bhhycyd__tone-accent
source   Button.styles.ts:8:21
symbol   button - recipe()
variant  tone="accent"
css
  background-color: var(--button-accent-bg);
```

Use explain output when reviewing CSS diffs, debugging generated class names, or tracing variant
composition.
