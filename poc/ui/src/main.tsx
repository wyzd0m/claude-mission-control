import { createRoot } from "react-dom/client";
import { PocApp } from "./PocApp.js";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Missing #root element");
}
createRoot(rootElement).render(<PocApp />);
