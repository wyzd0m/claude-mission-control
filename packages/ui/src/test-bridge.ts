import type { ActivityEvent, DashboardState, Department } from "@mission-control/domain";
import type { HostBridge, ToolResponse } from "./bridge.js";

// Animation test bridge, activated by opening the built file with `?test`
// (D-030). It keeps the robot fleet continuously busy with clearly labeled
// synthetic events cycling through every department and outcome, plus a
// periodic Security Gate wait — a treadmill for inspecting travel, gestures,
// outcomes, and gate behavior in a plain browser. Like `?demo`, it is never
// used inside an MCP host: the host never adds the query parameter.

const DEPARTMENT_CYCLE: Department[] = [
  "planning_bay",
  "build_workshop",
  "memory_vault",
  "testing_lab",
  "research_archive",
  "delivery_dock",
  "security_gate",
  "command_core",
];

const OUTCOME_CYCLE = ["succeeded", "succeeded", "failed", "succeeded", "cancelled"] as const;

// Every poll is 2.5 s. One synthetic event per poll keeps three robots in
// steady rotation; every 12th poll opens a gate wait for three polls.
const GATE_PERIOD = 12;
const GATE_HOLD_POLLS = 3;

function baseState(): DashboardState {
  const at = new Date().toISOString();
  return {
    generatedAt: at,
    serverVersion: "0.1.0 (animation test)",
    projects: [],
    activeProjectId: null,
    activeProject: null,
    projectProgress: null,
    tasks: [],
    decisions: [],
    latestCheckpoint: null,
    currentActivity: {
      openEvents: [],
      idle: true,
      idleMessage: "Animation test: waiting for the next synthetic event.",
    },
    timeline: [],
  };
}

function syntheticEvent(sequence: number): ActivityEvent {
  const department = DEPARTMENT_CYCLE[sequence % DEPARTMENT_CYCLE.length]!;
  const status = OUTCOME_CYCLE[sequence % OUTCOME_CYCLE.length]!;
  const at = new Date().toISOString();
  return {
    id: `test-event-${sequence}`,
    projectId: null,
    correlationId: `test-corr-${sequence}`,
    toolName: "animation_test",
    displayLabel: `Animation test ${sequence + 1}: ${department} (${status})`,
    department,
    status,
    startedAt: at,
    updatedAt: at,
    completedAt: at,
    progressCurrent: null,
    progressTotal: null,
    progressMessage: null,
    relatedTaskIds: [],
    requiresInput: false,
    resultSummary: status === "succeeded" ? "Synthetic sample event." : null,
    errorCode: status === "failed" ? "SAMPLE_FAILURE" : null,
    errorSummary: status === "failed" ? "Synthetic sample failure." : null,
  };
}

function gateWaitEvent(epoch: number): ActivityEvent {
  return {
    ...syntheticEvent(0),
    id: `test-wait-${epoch}`,
    correlationId: `test-wait-corr-${epoch}`,
    toolName: "animation_test_gate",
    displayLabel: "Animation test: synthetic approval wait",
    department: "security_gate",
    status: "waiting_for_input",
    requiresInput: true,
    completedAt: null,
    resultSummary: null,
    errorCode: null,
    errorSummary: null,
  };
}

export function createTestBridge(): HostBridge {
  const state = baseState();
  let polls = 0;
  let sequence = 0;

  return {
    callTool(name: string): Promise<ToolResponse> {
      if (name === "get_mission_control_state") {
        const at = new Date().toISOString();
        state.timeline = [syntheticEvent(sequence), ...state.timeline].slice(0, 12);
        sequence += 1;
        const gatePhase = polls % GATE_PERIOD;
        const waiting = gatePhase < GATE_HOLD_POLLS;
        state.currentActivity = {
          openEvents: waiting ? [gateWaitEvent(Math.floor(polls / GATE_PERIOD))] : [],
          idle: !waiting,
          idleMessage: waiting ? null : "Animation test: waiting for the next synthetic event.",
        };
        state.generatedAt = at;
        polls += 1;
      }
      return Promise.resolve({ ok: true, state: { ...state } });
    },
    onInitialState(listener) {
      listener(state);
    },
    onConnection(listener) {
      listener({
        connected: true,
        detail:
          "Animation test mode: continuous synthetic sample events exercise the robots. Not real activity.",
      });
    },
  };
}
