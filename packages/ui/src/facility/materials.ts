// Warm office-diorama palette (visual redesign, Stage 1). The scene sits on
// the dark dashboard background like a lit miniature: warm neutral interior
// materials, restrained futuristic accents, no neon overload.

export const M = {
  // Architecture
  plinth: "#141a23",
  floorWood: "#a98a6a",
  floorWoodAlt: "#9c7d5f",
  corridor: "#606a7c",
  corridorTrim: "#828da0",
  wall: "#ded5c4",
  wallLow: "#c9bfa9",
  glass: "#bcd8e8",
  glassFrame: "#8a94a4",

  // Furniture
  deskTop: "#efe8da",
  deskLeg: "#8d8477",
  wood: "#b58f6b",
  woodDark: "#8a6a4e",
  charcoal: "#3a4149",
  slate: "#4b5563",
  metal: "#aab3bd",
  fabricTeal: "#4f8f8b",
  fabricBlue: "#5d7fae",
  paper: "#f3efe6",

  // Accents and life
  plant: "#66a06a",
  plantDark: "#4d8253",
  pot: "#c96f4a",
  bookA: "#c96f4a",
  bookB: "#5d7fae",
  bookC: "#4f8f8b",
  bookD: "#d9b455",

  // Screens
  screenOff: "#1b2430",
  screenGlow: "#9fd4f2",
  screenWarm: "#f2d9a6",

  // Robot
  robotShell: "#e8eef4",
  robotDark: "#2f3742",
  robotAccent: "#57c4ff",
} as const;

/** Soft warm lighting rig shared by the scene. */
export const LIGHTING = {
  ambientColor: "#fff3e2",
  ambientIntensity: 0.55,
  hemiSky: "#cfe0ee",
  hemiGround: "#6b5a4a",
  hemiIntensity: 0.4,
  keyColor: "#ffe9c8",
  keyIntensity: 1.25,
  keyPosition: [14, 20, 10] as [number, number, number],
  fillColor: "#a8c4e0",
  fillIntensity: 0.35,
  fillPosition: [-12, 10, -6] as [number, number, number],
} as const;
