// Server side of Claude Mission Control.
//
// Architecture contract (docs/SYSTEM_ARCHITECTURE.md): this package will own
// the MCP adapter, application services, the storage adapter (SQLite +
// migrations), and the activity event service. It depends on the domain core
// and must never import React or Three.js. ESLint enforces this.
//
// Phase 1 establishes the package skeleton only. MCP tools are Phase 3 work;
// this placeholder proves the cross-package build wiring.

import { DOMAIN_PACKAGE_NAME } from "@mission-control/domain";

export const SERVER_PACKAGE_NAME = "@mission-control/server";

export function describeWiring(): string {
  return `${SERVER_PACKAGE_NAME} -> ${DOMAIN_PACKAGE_NAME}`;
}
