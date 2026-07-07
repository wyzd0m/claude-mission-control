# End-to-End Workflows (Phase 8)

The eight required scenarios from `docs/IMPLEMENTATION_ROADMAP.md`. Each has a repeatable
automated test in `packages/server/src/mcp/workflows.e2e.test.ts`, a visual mapping (what the
facility shows, driven only by persisted events), and defined failure behavior (a stable error
code with a recovery hint, plus a failed event where the operation was tracked).

| #   | Scenario                           | Tools                                                                     | Visual mapping                                                                                                        | Failure behavior                                                                                                      |
| --- | ---------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 1   | Create and plan a project          | `create_project`, `update_project`, `update_project_stage`, `create_task` | Planning Bay works per operation; the saved stage strengthens its mapped room                                         | `PROJECT_NOT_FOUND` when no project exists or is active                                                               |
| 2   | Update tasks during implementation | `update_task`, `list_tasks`                                               | Build Workshop replays each update; events carry the related task ids                                                 | `VALIDATION_FAILED` (e.g. blocking without a reason) with a matching failed event                                     |
| 3   | Record a decision                  | `record_decision`, `list_decisions`                                       | Memory Vault stores the decision (robot with data crystal)                                                            | `TASK_NOT_FOUND` when related tasks don't exist in the project                                                        |
| 4   | Record a validation result         | `register_artifact`, `record_validation_result`                           | Testing Lab works; a failing validation shows the red failure state                                                   | Schema rejection when no validation is named — a test is never claimed without a supplied result                      |
| 5   | Save a checkpoint                  | `save_checkpoint`                                                         | Memory Vault checkpoint chamber                                                                                       | `PROJECT_NOT_FOUND` without an active project                                                                         |
| 6   | Continue in a new conversation     | `get_latest_checkpoint`, `prepare_project_context`                        | Memory Vault retrieval; the facility restores quiet state on load without replaying history                           | Honest `PROJECT_NOT_FOUND` on an empty database                                                                       |
| 7   | Export and import a project        | `export_project`, `preview_project_import`, `apply_project_import`        | Delivery Dock packs the export; the Security Gate holds an amber waiting event until the import is approved           | `IMPORT_INVALID` before anything is written; rejected/expired tokens cancel the gate wait                             |
| 8   | Preview and approve a bulk change  | `preview_bulk_task_update`, `apply_bulk_task_update`                      | Security Gate waits (a preview is never completed work); approval resolves the gate event through working → succeeded | Token reuse/expiry/tamper → `VALIDATION_FAILED`; post-approval conflicts → `REVISION_CONFLICT` failing the gate event |

Conversation-level walkthrough (what a user says to Claude in Claude Desktop):

1. "Create a project called Demo with the goal of shipping v1, and plan the first tasks."
2. "Mark the login task in progress." / "Block it — we're waiting on API keys."
3. "Record the decision to use SQLite, with the alternatives we discussed."
4. "Register login.ts as an artifact and record that its unit tests failed."
5. "Save a checkpoint summarizing where we are."
6. (new conversation) "Get the latest checkpoint and prepare the project context."
7. "Export the project." / "Import this export file." (preview → approve)
8. "Move all todo tasks to in progress." (preview → approve)
