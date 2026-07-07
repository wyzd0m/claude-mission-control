import type { ActivityEvent, CurrentActivity } from "@mission-control/domain";
import { formatDateTime, formatTime, progressText, STATUS_TEXT } from "../format.js";

// The exact activity panel (docs/PRODUCT_REQUIREMENTS.md §7): shows only
// persisted Mission Control events, verbatim. When idle, it shows the honest
// idle message from the server and nothing else.

function EventRow({ event }: { event: ActivityEvent }) {
  const progress = progressText(event.progressCurrent, event.progressTotal);
  return (
    <li className="event-row">
      <div className="row">
        <span className={`status-text status-${event.status}`}>{STATUS_TEXT[event.status]}</span>
        <span>{event.displayLabel}</span>
        {event.requiresInput && <span className="badge approval">needs approval</span>}
      </div>
      <div className="event-meta">
        {event.toolName} · {event.department.replace(/_/g, " ")} · started{" "}
        {formatTime(event.startedAt)}
        {event.completedAt ? ` · finished ${formatTime(event.completedAt)}` : ""}
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
}: {
  current: CurrentActivity;
  timeline: ActivityEvent[];
}) {
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
                  <EventRow key={event.id} event={event} />
                ))}
              </ul>
              {current.openEvents.some((e) => e.requiresInput) && (
                <p className="muted">
                  A change is waiting for approval. Approve or reject it in the conversation with
                  Claude.
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
