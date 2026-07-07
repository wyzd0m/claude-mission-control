import type { ProjectStage } from "@mission-control/domain";

/** Human-readable stage labels used by the dashboard. */
export const STAGE_LABELS: Record<ProjectStage, string> = {
  discovery: "Discovery",
  planning: "Planning",
  building: "Building",
  testing: "Testing",
  reviewing: "Reviewing",
  shipping: "Shipping",
  maintenance: "Maintenance",
};
