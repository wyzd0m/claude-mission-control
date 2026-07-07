import type { DashboardState } from "@mission-control/domain";
import type { HostBridge, ToolResponse } from "./bridge.js";

// Development-only bridge, activated by opening the built file with `?demo`.
// It renders clearly labeled sample data so the layout can be inspected in a
// plain browser. It is never used inside an MCP host: the host never adds
// the query parameter.

const NOW = new Date().toISOString();

function demoState(): DashboardState {
  return {
    generatedAt: NOW,
    serverVersion: "0.1.0 (demo data)",
    projects: [
      {
        id: "demo-project",
        name: "Demo project (sample data)",
        currentStage: "building",
        status: "active",
        updatedAt: NOW,
      },
    ],
    activeProjectId: "demo-project",
    activeProject: {
      id: "demo-project",
      name: "Demo project (sample data)",
      description: "Sample data rendered by the demo bridge.",
      goal: "Show the dashboard layout without a host",
      definitionOfDone: "",
      currentStage: "building",
      status: "active",
      revision: 3,
      createdAt: NOW,
      updatedAt: NOW,
    },
    projectProgress: { doneTasks: 2, totalTasks: 5 },
    tasks: [
      {
        id: "demo-task-1",
        projectId: "demo-project",
        title: "Design the login screen",
        description: "",
        status: "in_progress",
        priority: "high",
        stage: "building",
        blockedReason: null,
        parentTaskId: null,
        revision: 2,
        createdAt: NOW,
        updatedAt: NOW,
        completedAt: null,
      },
      {
        id: "demo-task-2",
        projectId: "demo-project",
        title: "Waiting on API keys",
        description: "",
        status: "blocked",
        priority: "medium",
        stage: "building",
        blockedReason: "Vendor has not sent credentials",
        parentTaskId: null,
        revision: 2,
        createdAt: NOW,
        updatedAt: NOW,
        completedAt: null,
      },
    ],
    decisions: [
      {
        id: "demo-decision-1",
        projectId: "demo-project",
        summary: "Use SQLite for local storage",
        rationale: "Single-user local persistence with migrations.",
        alternativesConsidered: ["JSON files", "IndexedDB"],
        relatedTaskIds: [],
        createdAt: NOW,
      },
    ],
    latestCheckpoint: {
      id: "demo-checkpoint-1",
      projectId: "demo-project",
      summary: "End of sample session",
      completedWork: ["Login screen designed"],
      openWork: ["Implement session handling"],
      decisions: ["SQLite chosen"],
      blockers: [],
      recommendedNextAction: "Implement session handling",
      createdAt: NOW,
    },
    currentActivity: {
      openEvents: [
        {
          id: "demo-event-open",
          projectId: "demo-project",
          correlationId: "demo-corr-1",
          toolName: "preview_bulk_task_update",
          displayLabel: "Awaiting approval: bulk task update",
          department: "security_gate",
          status: "waiting_for_input",
          startedAt: NOW,
          updatedAt: NOW,
          completedAt: null,
          progressCurrent: null,
          progressTotal: null,
          progressMessage: null,
          relatedTaskIds: ["demo-task-1"],
          requiresInput: true,
          resultSummary: null,
          errorCode: null,
          errorSummary: null,
        },
      ],
      idle: false,
      idleMessage: null,
    },
    timeline: [
      {
        id: "demo-event-2",
        projectId: "demo-project",
        correlationId: "demo-corr-2",
        toolName: "record_validation_result",
        displayLabel: "Recording a validation result",
        department: "testing_lab",
        status: "failed",
        startedAt: NOW,
        updatedAt: NOW,
        completedAt: NOW,
        progressCurrent: null,
        progressTotal: null,
        progressMessage: null,
        relatedTaskIds: [],
        requiresInput: false,
        resultSummary: null,
        errorCode: "ARTIFACT_NOT_FOUND",
        errorSummary: "The artifact was not found.",
      },
      {
        id: "demo-event-1",
        projectId: "demo-project",
        correlationId: "demo-corr-3",
        toolName: "create_task",
        displayLabel: "Creating a task",
        department: "planning_bay",
        status: "succeeded",
        startedAt: NOW,
        updatedAt: NOW,
        completedAt: NOW,
        progressCurrent: null,
        progressTotal: null,
        progressMessage: null,
        relatedTaskIds: ["demo-task-1"],
        requiresInput: false,
        resultSummary: 'Created task "Design the login screen".',
        errorCode: null,
        errorSummary: null,
      },
    ],
  };
}

export function createDemoBridge(): HostBridge {
  const state = demoState();
  return {
    callTool(): Promise<ToolResponse> {
      return Promise.resolve({ ok: true, state });
    },
    onInitialState(listener) {
      listener(state);
    },
    onConnection(listener) {
      listener({ connected: true, detail: "Demo bridge: sample data, no host connection." });
    },
  };
}
