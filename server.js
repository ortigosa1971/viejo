// server.js — ESM (package.json tiene "type":"module")
import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const PORT = process.env.PORT || 3000;

// __dirname en ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------- Middlewares base ----------
app.disable('x-powered-by');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---------- CONTROL DE ACCESO: requiere cookie puesta por "aver" ----------
app.use((req, res, next) => {
  // Rutas públicas mínimas (ajusta si necesitas otras)
  const allowList = new Set(['/health', '/robots.txt', '/favicon.ico']);
  if (allowList.has(req.path)) return next();

  // Si quieres dejar pública alguna carpeta concreta:
  // if (req.path.startsWith('/open/')) return next();

  // Parseo simple de cookies (sin dependencias)
  const raw = req.headers.cookie || '';
  const cookies = Object.fromEntries(
    raw.split(';')
      .map(c => c.trim())
      .filter(Boolean)
      .map(c => {
        const i = c.indexOf('=');
        const k = i >= 0 ? decodeURIComponent(c.slice(0, i)) : c;
        const v = i >= 0 ? decodeURIComponent(c.slice(i + 1)) : '';
        return [k, v];
      })
  );

  if (cookies.aver_visited === '1') {
    // Cookie presente => permitir acceso
    return next();
  }

  // Sin cookie => redirige a "aver" para que la ponga y vuelva aquí
  const nextUrl = encodeURIComponent(req.originalUrl || '/');
  const url = `https://aver-production.up.railway.app/permitir-viejo?next=${nextUrl}`;
  return res.redirect(302, url);
});

// ---------- Rutas básicas ----------
app.get('/health', (_req, res) => res.status(200).send('ok'));

// ---------- Archivos estáticos ----------
const publicDir = path.join(__dirname, 'public');
// Mantén esto DESPUÉS del middleware de control si quieres proteger estáticos
app.use(express.static(publicDir, { index: false, maxAge: '1h' }));

// ---------- (Opcional) Tus rutas API aquí ----------
// import apiRouter from './routes/api.js';
// app.use('/api', apiRouter);

// ---------- Fallback SPA (si sirves una single-page app) ----------
app.get('*', (req, res) => {
  const indexFile = path.join(publicDir, 'index.html');
  res.sendFile(indexFile, (err) => {
    if (err) res.status(404).send('Not found');
  });
});

// ---------- Arranque ----------
app.listen(PORT, () => {
  console.log(`viejo escuchando en http://localhost:${PORT}`);
});

