// Dashboard tests (docs/TESTING_STRATEGY.md "UI tests"): state-driven, with a
// fake host bridge. Verifies the honest idle state, exact activity display,
// error banner with recovery hints, forms calling the right tools, and the
// approval hint for waiting events.
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";

afterEach(cleanup);
import userEvent from "@testing-library/user-event";
import type { ActivityEvent, DashboardState, Project, Task } from "@mission-control/domain";
import type { HostBridge, ToolResponse } from "./bridge.js";
import { DashboardApp } from "./DashboardApp.js";

const NOW = "2026-07-05T12:00:00.000Z";

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: "p1",
    name: "Demo",
    description: "",
    goal: "Ship v1",
    definitionOfDone: "",
    currentStage: "building",
    status: "active",
    revision: 1,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: "t1",
    projectId: "p1",
    title: "Build login screen",
    description: "",
    status: "todo",
    priority: "medium",
    stage: "building",
    blockedReason: null,
    parentTaskId: null,
    revision: 1,
    createdAt: NOW,
    updatedAt: NOW,
    completedAt: null,
    ...overrides,
  };
}

function event(overrides: Partial<ActivityEvent> = {}): ActivityEvent {
  return {
    id: "e1",
    projectId: "p1",
    correlationId: "c1",
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
    relatedTaskIds: [],
    requiresInput: false,
    resultSummary: "Created task",
    errorCode: null,
    errorSummary: null,
    ...overrides,
  };
}

function dashboardState(overrides: Partial<DashboardState> = {}): DashboardState {
  const p = project();
  return {
    generatedAt: NOW,
    serverVersion: "0.1.0",
    projects: [
      { id: p.id, name: p.name, currentStage: p.currentStage, status: p.status, updatedAt: NOW },
    ],
    activeProjectId: p.id,
    activeProject: p,
    projectProgress: { doneTasks: 1, totalTasks: 3 },
    tasks: [task()],
    decisions: [],
    latestCheckpoint: null,
    currentActivity: {
      openEvents: [],
      idle: true,
      idleMessage: "Waiting for the next observable Mission Control activity.",
    },
    timeline: [event()],
    ...overrides,
  };
}

class FakeBridge implements HostBridge {
  calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  responses = new Map<string, ToolResponse>();
  private stateListener: ((state: DashboardState) => void) | null = null;

  constructor(private state: DashboardState) {
    this.responses.set("get_mission_control_state", { ok: true, state });
  }

  callTool(name: string, args: Record<string, unknown> = {}): Promise<ToolResponse> {
    this.calls.push({ name, args });
    return Promise.resolve(this.responses.get(name) ?? { ok: true });
  }

  onInitialState(listener: (state: DashboardState) => void): void {
    this.stateListener = listener;
    listener(this.state);
  }

  onConnection(listener: (status: { connected: boolean }) => void): void {
    listener({ connected: true });
  }

  pushState(state: DashboardState): void {
    this.responses.set("get_mission_control_state", { ok: true, state });
    this.stateListener?.(state);
  }
}

