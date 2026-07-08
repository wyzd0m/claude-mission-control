import type { Department } from "@mission-control/domain";

// Office floor plan (visual redesign, Stage 2): one continuous floor on a
// 3x3 grid of 5.6-unit rooms with 1.4-unit corridors between them. The
// Command Hub sits in the center cell; the front-center cell is an open
// entrance lounge. Corridors run along x = ±3.5 and z = ±3.5, and a
// deterministic waypoint graph gives robots believable walking routes:
// station → door → corridor → corridor → door → station. Furniture is
// placed off the door-to-station axis so routes never clip.

export const ROOM_SPACING = 7;
export const ROOM_HALF = 2.8; // rooms span cell center ± 2.8; corridors fill the rest

export const ROOM_POSITIONS: Record<Department, [number, number]> = {
  command_core: [0, 0],
  research_archive: [-ROOM_SPACING, -ROOM_SPACING],
  planning_bay: [0, -ROOM_SPACING],
  security_gate: [ROOM_SPACING, -ROOM_SPACING],
  memory_vault: [-ROOM_SPACING, 0],
  build_workshop: [ROOM_SPACING, 0],
  delivery_dock: [-ROOM_SPACING, ROOM_SPACING],
  testing_lab: [ROOM_SPACING, ROOM_SPACING],
};

/** Accent color per department; consistent state colors come from CSS vars. */
export const ROOM_ACCENTS: Record<Department, string> = {
  command_core: "#57c4ff",
  planning_bay: "#7fd0ff",
  research_archive: "#9a8cff",
  build_workshop: "#ffb46b",
  testing_lab: "#5fd39a",
  memory_vault: "#66e0d0",
  security_gate: "#ffc66b",
  delivery_dock: "#ff9ecb",
};

export const STATE_COLORS = {
  working: "#57c4ff",
  waiting: "#ffc66b",
  failed: "#ff7a76",
  succeeded: "#5fd39a",
  cancelled: "#8494a7",
  stage: "#7fd0ff",
  neutral: "#2c3d52",
} as const;

// ---------------------------------------------------------------- navigation

export type Point = [number, number];

/** Where a robot stands to work in each department (kept clear of furniture). */
export const STATIONS: Record<Department, Point> = {
  command_core: [0, 1.2],
  planning_bay: [0, -6.1],
  research_archive: [-6.1, -7],
  security_gate: [5.9, -7],
  memory_vault: [-6.1, 0],
  build_workshop: [6.1, 0],
  delivery_dock: [-6.1, 7],
  testing_lab: [5.9, 7],
};

/** Door gap on the corridor-facing edge of each room. */
export const DOORS: Record<Department, Point> = {
  command_core: [0, 0],
  planning_bay: [0, -4.2],
  research_archive: [-4.2, -7],
  security_gate: [4.2, -7],
  memory_vault: [-4.2, 0],
  build_workshop: [4.2, 0],
  delivery_dock: [-4.2, 7],
  testing_lab: [4.2, 7],
};

// Corridor waypoint graph. Node keys are readable ids; edges are straight
// corridor segments. Small and hand-authored on purpose: deterministic,
// testable, and impossible to route through furniture.
const NODES: Record<string, Point> = {
  core: STATIONS.command_core,
  c0: [0, 0], // open crossing inside the Command Hub
  n: [0, -3.5],
  s: [0, 3.5],
  w: [-3.5, 0],
  e: [3.5, 0],
  nw: [-3.5, -3.5],
  ne: [3.5, -3.5],
  sw: [-3.5, 3.5],
  se: [3.5, 3.5],
  nwOut: [-3.5, -7],
  neOut: [3.5, -7],
  swOut: [-3.5, 7],
  seOut: [3.5, 7],
};

const EDGES: Array<[string, string]> = [
  ["core", "c0"],
  ["core", "s"],
  ["c0", "n"],
  ["c0", "w"],
  ["c0", "e"],
  ["n", "nw"],
  ["n", "ne"],
  ["s", "sw"],
  ["s", "se"],
  ["w", "nw"],
  ["w", "sw"],
  ["e", "ne"],
  ["e", "se"],
  ["nw", "nwOut"],
  ["ne", "neOut"],
  ["sw", "swOut"],
  ["se", "seOut"],
];

