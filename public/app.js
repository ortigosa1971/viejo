// public/app.js
function toYYYYMMDD(d) {
  // Input: 'YYYY-MM-DD' from <input type="date">
  if (!d) return "";
  return d.replaceAll("-", "");
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
    // metric object may be under 'metric' or direct fields; prefer 'metric'
    const m = o.metric ?? o;
    const tLocal = o.obsTimeLocal ?? o.obsTimeUtc ?? o.epoch ? new Date((o.epoch || 0) * 1000).toISOString() : "";
    return {
      timeLocal: o.obsTimeLocal ?? tLocal,
      temp: m?.tempAvg ?? m?.temp ?? null,
      dew: m?.dewptAvg ?? m?.dewpt ?? null,
      rh: o.humidityAvg ?? m?.humidity ?? null,
      pres: m?.pressure ?? m?.pressureMax ?? m?.pressureMin ?? null,
      w: m?.windspeedAvg ?? m?.windspeed ?? null,
      gust: m?.windgustHigh ?? m?.windgust ?? null,
      dir: o.winddirAvg ?? m?.winddir ?? null,
      precip: m?.precipRate ?? m?.precipTotal ?? null,
      uv: o.uvHigh ?? o.uv ?? null,
      rad: o.solarRadiationHigh ?? o.solarRadiation ?? null,
      // for min/max
      tempLow: m?.tempLow,
      tempHigh: m?.tempHigh,
    };
  });
}

async function loadData() {
  const stationId = document.getElementById("stationId").value.trim();
  const dateISO = document.getElementById("date").value; // YYYY-MM-DD
  const date = toYYYYMMDD(dateISO);

  const status = document.getElementById("status");
  status.textContent = "Cargando…";

  try {
    const url = new URL(location.origin + "/api/wu/history");
    url.searchParams.set("stationId", stationId);
    url.searchParams.set("date", date);

    const res = await fetch(url);
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json?.error || JSON.stringify(json).slice(0,200));
    }

    const rows = parseWUResponse(json);
    const tbody = document.querySelector("#dataTable tbody");
    tbody.innerHTML = "";

    let minT = +Infinity, maxT = -Infinity;

    rows.forEach(r => {
      const t = r.temp ?? r.tempLow ?? r.tempHigh;
      if (typeof t === "number") {
        if (t < minT) minT = t;
        if (t > maxT) maxT = t;
      }

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${r.timeLocal ?? "—"}</td>
        <td>${fmt(r.temp,1)}</td>
        <td>${fmt(r.dew,1)}</td>
        <td>${fmt(r.rh)}</td>
        <td>${fmt(r.pres,1)}</td>
        <td>${fmt(r.w,1)}</td>
        <td>${fmt(r.gust,1)}</td>
        <td>${fmt(r.dir)}</td>
        <td>${fmt(r.precip,2)}</td>
        <td>${fmt(r.uv,1)}</td>
        <td>${fmt(r.rad,1)}</td>
      `;
      tbody.appendChild(tr);
    });

    // KPIs
    document.getElementById("kpiCount").textContent = rows.length.toString();
    document.getElementById("kpiMin").textContent = Number.isFinite(minT) ? `${minT.toFixed(1)} °C` : "—";
    document.getElementById("kpiMax").textContent = Number.isFinite(maxT) ? `${maxT.toFixed(1)} °C` : "—";

    status.textContent = "OK";
  } catch (err) {
    console.error(err);
    status.textContent = "Error: " + err.message;
  }
}

function toCSV() {
  const rows = Array.from(document.querySelectorAll("#dataTable tbody tr"))
    .map(tr => Array.from(tr.children).map(td => `"${(td.textContent||"").replaceAll('"','""')}"`))
    .map(cols => cols.join(","));

  const head = Array.from(document.querySelectorAll("#dataTable thead th"))
    .map(th => `"${(th.textContent||"").replaceAll('"','""')}"`)
    .join(",");

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
(function init() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  document.getElementById("date").value = `${yyyy}-${mm}-${dd}`;
})();
