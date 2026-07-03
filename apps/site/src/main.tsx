import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import { mountGlobal } from "./styles/global";

mountGlobal();

const root = document.getElementById("root");
if (!root) {
  throw new Error("Root container '#root' is missing from the document.");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
