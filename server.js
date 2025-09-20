// server.js
// Proxy + static server for WU PWS history (Railway-friendly)
import express from "express";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const WU_API_KEY = process.env.WU_API_KEY;

// Basic health
app.get("/health", (_req, res) => res.json({ ok: true }));

// Serve frontend
app.use(express.static("public"));

// Simple API proxy
app.get("/api/wu/history", async (req, res) => {
  try {
    const { stationId, date } = req.query;
    if (!WU_API_KEY) {
      return res.status(500).json({ error: "Falta WU_API_KEY en variables de entorno" });
    }
    if (!stationId || !date) {
      return res.status(400).json({ error: "Parámetros requeridos: stationId y date (YYYYMMDD)" });
    }

    // Build upstream URL
    const api = new URL("https://api.weather.com/v2/pws/history/all");
    api.searchParams.set("stationId", stationId);
    api.searchParams.set("date", date); // YYYYMMDD
    api.searchParams.set("format", "json");
    api.searchParams.set("units", "m");
    api.searchParams.set("apiKey", WU_API_KEY);

    const upstream = await fetch(api, { headers: { "accept": "application/json" } });
    const text = await upstream.text();

    // Pass-through status & JSON/text
    res.status(upstream.status);
    // Try to JSON.parse, fallback to text
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

app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
