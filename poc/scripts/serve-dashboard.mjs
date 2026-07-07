// Dev-only static server for the built dashboard, so it can be inspected in
// a normal browser (use ?demo for sample data). Not part of the extension.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const htmlPath = path.join(repoRoot, "packages", "ui", "dist", "dashboard.html");
const port = Number(process.env.PORT ?? 5181);

http
  .createServer((req, res) => {
    if (!fs.existsSync(htmlPath)) {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("packages/ui/dist/dashboard.html not built. Run: npm run build:dashboard");
      return;
    }
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(fs.readFileSync(htmlPath));
  })
  .listen(port, () => console.log(`Dashboard at http://localhost:${port}/?demo`));
