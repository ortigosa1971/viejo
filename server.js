// server.js
// Proxy + static server for WU PWS history (Railway-friendly) + auth mínima para /inicio
import express from "express";
import dotenv from "dotenv";
import session from "express-session";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080; // Railway usa PORT
const WU_API_KEY = process.env.WU_API_KEY;

// Body parser para formularios
app.use(express.urlencoded({ extended: true }));

// Sesión para proteger /inicio
app.use(session({
  secret: process.env.SESSION_SECRET || "cambia-esto-por-un-secreto-largo",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  }
}));

// Guardia de autenticación
function requireAuth(req, res, next) {
  if (req.session?.user) return next();
  req.session.redirectTo = req.originalUrl;
  return res.redirect("/login?error=sesion_invalida");
}

// Anti-cache solo para /api
app.use((req, res, next) => {
  if (req.path && req.path.startsWith("/api")) {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
    res.set("Surrogate-Control", "no-store");
  }
  next();
});

// Merged history+current handler
app.get("/api/wu/history", async (req, res, next) => {
  try {
    const stationId = req.query.stationId;
    const date = req.query.date;
    if (!stationId || !date) return next();

    const baseHist = "https://api.weather.com/v2/pws/history/all";
    const histParams = new URLSearchParams({
      stationId, date,
      format: "json",
      units: "m",
      apiKey: WU_API_KEY || ""
    });
    const histUrl = `${baseHist}?${histParams.toString()}`;
    const r1 = await fetch(histUrl, { headers: { "Accept": "application/json" } });
    const text1 = await r1.text();

    let histJson;
    try { histJson = JSON.parse(text1); } catch { histJson = null; }

    const now = new Date();
    const pad = (n) => String(n).padStart(2,"0");
    const todayStr = String(now.getFullYear()) + pad(now.getMonth()+1) + pad(now.getDate());
    if (date !== todayStr) {
      res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.set("Pragma", "no-cache");
      res.set("Expires", "0");
      return histJson ? res.json(histJson) : res.type("application/json").send(text1);
    }

    // Current observations
    const baseCur = "https://api.weather.com/v2/pws/observations/current";
    const curParams = new URLSearchParams({
      stationId,
      format: "json",
      units: "m",
      apiKey: WU_API_KEY || ""
    });
    const curUrl = `${baseCur}?${curParams.toString()}`;
    const r2 = await fetch(curUrl, { headers: { "Accept": "application/json" } });
    const text2 = await r2.text();

    let curJson;
    try { curJson = JSON.parse(text2); } catch { curJson = null; }

    const getList = (j) => Array.isArray(j) ? j : (j && j.observations ? j.observations : []);
    const setList = (j, arr) => Array.isArray(j) ? arr : { observations: arr };

    const histList = getList(histJson) || [];
    const curList  = getList(curJson) || [];

    const lastEpoch = histList.length ? (histList[histList.length-1].epoch || null) : null;
    const extra = [];
    for (const o of curList) {
      const e = o.epoch || (o.obsTimeUtc ? Math.floor(Date.parse(o.obsTimeUtc)/1000) : null);
      if (!e) continue;
      if (lastEpoch && e <= lastEpoch) continue;
      extra.push(o);
    }

    const merged = histList.concat(extra).sort((a,b) => {
      const ea = a.epoch || (a.obsTimeUtc ? Date.parse(a.obsTimeUtc)/1000 : 0);
      const eb = b.epoch || (b.obsTimeUtc ? Date.parse(b.obsTimeUtc)/1000 : 0);
      return ea - eb;
    });

    const out = setList(histJson, merged);

    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
    return res.json(out);
  } catch (e) {
    console.warn("merged handler fallback:", e);
    return next();
  }
});

// Health
app.get("/health", (_req, res) => res.json({ ok: true }));

// Login pages
app.get("/login", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.post("/login", (req, res) => {
  const { usuario } = req.body;
  if (!usuario) return res.redirect("/login?error=credenciales");
  req.session.user = { usuario };
  const goto = req.session.redirectTo || "/inicio";
  delete req.session.redirectTo;
  return res.redirect(goto);
});

app.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.redirect("/login?msg=logout");
  });
});

// Protected /inicio before general static
app.use("/inicio", requireAuth, express.static(path.join(__dirname, "public", "inicio")));
app.get("/inicio", requireAuth, (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "inicio", "index.html"));
});

// General static
app.use(express.static("public"));

// Simple API proxy (fallback)
app.get("/api/wu/history", async (req, res) => {
  try {
    const { stationId, date } = req.query;
    if (!WU_API_KEY) {
      return res.status(500).json({ error: "Falta WU_API_KEY en variables de entorno" });
    }
    if (!stationId || !date) {
      return res.status(400).json({ error: "Parámetros requeridos: stationId y date (YYYYMMDD)" });
    }

    const api = new URL("https://api.weather.com/v2/pws/history/all");
    api.searchParams.set("stationId", stationId);
    api.searchParams.set("date", date);
    api.searchParams.set("format", "json");
    api.searchParams.set("units", "m");
    api.searchParams.set("apiKey", WU_API_KEY);

    const upstream = await fetch(api, { headers: { "accept": "application/json" } });
    const text = await upstream.text();

    res.status(upstream.status);
    try { res.json(JSON.parse(text)); }
    catch { res.type("application/json").send(text); }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al consultar Weather.com", details: String(err) });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
