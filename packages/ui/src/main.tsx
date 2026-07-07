import { createRoot } from "react-dom/client";
import { DashboardApp } from "./DashboardApp.js";
import { createExtAppsBridge } from "./bridge.js";
import { createDemoBridge } from "./demo-bridge.js";
import { createMonitorBridge } from "./monitor-bridge.js";
import "./styles.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Missing #root element");
}

// `?monitor` is added by the standalone monitor process (read-only window);
// `?demo` renders clearly labeled sample data for layout inspection in a
// plain browser. MCP hosts never add either parameter.
const params = new URLSearchParams(window.location.search);
const monitor = params.has("monitor");
const demo = params.has("demo");
const bridge = monitor ? createMonitorBridge() : demo ? createDemoBridge() : createExtAppsBridge();
createRoot(rootElement).render(<DashboardApp bridge={bridge} readOnly={monitor} />);