describe("DashboardApp", () => {
  it("shows the project header, stage, and explicit progress", async () => {
    const bridge = new FakeBridge(dashboardState());
    render(<DashboardApp bridge={bridge} />);
    expect(await screen.findByText("Claude Mission Control")).toBeDefined();
    const stageBar = screen.getByRole("navigation", { name: "Project stage" });
    const current = within(stageBar).getByText("Building");
    expect(current.getAttribute("aria-current")).toBe("step");
    expect(screen.getByText(/Task completion: 1 of 3 tasks done/)).toBeDefined();
  });

  it("shows the honest idle message when nothing is observable", async () => {
    const bridge = new FakeBridge(dashboardState());
    render(<DashboardApp bridge={bridge} />);
    expect(
      await screen.findByText("Waiting for the next observable Mission Control activity."),
    ).toBeDefined();
  });

  it("shows waiting approvals with working Approve/Reject buttons (D-033)", async () => {
    const user = userEvent.setup();
    const waiting = event({
      id: "e2",
      status: "waiting_for_input",
      requiresInput: true,
      completedAt: null,
      resultSummary: null,
      displayLabel: "Awaiting approval: bulk task update",
      department: "security_gate",
    });
    const bridge = new FakeBridge(
      dashboardState({
        currentActivity: { openEvents: [waiting], idle: false, idleMessage: null },
      }),
    );
    render(<DashboardApp bridge={bridge} />);
    expect(await screen.findByText("Waiting for your approval")).toBeDefined();
    expect(screen.getByText(/Approve or reject it here/)).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Approve" }));
    await waitFor(() => {
      expect(
        bridge.calls.some((c) => c.name === "approve_pending_operation" && c.args.eventId === "e2"),
      ).toBe(true);
    });
  });

  it("keeps approvals read-only in monitor mode (no buttons, conversation hint)", async () => {
    const waiting = event({
      id: "e3",
      status: "waiting_for_input",
      requiresInput: true,
      completedAt: null,
      resultSummary: null,
      displayLabel: "Awaiting approval: bulk task update",
      department: "security_gate",
    });
    const bridge = new FakeBridge(
      dashboardState({
        currentActivity: { openEvents: [waiting], idle: false, idleMessage: null },
      }),
    );
    render(<DashboardApp bridge={bridge} readOnly />);
    expect(await screen.findByText("Waiting for your approval")).toBeDefined();
    expect(screen.getByText(/Approve or reject it in the conversation/)).toBeDefined();
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
  });

  it("creates a task through the form and refreshes state", async () => {
    const user = userEvent.setup();
    const bridge = new FakeBridge(dashboardState());
    render(<DashboardApp bridge={bridge} />);
    await screen.findByLabelText("New task");

    await user.type(screen.getByLabelText("New task"), "Write docs");
    await user.click(screen.getByRole("button", { name: "Add task" }));

    await waitFor(() => {
      expect(bridge.calls.some((c) => c.name === "create_task")).toBe(true);
    });
    const createCall = bridge.calls.find((c) => c.name === "create_task")!;
    expect(createCall.args.title).toBe("Write docs");
    expect(bridge.calls.at(-1)!.name).toBe("get_mission_control_state");
  });

  it("changes a task status through the exact tool", async () => {
    const user = userEvent.setup();
    const bridge = new FakeBridge(dashboardState());
    render(<DashboardApp bridge={bridge} />);
    const select = await screen.findByLabelText("Status of task Build login screen");

    await user.selectOptions(select, "in_progress");
    await waitFor(() => {
      expect(bridge.calls.some((c) => c.name === "update_task")).toBe(true);
    });
    const call = bridge.calls.find((c) => c.name === "update_task")!;
    expect(call.args).toMatchObject({ taskId: "t1", status: "in_progress" });
  });

  it("surfaces tool errors verbatim with code and recovery", async () => {
    const user = userEvent.setup();
    const bridge = new FakeBridge(dashboardState());
    bridge.responses.set("update_project_stage", {
      ok: false,
      error: {
        code: "REVISION_CONFLICT",
        message: "The project changed in another conversation.",
        recovery: "Refresh and try again.",
      },
    });
    render(<DashboardApp bridge={bridge} />);
    const stageSelect = await screen.findByLabelText("Change project stage");

    await user.selectOptions(stageSelect, "testing");
    const banner = await screen.findByRole("alert");
    expect(banner.textContent).toContain("REVISION_CONFLICT");
    expect(banner.textContent).toContain("Refresh and try again.");

    await user.click(within(banner).getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("renders failed events with their exact error code", async () => {
    const bridge = new FakeBridge(
      dashboardState({
        timeline: [
          event({
            id: "e3",
            status: "failed",
            resultSummary: null,
            errorCode: "PROJECT_NOT_FOUND",
            errorSummary: "The selected project no longer exists.",
          }),
        ],
      }),
    );
    render(<DashboardApp bridge={bridge} />);
    expect(await screen.findByText(/PROJECT_NOT_FOUND:/)).toBeDefined();
  });

  it("saves a checkpoint from the checkpoint tab", async () => {
    const user = userEvent.setup();
    const bridge = new FakeBridge(dashboardState());
    render(<DashboardApp bridge={bridge} />);
    await user.click(await screen.findByRole("tab", { name: "Checkpoint" }));

    await user.type(screen.getByLabelText("Summary"), "End of session");
    await user.type(screen.getByLabelText("Next action"), "Start phase 6");
    await user.click(screen.getByRole("button", { name: "Save checkpoint" }));

    await waitFor(() => {
      expect(bridge.calls.some((c) => c.name === "save_checkpoint")).toBe(true);
    });
    const call = bridge.calls.find((c) => c.name === "save_checkpoint")!;
    expect(call.args).toMatchObject({
      summary: "End of session",
      recommendedNextAction: "Start phase 6",
    });
  });

  it("polls the read model for live updates while visible (D-024)", async () => {
    vi.useFakeTimers();
    try {
      const bridge = new FakeBridge(dashboardState());
      render(<DashboardApp bridge={bridge} />);
      const countStateCalls = () =>
        bridge.calls.filter((c) => c.name === "get_mission_control_state").length;
      const before = countStateCalls();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2600);
      });
      expect(countStateCalls()).toBe(before + 1);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2600);
      });
      expect(countStateCalls()).toBe(before + 2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("renders read-only monitor mode: banner shown, mutating controls gone", async () => {
    const bridge = new FakeBridge(dashboardState());
    render(<DashboardApp bridge={bridge} readOnly />);
    expect(await screen.findByText("Monitor mode")).toBeDefined();
    // No task form, no status selects; status shows as plain text.
    expect(screen.queryByLabelText("New task")).toBeNull();
    expect(screen.queryByLabelText("Status of task Build login screen")).toBeNull();
    expect(screen.getByText("todo")).toBeDefined();
    // Header selects are disabled.
    const stageSelect = screen.getByLabelText<HTMLSelectElement>("Change project stage");
    expect(stageSelect.disabled).toBe(true);
    // Refresh stays available.
    expect(screen.getByRole("button", { name: "Refresh" })).toBeDefined();
  });

  it("shows diagnostics including server version and truthfulness note", async () => {
    const user = userEvent.setup();
    const bridge = new FakeBridge(dashboardState());
    render(<DashboardApp bridge={bridge} />);
    await user.click(await screen.findByRole("tab", { name: "Diagnostics" }));
    expect(screen.getByText(/Server version: 0\.1\.0/)).toBeDefined();
    expect(screen.getByText(/no access to Claude's reasoning/i)).toBeDefined();
  });
});
