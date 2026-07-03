# RTL Authoring

Prefer logical CSS properties for layouts that follow document direction.

```ts
export const item = css({
  paddingInlineStart: "12px",
  insetInlineEnd: 0,
  textAlign: "start",
});
```

When a style object needs physical declarations and those declarations can be mirrored safely, mark
that subtree with `$rtl: true`.

```ts
export const arrow = css({
  $rtl: true,
  left: 0,
  marginLeft: "4px",
  paddingRight: "8px",
  textAlign: "left",
});
```

The extractor emits the authored declarations and a sibling `:dir(rtl) &` override in the same
selector or at-rule scope. The marker is stripped from emitted CSS.

Supported mirrored declarations:

- `paddingLeft` and `paddingRight`
- `marginLeft` and `marginRight`
- `left` and `right`
- `textAlign: "left"` and `textAlign: "right"`

Use `$noflip: true` to stop an inherited transform for a nested subtree.

```ts
export const icon = css({
  $rtl: true,
  paddingLeft: "8px",
  "&::before": {
    $noflip: true,
    left: 0,
  },
});
```

Shorthands, border families, transforms, shadows, arbitrary strings, and CSS variables stay under
explicit author control.
