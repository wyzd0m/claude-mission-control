// UI side of Claude Mission Control.
//
// Architecture contract (docs/SYSTEM_ARCHITECTURE.md): this package owns the
// dashboard (React) and, from Phase 6, the 3D facility renderer. It receives
// a read-only UI state projection and never accesses storage or the MCP
// transport directly. ESLint enforces this.

export const UI_PACKAGE_NAME = "@mission-control/ui";

export { STAGE_LABELS } from "./stage-labels.js";
export { DashboardApp } from "./DashboardApp.js";
export type { HostBridge, ToolResponse, ToolError } from "./bridge.js";
