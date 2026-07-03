import { siteTheme, siteTokens } from "../spike/theme";

const RESET = `
*, *::before, *::after { box-sizing: border-box; }
html, body, #root { margin: 0; padding: 0; min-height: 100%; }
html { background: ${siteTokens["color-bg"]}; color-scheme: dark; }
body {
  background: radial-gradient(circle at 18% -10%, rgba(124, 140, 255, 0.20), transparent 55%),
              radial-gradient(circle at 92% 0%, rgba(58, 210, 159, 0.10), transparent 50%),
              ${siteTokens["color-bg"]};
  color: ${siteTokens["color-fg"]};
  font-family: ${siteTokens["font-body"]};
  font-size: 16px;
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
h1, h2, h3, h4 { font-family: ${siteTokens["font-display"]}; margin: 0; letter-spacing: -0.01em; }
p { margin: 0; color: ${siteTokens["color-fg-muted"]}; }
a { color: ${siteTokens["color-accent"]}; text-decoration: none; }
a:where(:not([class])):hover { text-decoration: underline; }
code, pre, kbd { font-family: ${siteTokens["font-mono"]}; }
button { font-family: inherit; }
::selection { background: ${siteTokens["color-accent-soft"]}; color: ${siteTokens["color-fg"]}; }
@media (prefers-reduced-motion: no-preference) {
  html { scroll-behavior: smooth; }
}
`;

export function mountGlobal(): void {
  document.documentElement.classList.add(siteTheme);
  const styleEl = document.createElement("style");
  styleEl.setAttribute("data-dx-site-reset", "true");
  styleEl.textContent = RESET;
  document.head.appendChild(styleEl);
}
