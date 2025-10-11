// server.js (CommonJS)
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.disable('x-powered-by');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  const allowList = new Set(['/health', '/robots.txt', '/favicon.ico']);
  if (allowList.has(req.path)) return next();

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

  if (cookies.aver_visited === '1') return next();

  const nextUrl = encodeURIComponent(req.originalUrl || '/');
  const url = `https://aver-production.up.railway.app/permitir-viejo?next=${nextUrl}`;
  return res.redirect(302, url);
});

app.get('/health', (req, res) => res.status(200).send('ok'));

const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir, { index: false, maxAge: '1h' }));

app.get('*', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'), err => {
    if (err) res.status(404).send('Not found');
  });
});

app.listen(PORT, () => {
  console.log(`viejo escuchando en http://localhost:${PORT}`);
});

