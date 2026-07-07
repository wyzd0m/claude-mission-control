import type { EventStatus } from "@mission-control/domain";

export function formatTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleTimeString();
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}

/** Exact, non-euphemistic status words shown next to color coding. */
export const STATUS_TEXT: Record<EventStatus, string> = {
  queued: "Queued",
  travelling: "Dispatching",
  working: "Working",
  waiting_for_input: "Waiting for your approval",
  succeeded: "Succeeded",
  failed: "Failed",
  cancelled: "Cancelled",
};

export function progressText(current: number | null, total: number | null): string | null {
  if (current === null || total === null) return null;
  return `${current} of ${total}`;
}
