// Types shared between the PoC server and the PoC UI.
// Phase 0 keeps this deliberately small: one persisted state shape and the
// snapshot the server returns from its tools.

export const POC_VERSION = "0.0.1";

export interface PocTestEvent {
  id: string;
  label: string;
  occurredAt: string;
}

export interface PocState {
  schemaVersion: 1;
  createdAt: string;
  serverStartCount: number;
  testEvents: PocTestEvent[];
}

/** What the tools return and the UI renders. Contains no conversation data. */
export interface PocSnapshot {
  pocVersion: string;
  stateFilePath: string;
  createdAt: string;
  serverStartCount: number;
  eventCount: number;
  recentEvents: PocTestEvent[];
}
