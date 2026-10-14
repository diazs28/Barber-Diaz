// Servidor de desarrollo: sirve la landing y la función /api/disponibilidad como en Vercel.
// Uso: npm run dev  (lee la clave de .env, que nunca se sube al repositorio)
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { GET as disponibilidad } from '../api/disponibilidad.js';
import { POST as reservas } from '../api/reservas.js';

const RAIZ = resolve(import.meta.dirname, '..');
const PUERTO = Number(process.env.PORT ?? 5180);
const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};
const PRIVADOS = /^[\\/](api|scripts|node_modules|\.git|\.env)/;

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PUERTO}`);
  try {
    const rutas = { 'GET /api/disponibilidad': disponibilidad, 'POST /api/reservas': reservas };
    const funcion = rutas[`${req.method} ${url.pathname}`];
    if (url.pathname.startsWith('/api/') && !funcion) {
      res.writeHead(405);
      res.end();
      return;
    }
    if (funcion) {
      const partes = [];
      for await (const parte of req) partes.push(parte);
      const r = await funcion(
        new Request(url, {
          method: req.method,
          headers: req.headers,
          body: req.method === 'GET' ? undefined : Buffer.concat(partes),
        }),
      );
      res.writeHead(r.status, Object.fromEntries(r.headers));
      res.end(Buffer.from(await r.arrayBuffer()));
      return;
    }
    const ruta = normalize(url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname));
    if (PRIVADOS.test(ruta)) throw Object.assign(new Error(), { code: 'ENOENT' });
    const archivo = join(RAIZ, ruta);
    if (!archivo.startsWith(RAIZ)) throw Object.assign(new Error(), { code: 'ENOENT' });
    const contenido = await readFile(archivo);
    res.writeHead(200, {
      'Content-Type': TIPOS[extname(archivo)] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(contenido);
  } catch (e) {
    res.writeHead(e.code === 'ENOENT' || e.code === 'EISDIR' ? 404 : 500);
    res.end();
  }
}).listen(PUERTO, () => {
  console.log(`Barber Mafia en http://localhost:${PUERTO}`);
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON && !process.env.GOOGLE_CALENDAR_API_KEY) {
    console.log('Aviso: sin credenciales de Google en .env, la agenda saldrá "no disponible".');
  }
});
