import { useEffect, useRef, useState } from "react";
import { App } from "@modelcontextprotocol/ext-apps";
import type { PocSnapshot } from "../../shared/poc-types.js";
import { PocScene, webglAvailable } from "./PocScene.js";

const IDLE_MESSAGE = "Waiting for the next observable Mission Control activity.";

type Activity =
  | { kind: "idle" }
  | { kind: "working"; label: string }
  | { kind: "succeeded"; label: string }
  | { kind: "failed"; label: string; detail: string };

function isSnapshot(value: unknown): value is PocSnapshot {
  return (
    typeof value === "object" &&
    value !== null &&
    "eventCount" in value &&
    "serverStartCount" in value &&
    "recentEvents" in value
  );
}

export function PocApp() {
  const appRef = useRef<App | null>(null);
  const [connected, setConnected] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<PocSnapshot | null>(null);
  const [activity, setActivity] = useState<Activity>({ kind: "idle" });
  const [hasWebgl] = useState(() => webglAvailable());
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const app = new App({ name: "Claude Mission Control PoC", version: "0.0.1" });
    appRef.current = app;

    app.ontoolresult = (result) => {
      const structured = (result as { structuredContent?: unknown }).structuredContent;
      if (isSnapshot(structured)) {
        setSnapshot(structured);
      }
    };

    app
      .connect()
      .then(() => setConnected(true))
      .catch((error: unknown) => {
        setConnectError(error instanceof Error ? error.message : String(error));
      });
  }, []);

  async function handleRecordEvent() {
    const app = appRef.current;
    if (!app) return;
    setActivity({ kind: "working", label: "Recording test event (record_poc_event)…" });
    try {
      const result = await app.callServerTool({
        name: "record_poc_event",
        arguments: { label: "Manual test event from the PoC dashboard" },
      });
      const structured = (result as { structuredContent?: unknown }).structuredContent;
      if (isSnapshot(structured)) {
        setSnapshot(structured);
        setActivity({ kind: "succeeded", label: "record_poc_event succeeded" });
      } else {
        setActivity({
          kind: "failed",
          label: "record_poc_event returned an unexpected result",
          detail: "The tool result did not include the expected state snapshot.",
        });
      }
    } catch (error) {
      setActivity({
        kind: "failed",
        label: "record_poc_event failed",
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const lastEvent = snapshot?.recentEvents[snapshot.recentEvents.length - 1];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: 12, gap: 12 }}>
      <header>
        <div style={{ fontSize: 16, fontWeight: 600 }}>
          Claude Mission Control — Phase 0 platform proof
        </div>
        <div style={{ color: "var(--muted)", marginTop: 2 }}>
          This proof of concept shows only saved PoC state and observable PoC tool activity. It does
          not display Claude&apos;s reasoning or conversation history.
        </div>
      </header>

      <div style={{ display: "flex", gap: 12, flex: 1, minHeight: 260 }}>
        <section
          aria-label="3D test scene"
          style={{
            flex: "1 1 55%",
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            overflow: "hidden",
            position: "relative",
          }}
        >
          {hasWebgl ? (
            <PocScene
              eventCount={snapshot?.eventCount ?? 0}
              lastEventAt={lastEvent?.occurredAt ?? null}
              reducedMotion={reducedMotion}
            />
          ) : (
            <div style={{ padding: 16, color: "var(--muted)" }}>
              WebGL is not available in this environment, so the 3D test scene cannot render. All
              status information remains available in the panel on the right.
            </div>
          )}
          <label
            style={{
              position: "absolute",
              bottom: 8,
              left: 8,
              color: "var(--muted)",
              display: "flex",
              gap: 6,
              alignItems: "center",
            }}
          >
            <input
              type="checkbox"
              checked={reducedMotion}
              onChange={(e) => setReducedMotion(e.target.checked)}
            />
            Reduce motion
          </label>
        </section>

        <section
          aria-label="Exact status panel"
          style={{
            flex: "1 1 45%",
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: 12,
            display: "flex",
            flexDirection: "column",
            gap: 10,
            overflow: "auto",
          }}
        >
          <div>
            <div style={{ color: "var(--muted)" }}>Connection</div>
            {connectError ? (
              <div style={{ color: "var(--err)" }}>Failed to connect to host: {connectError}</div>
            ) : (
              <div style={{ color: connected ? "var(--ok)" : "var(--muted)" }}>
                {connected ? "Connected to Claude Desktop host" : "Connecting to host…"}
              </div>
            )}
          </div>

          <div>
            <div style={{ color: "var(--muted)" }}>Current activity</div>
            {activity.kind === "idle" && <div>{IDLE_MESSAGE}</div>}
            {activity.kind === "working" && <div style={{ color: "var(--accent)" }}>{activity.label}</div>}
            {activity.kind === "succeeded" && <div style={{ color: "var(--ok)" }}>{activity.label}</div>}
            {activity.kind === "failed" && (
              <div style={{ color: "var(--err)" }}>
                {activity.label}
                <div style={{ color: "var(--muted)" }}>{activity.detail}</div>
              </div>
            )}
          </div>

          <div>
            <div style={{ color: "var(--muted)" }}>Saved PoC state</div>
            {snapshot ? (
              <ul style={{ margin: "4px 0", paddingLeft: 18 }}>
                <li>Recorded test events: {snapshot.eventCount}</li>
                <li>Server starts (persisted): {snapshot.serverStartCount}</li>
                <li>State first created: {new Date(snapshot.createdAt).toLocaleString()}</li>
                <li style={{ wordBreak: "break-all" }}>State file: {snapshot.stateFilePath}</li>
              </ul>
            ) : (
              <div style={{ color: "var(--muted)" }}>
                No state received yet. This panel fills in when a Mission Control PoC tool returns.
              </div>
            )}
          </div>

          <div>
            <div style={{ color: "var(--muted)" }}>Recent test events</div>
            {snapshot && snapshot.recentEvents.length > 0 ? (
              <ol style={{ margin: "4px 0", paddingLeft: 18 }}>
                {snapshot.recentEvents
                  .slice()
                  .reverse()
                  .map((event) => (
                    <li key={event.id}>
                      {event.label} — {new Date(event.occurredAt).toLocaleTimeString()}
                    </li>
                  ))}
              </ol>
            ) : (
              <div style={{ color: "var(--muted)" }}>No test events recorded yet.</div>
            )}
          </div>

          <button
            onClick={handleRecordEvent}
            disabled={!connected || activity.kind === "working"}
            style={{
              marginTop: "auto",
              padding: "8px 12px",
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: "#1c2836",
              color: "var(--text)",
              cursor: connected ? "pointer" : "not-allowed",
              font: "inherit",
            }}
          >
            Record test event (calls record_poc_event)
          </button>
        </section>
      </div>
    </div>
  );
}
