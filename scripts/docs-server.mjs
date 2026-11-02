// Simple docs server: renders any .md file under docs/ as styled HTML.
// Usage: node scripts/docs-server.mjs [port]
// Default port: 4400.  Visit http://localhost:4400/ for a directory listing.

import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const DOCS_ROOT = path.join(REPO_ROOT, "docs");
const PORT = Number(process.argv[2]) || 4400;

marked.setOptions({ gfm: true, breaks: false });

const page = (title, body) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${title}</title>
<meta http-equiv="refresh" content="10" />
<style>
  :root { color-scheme: light dark; }
  body { font: 16px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
         max-width: 900px; margin: 2rem auto; padding: 0 1.5rem; color: #1c2332; background: #fafaf7; }
  @media (prefers-color-scheme: dark) {
    body { background: #0f1623; color: #e5e7eb; }
    code, pre { background: #1c2332 !important; }
    a { color: #d4af6a; }
    table { border-color: #2a3347; }
    th, td { border-color: #2a3347; }
  }
  h1, h2, h3 { color: #d4af6a; font-weight: 600; margin-top: 2rem; }
  h1 { border-bottom: 2px solid #d4af6a; padding-bottom: .3rem; }
  a { color: #b8963e; }
  code { background: #eee; padding: 2px 6px; border-radius: 3px; font-size: .9em; }
  pre { background: #eee; padding: 1rem; border-radius: 6px; overflow-x: auto; }
  pre code { background: transparent; padding: 0; }
  table { border-collapse: collapse; margin: 1rem 0; }
  th, td { border: 1px solid #ddd; padding: .5rem .75rem; text-align: left; }
  th { background: #d4af6a; color: #0f1623; }
  blockquote { border-left: 4px solid #d4af6a; margin: 0; padding: .5rem 1rem; background: rgba(212,175,106,.1); }
  .nav { margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 1px solid #ddd; }
  .nav a { margin-right: 1rem; }
  ul.file-list { list-style: none; padding: 0; }
  ul.file-list li { padding: .5rem 0; }
</style>
</head>
<body>
<div class="nav"><a href="/">📁 All docs</a></div>
${body}
</body>
</html>`;

async function listDocs() {
  const items = [];
  async function walk(dir, rel = "") {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      const relPath = path.join(rel, e.name).replaceAll("\\", "/");
      if (e.isDirectory()) await walk(full, relPath);
      else if (e.name.endsWith(".md")) items.push(relPath);
    }
  }
  await walk(DOCS_ROOT);
  items.sort();
  return items;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = decodeURIComponent(req.url.split("?")[0]);
    if (url === "/" || url === "/index.html") {
      const files = await listDocs();
      const body = `<h1>Wabs Car Rental — Docs</h1>
<ul class="file-list">
${files.map(f => `<li><a href="/${f}">${f}</a></li>`).join("\n")}
</ul>`;
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(page("Docs", body));
      return;
    }
    // Serve any .md under docs/
    const rel = url.replace(/^\/+/, "");
    if (!rel.endsWith(".md")) {
      res.writeHead(404); res.end("Not found"); return;
    }
    const full = path.join(DOCS_ROOT, rel);
    if (!full.startsWith(DOCS_ROOT)) {
      res.writeHead(403); res.end("Forbidden"); return;
    }
    const md = await fs.readFile(full, "utf8");
    const html = marked.parse(md);
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(page(rel, html));
  } catch (err) {
    res.writeHead(500, { "content-type": "text/plain" });
    res.end(`Server error: ${err.message}`);
  }
});

server.listen(PORT, () => {
  console.log(`Docs server: http://localhost:${PORT}/`);
  console.log(`Root: ${DOCS_ROOT}`);
});
