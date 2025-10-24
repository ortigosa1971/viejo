// ===== Utilidades =====
// Justo arriba, fuera de cualquier función
const FIXED_STATION_ID = "IALFAR32";

// Y dentro de loadRange(), reemplaza esta línea:
const stationId = document.getElementById("stationId").value.trim();
// por esto:
const stationId = FIXED_STATION_ID;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const fmtNum = (x, d=0) => (x == null || Number.isNaN(x)) ? '—' : (typeof x === 'number' ? x.toFixed(d) : x);
const clamp = (a, b, c) => Math.max(a, Math.min(b, c));

function toYYYYMMDD(iso) { return iso.replaceAll('-', ''); }

function parseWUResponseSafe(json) {
  // Usa la función existente si tu proyecto ya define parseWUResponse(json)
  if (typeof window.parseWUResponse === 'function') return window.parseWUResponse(json);
  // Fallback genérico: intenta deducir filas
  if (Array.isArray(json?.rows)) return json.rows;
  if (Array.isArray(json?.observations)) return json.observations;
  return [];
}

function eachDateISO(fromISO, toISO) {
  const from = new Date(fromISO), to = new Date(toISO);
  const dates = [];
  for (let d = new Date(from); d <= to; d.setDate(d.getDate()+1)) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    dates.push(`${yyyy}-${mm}-${dd}`);
  }
  return dates;
}

function showToast(msg, ms=2600) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), ms);
}

function setLoading(isLoading) {
  $("#backdrop").classList.toggle("hidden", !isLoading);
  $("#btnLoad").disabled = isLoading;
}

// ===== Datos =====
async function fetchDay(stationId, iso) {
  const url = new URL(location.origin + "/api/wu/history");
  url.searchParams.set("stationId", stationId);
  url.searchParams.set("date", toYYYYMMDD(iso));
  const res = await fetch(url);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || res.statusText);
  return parseWUResponseSafe(json);
}

async function loadRange() {
  const stationId = $("#stationId").value.trim();
  const fromISO = $("#dateFrom").value;
  const toISO   = $("#dateTo").value || fromISO;

  if (!stationId) { showToast("Station ID es obligatorio"); return; }
  if (!fromISO)   { showToast("Selecciona la fecha 'Desde'"); return; }

  let startISO = fromISO, endISO = toISO;
  if (new Date(endISO) < new Date(startISO)) [startISO, endISO] = [endISO, startISO];

  setLoading(true);
  $("#status").textContent = "Cargando…";
  $("#btnCSV").disabled = true;

  try {
    const dates = eachDateISO(startISO, endISO);
    const all = [];

    // Descargas en paralelo por lotes
    const CONC = 3;
    for (let i=0; i<dates.length; i+=CONC) {
      const chunk = dates.slice(i, i+CONC);
      const parts = await Promise.all(chunk.map(d => fetchDay(stationId, d)));
      parts.forEach(rows => all.push(...rows));
      $("#status").textContent = `Cargando… ${all.length} registros`;
    }

    renderTable(all);
    computeKPIs(all);
    $("#status").textContent = `OK (${all.length} registros)`;
    $("#btnCSV").disabled = all.length === 0;
  } catch (err) {
    console.error(err);
    $("#status").textContent = "Error";
    showToast(err.message || "Error al cargar datos");
  } finally {
    setLoading(false);
  }
}

function renderTable(rows) {
  const tb = $("#dataTable tbody");
  tb.innerHTML = "";
  for (const r of rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.timeLocal ?? r.obsTimeLocal ?? r.obsTime ?? "—"}</td>
      <td>${fmtNum(r.temp,1)}</td>
      <td>${fmtNum(r.dew,1)}</td>
      <td>${fmtNum(r.rh)}</td>
      <td>${fmtNum(r.pres,1)}</td>
      <td>${fmtNum(r.w,1)}</td>
      <td>${fmtNum(r.gust,1)}</td>
      <td>${fmtNum(r.dir)}</td>
      <td>${fmtNum(r.precipRate,2)}</td>
      <td>${fmtNum(r.precipTotal,2)}</td>
      <td>${fmtNum(r.uv,1)}</td>
      <td>${fmtNum(r.rad,1)}</td>
    `;
    tb.appendChild(tr);
  }
}

function computeKPIs(rows) {
  let count = rows.length, minT = Infinity, maxT = -Infinity;
  for (const r of rows) {
    const t = (typeof r.temp === "number") ? r.temp : null;
    if (t != null) { if (t < minT) minT = t; if (t > maxT) maxT = t; }
  }
  $("#kpiCount").textContent = String(count);
  $("#kpiMin").textContent = Number.isFinite(minT) ? `${minT.toFixed(1)} °C` : "—";
  $("#kpiMax").textContent = Number.isFinite(maxT) ? `${maxT.toFixed(1)} °C` : "—";
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
  const fromISO = $("#dateFrom").value;
  const toISO   = $("#dateTo").value || fromISO;
  a.href = URL.createObjectURL(blob);
  a.download = `wu_${fromISO}_a_${toISO}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function applyPreset(name) {
  const today = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

  let a = new Date(today), b = new Date(today);
  if (name === "ayer") { a.setDate(a.getDate()-1); b.setDate(b.getDate()-1); }
  if (name === "ult7") { a.setDate(a.getDate()-6); }
  if (name === "mes")  { a = new Date(today.getFullYear(), today.getMonth(), 1); }

  $("#dateFrom").value = toISO(a);
  $("#dateTo").value   = toISO(b);
}

(function init(){
  // Fechas por defecto: hoy
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const today = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  $("#dateFrom").value = today;
  $("#dateTo").value   = today;

  // Eventos
  $("#btnLoad").addEventListener("click", loadRange);
  $("#btnCSV").addEventListener("click", toCSV);
  $$("# .chip".trim()).forEach(ch => ch.addEventListener("click", () => applyPreset(ch.dataset.preset)));
  $("#helpLink").addEventListener("click", (e) => {
    e.preventDefault();
    showToast("Elige rango y pulsa Cargar. Exporta con CSV.");
  });
})();
