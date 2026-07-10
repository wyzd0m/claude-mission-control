import { useEffect, useState } from "react";
import type { ActivityEvent, CurrentActivity } from "@mission-control/domain";
import { formatDateTime, formatTime, progressText, STATUS_TEXT } from "../format.js";
import { ROOM_ACCENTS } from "../facility/layout.js";

// The exact activity panel (docs/PRODUCT_REQUIREMENTS.md §7): shows only
// persisted Mission Control events, verbatim. When idle, it shows the honest
// idle message from the server and nothing else.

/** Live elapsed counter for an operation that is still open. */
function Elapsed({ since }: { since: string }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(since).getTime()) / 1000));
  return <> · elapsed {seconds}s</>;
}

function EventRow({
  event,
  onApprove,
  onReject,
  busy = false,
}: {
  event: ActivityEvent;
  /** Present only where dashboard approvals work (D-033): the in-chat widget. */
  onApprove?: ((eventId: string) => void) | undefined;
  onReject?: ((eventId: string) => void) | undefined;
  busy?: boolean;
}) {
  const progress = progressText(event.progressCurrent, event.progressTotal);
  const awaitingApproval = event.requiresInput && event.status === "waiting_for_input";
  return (
    <li className="event-row">
      <div className="row">
        <span className={`status-text status-${event.status}`}>{STATUS_TEXT[event.status]}</span>
        <span className="event-label">{event.displayLabel}</span>
        {event.requiresInput && <span className="badge approval">needs approval</span>}
        {awaitingApproval && onApprove !== undefined && onReject !== undefined && (
          <span className="row" style={{ marginLeft: "auto", gap: 6 }}>
            <button type="button" disabled={busy} onClick={() => onApprove(event.id)}>
              Approve
            </button>
            <button type="button" disabled={busy} onClick={() => onReject(event.id)}>
              Reject
            </button>
          </span>
        )}
      </div>
      <div className="event-meta">
        {event.toolName} ·{" "}
        <span className="dept-dot" style={{ background: ROOM_ACCENTS[event.department] }} />
        {event.department.replace(/_/g, " ")} · started {formatTime(event.startedAt)}
        {event.completedAt ? ` · finished ${formatTime(event.completedAt)}` : ""}
        {!event.completedAt && <Elapsed since={event.startedAt} />}
        {progress ? ` · progress ${progress}` : ""}
      </div>
      {event.resultSummary && <div className="event-meta">Result: {event.resultSummary}</div>}
      {event.errorCode && (
        <div className="event-meta" style={{ color: "var(--err)" }}>
          {event.errorCode}: {event.errorSummary}
        </div>
      )}
    </li>
  );
}

export function ActivityPanel({
  current,
  timeline,
  onApprove,
  onReject,
  busy = false,
}: {
  current: CurrentActivity;
  timeline: ActivityEvent[];
  /** Omitted in read-only contexts (monitor): approvals then point at the conversation. */
  onApprove?: ((eventId: string) => void) | undefined;
  onReject?: ((eventId: string) => void) | undefined;
  busy?: boolean;
}) {
  const canApproveHere = onApprove !== undefined && onReject !== undefined;
  return (
    <>
      <section className="panel" aria-label="Current activity">
        <h2 className="section-title">Current activity</h2>
        <div aria-live="polite">
          {current.idle ? (
            <p className="muted" style={{ margin: 0 }}>
              {current.idleMessage}
            </p>
          ) : (
            <>
              <ul className="event-list">
                {current.openEvents.map((event) => (
                  <EventRow
                    key={event.id}
                    event={event}
                    onApprove={onApprove}
                    onReject={onReject}
                    busy={busy}
                  />
                ))}
              </ul>
              {current.openEvents.some((e) => e.requiresInput) && (
                <p className="muted">
                  {canApproveHere
                    ? "A change is waiting for approval. Approve or reject it here, or in the conversation with Claude."
                    : "A change is waiting for approval. Approve or reject it in the conversation with Claude, or from the in-chat dashboard."}
                </p>
              )}
            </>
          )}
        </div>
      </section>

      <section className="panel" aria-label="Recent events">
        <h2 className="section-title">Recent events</h2>
        {timeline.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            No Mission Control events have been recorded yet.
          </p>
        ) : (
          <ul className="event-list">
            {timeline.map((event) => (
              <EventRow key={event.id} event={event} />
            ))}
          </ul>
        )}
        {timeline.length > 0 && (
          <p className="event-meta" style={{ marginBottom: 0 }}>
            Last observable event: {timeline[0]!.displayLabel.toLowerCase()} (
            {formatDateTime(timeline[0]!.updatedAt)}). Claude may be working outside Mission
            Control; no live event is available between tool calls.
          </p>
        )}
      </section>
    </>
  );
}
