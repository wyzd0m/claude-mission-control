# Research Notes

> Last planning review: July 2026. Recheck official sources before implementation and release.

## MCP Apps

MCP Apps allow MCP servers to provide interactive web interfaces that compatible hosts render inline.

Official references:

- [MCP Apps overview](https://modelcontextprotocol.io/extensions/apps/overview)
- [MCP Apps API documentation](https://apps.extensions.modelcontextprotocol.io/api/)
- [MCP Apps announcement](https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/)

## Desktop extension bundles

MCP Bundles package a local server and metadata into a portable `.mcpb` archive. Current Claude Desktop guidance supports installing custom bundles through Settings → Extensions → Advanced settings → Install Extension.

Official references:

- [Local MCP servers on Claude Desktop](https://support.anthropic.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop)
- [MCP Bundle format](https://blog.modelcontextprotocol.io/posts/2025-11-20-adopting-mcpb/)
- [MCP Apps and Bundles](https://modelcontextprotocol.io/docs/develop/build-with-agent-skills)

## Progress and tasks

MCP includes progress and task mechanisms, but status notifications may be optional. Mission Control must not depend on receiving all notifications.

Official references:

- [MCP Tasks](https://modelcontextprotocol.io/specification/2025-11-25/basic/utilities/tasks)
- [MCP Progress](https://modelcontextprotocol.io/specification/2025-03-26/basic/utilities/progress)
- [MCP Cancellation](https://modelcontextprotocol.io/specification/2025-11-25/basic/utilities/cancellation)

## Debugging

Use MCP Inspector to test the server independently. Claude Desktop also provides connector status and local logs.

Official reference:

- [MCP debugging](https://modelcontextprotocol.io/docs/tools/debugging)

## Phase 0 verification list

Do not assume until tested:

- React Three Fiber works correctly in the MCP App sandbox.
- WebGL performance is sufficient.
- UI state updates with acceptable latency.
- The selected SQLite package bundles cross-platform.
- No external runtime installation is required.
- The extension can persist data in the intended directory.
- The current manifest schema.
- The current Claude Desktop navigation labels.
- Progress or task capabilities available to the host.
- macOS packaging behavior.
- Enterprise extension restrictions.

## Research policy

During implementation:

1. Use official MCP and Anthropic documentation.
2. Prefer official SDK documentation.
3. Record the tested Claude Desktop version.
4. Do not build against undocumented internal files.
5. Treat community bug reports as warnings, not contracts.
6. Re-run Phase 0 after major host updates.