/** Corridor node nearest each department's door. */
const DOOR_NODE: Record<Department, string> = {
  command_core: "core",
  planning_bay: "n",
  research_archive: "nwOut",
  security_gate: "neOut",
  memory_vault: "w",
  build_workshop: "e",
  delivery_dock: "swOut",
  testing_lab: "seOut",
};

const ADJACENCY: Record<string, string[]> = {};
for (const [a, b] of EDGES) {
  (ADJACENCY[a] ??= []).push(b);
  (ADJACENCY[b] ??= []).push(a);
}

function shortestNodePath(from: string, to: string): string[] {
  if (from === to) return [from];
  const previous = new Map<string, string>();
  const queue = [from];
  const seen = new Set([from]);
  while (queue.length > 0) {
    const node = queue.shift()!;
    for (const next of ADJACENCY[node] ?? []) {
      if (seen.has(next)) continue;
      seen.add(next);
      previous.set(next, node);
      if (next === to) {
        const path = [to];
        let cursor = to;
        while (cursor !== from) {
          cursor = previous.get(cursor)!;
          path.unshift(cursor);
        }
        return path;
      }
      queue.push(next);
    }
  }
  return [from, to]; // unreachable with a well-formed graph
}

function dedupe(points: Point[]): Point[] {
  const result: Point[] = [];
  for (const point of points) {
    const last = result[result.length - 1];
    if (!last || last[0] !== point[0] || last[1] !== point[1]) {
      result.push(point);
    }
  }
  return result;
}

/** Drop intermediate points that lie on a straight line. */
function simplify(points: Point[]): Point[] {
  if (points.length <= 2) return points;
  const result: Point[] = [points[0]!];
  for (let i = 1; i < points.length - 1; i++) {
    const [ax, az] = result[result.length - 1]!;
    const [bx, bz] = points[i]!;
    const [cx, cz] = points[i + 1]!;
    const collinear = (bx - ax) * (cz - az) - (bz - az) * (cx - ax);
    if (Math.abs(collinear) > 1e-6) {
      result.push(points[i]!);
    }
  }
  result.push(points[points.length - 1]!);
  return result;
}

/**
 * Walking route between two departments: station → door → corridor nodes →
 * door → station. Deterministic; every returned segment lies on open floor.
 */
export function routeBetween(from: Department, to: Department): Point[] {
  if (from === to) return [STATIONS[from]];
  const nodePath = shortestNodePath(DOOR_NODE[from], DOOR_NODE[to]);
  const points: Point[] = [
    STATIONS[from],
    DOORS[from],
    ...nodePath.map((id) => NODES[id]!),
    DOORS[to],
    STATIONS[to],
  ];
  return simplify(dedupe(points));
}

export function routeLength(route: Point[]): number {
  let total = 0;
  for (let i = 1; i < route.length; i++) {
    total += Math.hypot(route[i]![0] - route[i - 1]![0], route[i]![1] - route[i - 1]![1]);
  }
  return total;
}

/** Position and segment heading at `distance` along a polyline. */
export function pointAlongRoute(
  route: Point[],
  distance: number,
): { position: Point; heading: number } {
  if (route.length === 1) {
    return { position: route[0]!, heading: 0 };
  }
  let remaining = Math.max(0, distance);
  for (let i = 1; i < route.length; i++) {
    const [ax, az] = route[i - 1]!;
    const [bx, bz] = route[i]!;
    const segment = Math.hypot(bx - ax, bz - az);
    if (remaining <= segment || i === route.length - 1) {
      const t = segment === 0 ? 1 : Math.min(remaining / segment, 1);
      return {
        position: [ax + (bx - ax) * t, az + (bz - az) * t],
        heading: Math.atan2(bx - ax, bz - az),
      };
    }
    remaining -= segment;
  }
  return { position: route[route.length - 1]!, heading: 0 };
}

/** Short ambient pacing line in front of the Command Hub (idle atmosphere). */
export const AMBIENT_PAUSE_POINT: Point = [0, 2.9];
