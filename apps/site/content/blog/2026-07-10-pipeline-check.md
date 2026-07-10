---
title: Pipeline check
description: Internal draft used to exercise the blog build pipeline. Never published.
date: 2026-07-10
draft: true
---

This draft exists to test the markdown pipeline end to end. It stays out of the
index, the RSS feed, and the sitemap unless the build runs with `BLOG_DRAFTS=1`.

## Code blocks

```ts
import { css } from "dx-styles";

export const box = css({
  display: "grid",
  gap: "12px",
});
```

## Lists and links

- Inline `code` and **bold** text
- A [link to the docs](https://github.com/dx-styles/dx-styles/tree/main/docs)

> A quote block, for good measure.
