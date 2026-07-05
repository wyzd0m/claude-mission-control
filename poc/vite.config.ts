import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// The MCP App UI must ship as a single self-contained HTML file because the
// host renders it in a sandboxed iframe with a deny-by-default CSP.
export default defineConfig({
  root: "ui",
  plugins: [react(), viteSingleFile()],
  build: {
    outDir: "../dist/ui",
    emptyOutDir: true,
    rollupOptions: {
      input: "ui/mcp-app.html",
    },
  },
});
