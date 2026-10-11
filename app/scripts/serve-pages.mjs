/* global process, URL, console */
// Mimics GitHub Pages: serves dist/ under a sub-path, 404.html for unknown paths.
// Usage: node scripts/serve-pages.mjs [base=/nihongo-dojo/] [port=4173]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const base = (process.argv[2] ?? '/nihongo-dojo/').replace(/\/?$/, '/');
const port = Number(process.argv[3] ?? 4173);
const root = join(process.cwd(), 'dist');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff', '.mp3': 'audio/mpeg' };

const send = (res, status, body, type) => {
  res.writeHead(status, { 'content-type': type });
  res.end(body);
};

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (!path.startsWith(base)) return send(res, 404, 'Not found (outside base)', 'text/plain');
  let rel = normalize(path.slice(base.length)).replace(/^(\.\.[/\\])+/, '');
  if (rel === '' || rel === '.' || rel.endsWith('/')) rel = join(rel === '.' ? '' : rel, 'index.html');
  try {
    send(res, 200, await readFile(join(root, rel)), types[extname(rel)] ?? 'application/octet-stream');
  } catch {
    send(res, 404, await readFile(join(root, '404.html')), types['.html']);
  }
}).listen(port, () => console.log(`Pages mock on http://localhost:${port}${base}`));
