import { createRoot } from "react-dom/client";
import { DashboardApp } from "./DashboardApp.js";
import { createExtAppsBridge } from "./bridge.js";
import { createDemoBridge } from "./demo-bridge.js";
import "./styles.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Missing #root element");
}

// `?demo` renders clearly labeled sample data for layout inspection in a
// plain browser. MCP hosts never add the parameter.
const demo = new URLSearchParams(window.location.search).has("demo");
createRoot(rootElement).render(
  <DashboardApp bridge={demo ? createDemoBridge() : createExtAppsBridge()} />,
);
