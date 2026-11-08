// Servidor local para probar dist/ en http://localhost:5180 (el service worker funciona en localhost).
//   npm run build && npm run serve
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join, normalize, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const tipos = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };
const puerto = Number(process.env.PORT) || 5180;

createServer(async (req, res) => {
  const ruta = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const archivo = normalize(join(dist, ruta.endsWith('/') ? ruta + 'index.html' : ruta));
  if (!archivo.startsWith(dist)) { res.writeHead(403).end(); return; }
  try {
    const datos = await readFile(archivo);
    res.writeHead(200, { 'Content-Type': tipos[extname(archivo)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(datos);
  } catch { res.writeHead(404).end('No encontrado'); }
}).listen(puerto, () => console.log(`Cuadrao en http://localhost:${puerto}`));
