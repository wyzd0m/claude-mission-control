import type { Department } from "@mission-control/domain";

// Fixed facility floor plan: Command Core in the center, seven departments
// on a 3x3 grid around it (the front-center cell stays open as the entrance
// walkway). Positions are [x, z] on the ground plane; predefined straight
// paths run from the core to every room (VISUAL_DESIGN §14: predefined
// paths, no physics).

export const ROOM_SPACING = 7;

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
  stage: "#7fd0ff",
  neutral: "#2c3d52",
} as const;

export function pathFromCore(department: Department): Array<[number, number]> {
  const [x, z] = ROOM_POSITIONS[department];
  return [
    [0, 0],
    [x, z],
  ];
}
