import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// The dashboard ships as one self-contained HTML file: MCP App hosts render
// it in a sandboxed iframe with a deny-by-default CSP, so no external assets.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: "dashboard.html",
    },
  },
});
