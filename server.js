// server.js (viejo) — cerrado por header secreto + anti-cache + merge de history/current (ESM)
import express from "express";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const WU_API_KEY = process.env.WU_API_KEY;

/* -------------------------------------------
 * 1) Anti-cache para /api (tal como tenías)
 * -------------------------------------------
 */
app.use((req, res, next) => {
  if (req.path && req.path.startsWith("/api")) {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
    res.set("Surrogate-Control", "no-store");
  }
  next();
});

/* -------------------------------------------
 * 2) Healthchecks ABIERTOS (Railway necesita esto)
 *    -> quedan fuera del candado
 * -------------------------------------------
 */
app.get("/health", (_req, res) => res.json({ ok: true }));
// Si usas otro endpoint de salud, añádelo igualmente antes del middleware de secreto.
// app.get("/salud", (_req, res) => res.status(200).send("OK"));

/* -------------------------------------------
 * 3) 🔒 Middleware de HEADER SECRETO
 *    - Todo lo que NO sea health queda protegido
 *    - El gateway añadirá:  x-gateway-secret: <tu-secreto>
 * -------------------------------------------
 */
const REQUIRED_SECRET = process.env.GATEWAY_SECRET;
const OPEN_PATHS = new Set(["/health"]); // añade "/salud" si lo usas

app.use((req, res, next) => {
  if (OPEN_PATHS.has(req.path)) return next();

  if (!REQUIRED_SECRET) {
    console.error("[viejo] Falta GATEWAY_SECRET en variables de entorno");
    return res.status(500).send("Server misconfigured");
  }
  const got = req.get("x-gateway-secret");
  if (got !== REQUIRED_SECRET) {
    return res.status(401).send("Unauthorized");
  }
  next();
});

/* -------------------------------------------
 * 4) Handler combinado: history + current (hoy)
 *    (tu lógica existente, reubicada detrás del candado)
 * -------------------------------------------
 */
app.get("/api/wu/history", async (req, res, next) => {
  try {
    const stationId = req.query.stationId;
    const date = req.query.date;
    if (!stationId || !date) return next(); // deja que el handler base responda 400

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

    // Si es hoy: mezcla con "current"
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

/* -------------------------------------------
 * 5) Estáticos y handler base /api/wu/history (tal como tenías)
 * -------------------------------------------
 */
app.use(express.static("public"));

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
    try {
      res.json(JSON.parse(text));
    } catch {
      res.type("application/json").send(text);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al consultar Weather.com", details: String(err) });
  }
});

/* -------------------------------------------
 * 6) Arranque
 * -------------------------------------------
 */
app.listen(PORT, () => {
  console.log(`[viejo] listening on http://localhost:${PORT}`);
});

