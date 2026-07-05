# Installation and Distribution

## Version 1 goal

The user installs Claude Mission Control through Claude Desktop by selecting a packaged extension file.

The normal user should not need to:

- Install Python
- Install Node
- Open PowerShell
- Create a virtual environment
- Run `pip` or `npm`
- Edit `claude_desktop_config.json`
- Find absolute paths
- Supply an Anthropic API key

## Primary distribution format

Package version 1 as an MCP Bundle (`.mcpb`) compatible with Claude Desktop's custom-extension installation flow.

The bundle should contain:

- Extension manifest
- MCP server
- Compiled UI resources
- Required dependencies
- Database migrations
- Default configuration
- License and notices
- Version metadata

## Target user flow

1. Download `claude-mission-control-x.y.z.mcpb`.
2. Open Claude Desktop.
3. Go to Settings.
4. Open Extensions.
5. Open Advanced settings.
6. Choose Install Extension.
7. Select the `.mcpb` file.
8. Review permissions.
9. Install.
10. Start a new conversation.
11. Ask Claude to open Mission Control.

The release README must match the current Claude Desktop UI.

## First run

On first run:

1. Validate a writable application-data directory.
2. Create the database.
3. Apply migrations.
4. Create safe defaults.
5. Run a self-check.
6. Show onboarding.
7. Offer a demo project.
8. Explain observable-activity limitations.
9. Confirm no API key is required.

## Diagnostics

Provide a diagnostics screen or tool that checks:

- Extension version
- MCP server startup
- Database path
- Database schema
- Writable storage
- UI resource availability
- WebGL availability
- Reduced-motion setting
- Host capability summary
- Recent safe errors
- Export permission

Diagnostics must not reveal secrets.

## Data location

Use platform-appropriate application-data directories.

Requirements:

- No hard-coded username.
- No data inside the installed extension directory.
- Uninstall does not silently destroy project data.
- Documentation explains retained data.
- Backup and export locations are visible.

## Updates

A safe update must:

1. Back up the database.
2. Apply ordered migrations.
3. Preserve recovery information on failure.
4. Keep exports compatible where reasonable.
5. Show the installed version.

Automatic updates are not required for version 1 unless the platform safely provides them.

## Uninstall

Uninstalling the extension and deleting user data are separate actions.

Document:

- How to uninstall
- Where data remains
- How to export first
- How to permanently delete all Mission Control data

## Packaging constraints

Avoid dependencies on:

- Global package managers
- Shell configuration
- User-specific paths
- Developer tools
- Build tools on the user's computer
- Internet downloads during startup

## Clean-machine verification

### Windows

Test:

- Current Windows 11
- Standard user account
- No developer runtimes
- Paths with spaces
- Non-default username
- Fresh Claude Desktop installation

### macOS

Test:

- Current supported macOS
- Standard user account
- Apple Silicon
- Paths with spaces
- Clean extension install
- Required app permissions

## Developer fallback

A manual development setup may exist for contributors, but it must be separated from the end-user setup.

Developer setup may use:

- Node package manager
- Local dev server
- MCP Inspector
- Test database
- Hot reload

End-user documentation must lead with the bundle.

## Release artifacts

Each release should include:

- `.mcpb` bundle
- Checksums
- Release notes
- Supported-platform statement
- Known limitations
- Installation screenshots
- Upgrade guidance
- Uninstall guidance
- Source tag

## Platform caution

Before each release:

- Recheck official documentation.
- Re-run the Phase 0 compatibility proof.
- Test the current Claude Desktop version.
- Avoid undocumented internal paths or APIs.
