import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";

import { App } from "./App";
import { mountGlobal } from "./styles/global";

mountGlobal();

const root = document.getElementById("root");
if (!root) {
  throw new Error("Root container '#root' is missing from the document.");
}

const app = (
  <StrictMode>
    <App />
  </StrictMode>
);

if (root.hasChildNodes()) {
  hydrateRoot(root, app);
} else {
  createRoot(root).render(app);
}
