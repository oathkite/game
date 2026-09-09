import { createServer } from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
const app = resolve(root, 'tools/asset-lab');
const types = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  try {
    if (req.method !== 'GET') { res.writeHead(405); res.end(); return; }
    const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const target = path.startsWith('/assets/workbench/') ? resolve(root, '.' + path) : resolve(app, '.' + (path === '/' ? '/index.html' : path));
    const file = await realpath(target);
    if (!(file.startsWith(app + sep) || file.startsWith(resolve(root, 'assets/workbench') + sep))) throw new Error('path');
    if (!types[extname(file)]) throw new Error('type');
    res.writeHead(200, { 'Content-Type': types[extname(file)], 'Cache-Control': 'no-store' });
    res.end(await readFile(file));
  } catch { res.writeHead(404); res.end('Not found'); }
});
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
const port=Number(process.env.ASSET_LAB_PORT ?? 4178);
server.listen(port, '127.0.0.1', () => console.log(`Asset garage: http://127.0.0.1:${port}`));
