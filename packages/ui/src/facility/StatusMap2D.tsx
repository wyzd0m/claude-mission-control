import type { SceneState, RoomSceneState } from "./scene-state.js";

// 2D fallback (VISUAL_DESIGN §14): the same deterministic scene state as a
// simple status map, used when WebGL is unavailable or 3D is disabled. All
// states carry text labels, never color alone.

function roomStatusText(room: RoomSceneState): string {
  const parts: string[] = [];
  if (room.workingCount > 0) parts.push(`working (${room.workingCount})`);
  if (room.waiting) parts.push("waiting for approval");
  if (room.failed) parts.push("last operation failed");
  if (room.stageHighlight) parts.push("current stage");
  return parts.length > 0 ? parts.join(", ") : "quiet";
}

export function StatusMap2D({ scene }: { scene: SceneState }) {
  return (
    <div>
      <p className="muted" style={{ marginTop: 0 }}>
        2D status map (3D disabled or unavailable). Same information, no animation.
      </p>
      <ul className="event-list" aria-label="Facility departments">
        {scene.rooms.map((room) => (
          <li key={room.department} className="event-row">
            <div className="row">
              <span>{room.label}</span>
              {scene.robotAt === room.department && <span className="badge">robot here</span>}
              {room.waiting && <span className="badge approval">needs approval</span>}
            </div>
            <div className="event-meta" style={room.failed ? { color: "var(--err)" } : undefined}>
              {roomStatusText(room)}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
