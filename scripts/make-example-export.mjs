// Generates examples/demo-project.json through the real domain and storage
// code, so the example always matches the current export format and passes
// import validation. Run with: npx tsx scripts/make-example-export.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openDatabase, buildProjectExport, createServiceContext } from "@mission-control/server";
import {
  createProject,
  createTask,
  updateTask,
  createDecision,
  createArtifact,
  setArtifactVerification,
  createCheckpoint,
} from "@mission-control/domain";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { db } = openDatabase(":memory:");
const ctx = createServiceContext(db);

const project = createProject({
  name: "Demo: Field Notes App",
  description: "A small example project showing how Mission Control records work.",
  goal: "Ship a note-taking app for field researchers",
  definitionOfDone: "Offline capture, sync, and export all pass acceptance tests",
  currentStage: "building",
});
ctx.projects.insert(project);

const t1 = createTask({
  projectId: project.id,
  title: "Design offline capture flow",
  priority: "high",
  stage: "planning",
});
ctx.tasks.insert(t1);
ctx.tasks.update(updateTask(t1, { status: "done" }));

const t2 = createTask({
  projectId: project.id,
  title: "Implement note editor",
  priority: "high",
  stage: "building",
});
ctx.tasks.insert(t2);
ctx.tasks.update(updateTask(t2, { status: "in_progress" }));

const t3 = createTask({
  projectId: project.id,
  title: "Sync engine spike",
  stage: "building",
});
ctx.tasks.insert(t3);
ctx.tasks.update(
  updateTask(t3, { status: "blocked", blockedReason: "Waiting on backend credentials" }),
);

ctx.decisions.insert(
  createDecision({
    projectId: project.id,
    summary: "Store notes locally in SQLite",
    rationale: "Field use means unreliable connectivity; local-first keeps capture instant.",
    alternativesConsidered: ["Cloud-only storage", "Plain JSON files"],
    relatedTaskIds: [t1.id],
  }),
);

const artifact = createArtifact({
  projectId: project.id,
  name: "editor.tsx",
  type: "file",
  pathOrReference: "src/editor.tsx",
  description: "Note editor component",
  relatedTaskIds: [t2.id],
});
ctx.artifacts.insert(artifact);
ctx.artifacts.update(setArtifactVerification(artifact, "verified", "Unit tests passed (42/42)"));

ctx.checkpoints.insert(
  createCheckpoint({
    projectId: project.id,
    summary: "Editor in progress, sync blocked",
    completedWork: ["Offline capture flow designed"],
    openWork: ["Note editor implementation", "Sync engine spike"],
    decisions: ["Local-first SQLite storage"],
    blockers: ["Backend credentials pending"],
    recommendedNextAction: "Finish the note editor while credentials are pending",
  }),
);

const bundle = buildProjectExport(db, project.id, () => new Date());
const outDir = path.join(root, "examples");
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, "demo-project.json");
fs.writeFileSync(outFile, JSON.stringify(bundle, null, 2) + "\n", "utf-8");
console.log(`Example export written to ${outFile}`);
