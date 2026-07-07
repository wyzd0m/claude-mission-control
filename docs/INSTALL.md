# Installing Claude Mission Control

## Requirements

- Claude Desktop (current version) on Windows 11 or macOS.
- Nothing else: no Node.js, no Python, no API key, no configuration files.

## Install

1. Get `claude-mission-control.mcpb` (build it with `npm run release`, output in `dist/`).
2. Open Claude Desktop → **Settings** → **Extensions** → **Advanced settings** →
   **Install Extension…**
3. Select the `.mcpb` file, review the permissions, and install.
4. Start a new conversation and ask Claude to _"open Mission Control"_ or
   _"create a project called …"_.

If tools do not appear in a chat, fully quit Claude Desktop (tray icon → Quit), reopen it, and
start a new conversation. Ask Claude to run `get_diagnostics` to check the installation health.

## First run

On first use the extension creates its local database, applies the schema, and self-checks
storage. Everything lives in your user profile:

| Data                                        | Windows location                                         |
| ------------------------------------------- | -------------------------------------------------------- |
| Database                                    | `%APPDATA%\ClaudeMissionControl\data\mission-control.db` |
| Backups (automatic, before schema upgrades) | `%APPDATA%\ClaudeMissionControl\backups\`                |
| Exports                                     | `%APPDATA%\ClaudeMissionControl\exports\`                |

On macOS the root is `~/Library/Application Support/ClaudeMissionControl/`.

No conversation content is ever stored — only your project records and Mission Control's own
tool events. Nothing is sent anywhere; there is no telemetry and no network access.

## Updating

Install the new `.mcpb` over the old one. Before applying any schema migration to an existing
database, the server writes a timestamped backup into the backups directory automatically. The
installed version is visible in the dashboard's Diagnostics tab and via `get_diagnostics`.

## Uninstall

Uninstalling the extension (Settings → Extensions → Claude Mission Control → Uninstall) removes
the extension only. **Your project data is retained** in the directories above.

- To keep your work: ask Claude to `export_project` first, or copy the database file.
- To delete everything permanently: remove the `ClaudeMissionControl` folder from your
  application-data directory.
