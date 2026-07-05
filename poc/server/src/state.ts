import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { PocSnapshot, PocState, PocTestEvent } from "../../shared/poc-types.js";
import { POC_VERSION } from "../../shared/poc-types.js";
import { resolveDataDir, stateFilePath } from "./paths.js";

const MAX_EVENTS = 50;
const RECENT_EVENTS_IN_SNAPSHOT = 10;

const testEventSchema = z.object({
  id: z.string(),
  label: z.string(),
  occurredAt: z.string(),
});

const stateSchema = z.object({
  schemaVersion: z.literal(1),
  createdAt: z.string(),
  serverStartCount: z.number().int().nonnegative(),
  testEvents: z.array(testEventSchema),
});

function freshState(): PocState {
  return {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    serverStartCount: 0,
    testEvents: [],
  };
}

/**
 * Load persisted PoC state. A corrupt file is preserved under a
 * `.corrupt-<timestamp>` suffix instead of being silently destroyed, and a
 * fresh state is started. Errors are logged to stderr (stdout belongs to the
 * MCP stdio transport).
 */
export function loadState(): PocState {
  const file = stateFilePath();
  if (!fs.existsSync(file)) {
    return freshState();
  }
  try {
    const raw = fs.readFileSync(file, "utf-8");
    return stateSchema.parse(JSON.parse(raw));
  } catch (error) {
    const backup = `${file}.corrupt-${Date.now()}`;
    try {
      fs.renameSync(file, backup);
      console.error(`[poc] State file was invalid; preserved it at ${backup}`, error);
    } catch (renameError) {
      console.error(`[poc] State file was invalid and could not be preserved`, renameError);
    }
    return freshState();
  }
}

/** Atomic write: write to a temp file in the same directory, then rename. */
export function saveState(state: PocState): void {
  const file = stateFilePath();
  const dir = resolveDataDir();
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.poc-state.${process.pid}.${Date.now()}.tmp`);
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2), "utf-8");
  fs.renameSync(tmp, file);
}

export function noteServerStart(): PocState {
  const state = loadState();
  state.serverStartCount += 1;
  saveState(state);
  return state;
}

export function recordTestEvent(label: string): PocState {
  const state = loadState();
  const event: PocTestEvent = {
    id: randomUUID(),
    label,
    occurredAt: new Date().toISOString(),
  };
  state.testEvents.push(event);
  if (state.testEvents.length > MAX_EVENTS) {
    state.testEvents = state.testEvents.slice(-MAX_EVENTS);
  }
  saveState(state);
  return state;
}

export function toSnapshot(state: PocState): PocSnapshot {
  return {
    pocVersion: POC_VERSION,
    stateFilePath: stateFilePath(),
    createdAt: state.createdAt,
    serverStartCount: state.serverStartCount,
    eventCount: state.testEvents.length,
    recentEvents: state.testEvents.slice(-RECENT_EVENTS_IN_SNAPSHOT),
  };
}
