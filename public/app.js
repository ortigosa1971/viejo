// public/app.js

function toYYYYMMDD(d) {
  // Input: 'YYYY-MM-DD' from <input type="date">
  if (!d) return "";
  return d.replaceAll("-", "");
}

// Helpers para rango de fechas
function eachDateISO(fromISO, toISO) {
  // yield fechas 'YYYY-MM-DD' inclusivas
  const from = new Date(fromISO);
  const to = new Date(toISO);
  const dates = [];
  for (let d = new Date(from); d <= to; d.setDate(d.getDate()+1)) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    dates.push(`${yyyy}-${mm}-${dd}`);
  }
  return dates;
}


function fmt(n, digits = 0) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const num = Number(n);
  return num.toFixed(digits);
}

function parseWUResponse(json) {
  // Tolerate formats: {observations: []} or [] directly
  const arr = Array.isArray(json?.observations) ? json.observations
            : Array.isArray(json) ? json
            : [];

  return arr.map(o => {
    // Prefer metric; fallback to top-level for some stations
    const m = o.metric ?? o;

    const tLocal = o.obsTimeLocal ?? o.obsTimeUtc ?? (o.epoch ? new Date(o.epoch * 1000).toISOString() : "");

    const temp = m?.temp ?? m?.tempAvg ?? null;
    const dew  = m?.dewpt ?? m?.dewptAvg ?? null;
    const rh   = m?.humidity ?? o.humidityAvg ?? null;
    const pres = m?.pressure ?? m?.pressureMax ?? m?.pressureMin ?? null;
    const w    = m?.windspeed ?? m?.windspeedAvg ?? null;
    const gust = m?.windgust ?? m?.windgustHigh ?? null;
    const dir  = m?.winddir ?? o.winddirAvg ?? null;

    // --- PRECIP: split columns clearly ---
    const precipRate  = (m?.precipRate  ?? o.precipRate  ?? null);
    const precipTotal = (m?.precipTotal ?? o.precipTotal ?? null);

    const uv  = o.uvHigh ?? o.uv ?? m?.uv ?? null;
    const rad = o.solarRadiationHigh ?? o.solarRadiation ?? m?.solarRadiation ?? null;

    return {
      timeLocal: tLocal,
      temp, dew, rh, pres, w, gust, dir,
      precipRate, precipTotal,
      uv, rad,
      // for min/max if present
      tempLow: m?.tempLow, tempHigh: m?.tempHigh,
    };
  });
}


async function loadData() {
  const stationId = document.getElementById("stationId").value.trim();
  const fromISO = document.getElementById("dateFrom").value;
  const toISO   = document.getElementById("dateTo").value || fromISO;

  const status = document.getElementById("status");
  status.textContent = "Cargando…";

  if (!fromISO) {
    status.textContent = "El campo 'Desde' es obligatorio.";
    return;
  }

  // Normalizar orden
  let startISO = fromISO, endISO = toISO;
  if (new Date(endISO) < new Date(startISO)) {
    const tmp = startISO; startISO = endISO; endISO = tmp;
  }

  try {
    const dates = eachDateISO(startISO, endISO);
    const allRows = [];

    // Descargas en paralelo con límite sencillo
    const fetchOne = async (iso) => {
      const date = toYYYYMMDD(iso);
      const url = new URL(location.origin + "/api/wu/history");
      url.searchParams.set("stationId", stationId);
      url.searchParams.set("date", date);
      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || res.statusText);
      return parseWUResponse(json);
    };

    const chunks = [];
    const CONC = 3;
    for (let i=0; i<dates.length; i+=CONC) chunks.push(dates.slice(i,i+CONC));
    for (const chunk of chunks) {
      const parts = await Promise.all(chunk.map(fetchOne));
      parts.forEach(r => allRows.push(...r));
      status.textContent = `Cargando… ${allRows.length} registros`;
    }

    // Pintar tabla y KPIs (reutilizamos lógica existente)
    const tbody = document.querySelector("#dataTable tbody");
    tbody.innerHTML = "";

    let minT = Infinity, maxT = -Infinity;

    allRows.forEach(r => {
      const t = typeof r.temp === "number" ? r.temp : null;
      if (typeof t === "number") {
        if (t < minT) minT = t;
        if (t > maxT) maxT = t;
      }
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${r.ti
function toCSV() {
  const rows = Array.from(document.querySelectorAll("#dataTable tbody tr"))
    .map(tr => Array.from(tr.children).map(td => `"${(td.textContent||"").replaceAll('"','""')}"`))
    .map(cols => cols.join(";"));

  const head = Array.from(document.querySelectorAll("#dataTable thead th"))
    .map(th => `"${(th.textContent||"").replaceAll('"','""')}"`)
    .join(";");

  const csv = [head, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  const fromISO = document.getElementById("dateFrom").value;
  const toISO   = document.getElementById("dateTo").value || fromISO;
  a.href = URL.createObjectURL(blob);
  a.download = `wu_${fromISO}_a_${toISO}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
xT.toFixed(1)} °C` : "—";

    status.textContent = "OK";
  } catch (err) {
    console.error(err);
    status.textContent = "Error: " + err.message;
  }
}


function toCSV() {
  const rows = Array.from(document.querySelectorAll("#dataTable tbody tr"))
    .map(tr => Array.from(tr.children).map(td => `"${(td.textContent||"").replaceAll('"','""')}"`))
    .map(cols => cols.join(";"));

  const head = Array.from(document.querySelectorAll("#dataTable thead th"))
    .map(th => `"${(th.textContent||"").replaceAll('"','""')}"`)
    .join(";");

  const csv = [head, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  const today = new Date().toISOString().slice(0,10);
  a.href = URL.createObjectURL(blob);
  a.download = `wu_${today}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

document.getElementById("loadBtn").addEventListener("click", loadData);
document.getElementById("csvBtn").addEventListener("click", toCSV);

// Pre-cargar hoy y estación por defecto



// --- cache buster for /api calls (added) ---
(function () {
  if (window.__apiCacheBusterInstalled) return;
  window.__apiCacheBusterInstalled = true;
  const _origFetch = window.fetch;
  window.fetch = function (input, init) {
    init = init || {};
    try {
      let urlStr = typeof input === "string" ? input : input.url;
      const u = new URL(urlStr, window.location.origin);
      if (u.pathname.startsWith("/api")) {
        u.searchParams.set("_", String(Date.now())); // cache-busting query
        init.cache = "no-store";
        init.headers = Object.assign({}, init.headers || {}, {
          "Cache-Control": "no-cache"
        });
        input = u.toString();
      }
    } catch (e) { /* ignore */ }
    return _origFetch.call(this, input, init);
  };
})();
// --- end cache buster (added) ---






// Pre-cargar hoy en ambos campos
(function init() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  const today = `${yyyy}-${mm}-${dd}`;
  const fromEl = document.getElementById("dateFrom");
  const toEl = document.getElementById("dateTo");
  if (fromEl) fromEl.value = today;
  if (toEl) toEl.value = today;
})();


