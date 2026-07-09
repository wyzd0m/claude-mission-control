// Robot fleet identities (D-029). Pure data: each robot of the D-028 fleet
// has a name and a distinct procedural look so viewers can follow "who is
// doing what" across concurrent operations. Index-aligned with
// ROBOT_HOME_POINTS / the animator's robots array.

export type RobotVariant = "courier" | "scout" | "hauler";

export interface RobotIdentity {
  /** Display name, shown on the chest badge. */
  name: string;
  /** Silhouette family the renderer builds. */
  variant: RobotVariant;
  /** Personal accent for eyes, chest light, and badge keyline. */
  accent: string;
  /** Shell tint (kept close to the shared palette). */
  shell: string;
  /** Overall scale of the body group. */
  scale: number;
}

export const ROBOT_IDENTITIES: readonly RobotIdentity[] = [
  {
    // The lead courier: the original silhouette, first to be dispatched.
    name: "OTTO",
    variant: "courier",
    accent: "#57c4ff",
    shell: "#e8eef4",
    scale: 1.15,
  },
  {
    // A smaller scout with a dome head and a single visor eye.
    name: "PIP",
    variant: "scout",
    accent: "#5fd39a",
    shell: "#eaf2ea",
    scale: 0.95,
  },
  {
    // A sturdier hauler: boxy body, wide flat head, square eyes.
    name: "HEX",
    variant: "hauler",
    accent: "#ffc66b",
    shell: "#f0ead9",
    scale: 1.22,
  },
];
