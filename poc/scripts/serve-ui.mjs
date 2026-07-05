// Dev-only static server for the built single-file UI, so it can be inspected
// in a normal browser. Not part of the extension.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const htmlPath = path.join(root, "dist", "ui", "mcp-app.html");
const port = Number(process.env.PORT ?? 5180);

http
  .createServer((req, res) => {
    if (!fs.existsSync(htmlPath)) {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("dist/ui/mcp-app.html not built");
      return;
    }
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(fs.readFileSync(htmlPath));
  })
  .listen(port, () => console.log(`PoC UI at http://localhost:${port}/`));
