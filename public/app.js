// ===== Helpers =====
function toYYYYMMDD(iso) {
  return iso.replaceAll('-', '');
}
function fmt(x, d=0) {
  if (x == null || Number.isNaN(x)) return '—';
  if (typeof x !== 'number') return x;
  return x.toFixed(d);
}
function eachDateISO(fromISO, toISO) {
  const from = new Date(fromISO);
  const to = new Date(toISO);
  const dates = [];
  for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    dates.push(`${yyyy}-${mm}-${dd}`);
  }
  return dates;
}

// Simulación de parseWUResponse para la demo (sustituye por tu parser real)
function parseWUResponse(json) {
  // Espera un array en json.rows [{timeLocal, temp, ...}]
  return json.rows || [];
}

// ===== Lógica principal =====
async function loadData() {
  const stationEl = document.getElementById("stationId");
const stationId = (stationEl?.value || "ESTACION_POR_DEFECTO").trim();
  const fromISO = document.getElementById("dateFrom").value;
  const toISO   = document.getElementById("dateTo").value || fromISO;

  const status = document.getElementById("status");
  status.textContent = "Cargando…";

  if (!fromISO) {
    status.textContent = "El campo 'Desde' es obligatorio.";
    return;
  }

  let startISO = fromISO, endISO = toISO;
  if (new Date(endISO) < new Date(startISO)) {
    const tmp = startISO; startISO = endISO; endISO = tmp;
  }

  try {
    const dates = eachDateISO(startISO, endISO);
    const allRows = [];

    const fetchOne = async (iso) => {
      // En tu app real esto llamará al backend Node:
      // GET /api/wu/history?stationId=...&date=YYYYMMDD
      // Aquí simulamos una respuesta con datos dummy.
      await new Promise(r => setTimeout(r, 150)); // simular latencia
      const rows = [];
      for (let i=0;i<3;i++) {
        rows.push({
          timeLocal: `${iso} ${String(8+i).padStart(2,'0')}:00`,
          temp: 20 + Math.random()*5,
          dew:  10 + Math.random()*3,
          rh:   50 + Math.round(Math.random()*20),
          pres: 1010 + Math.random()*5,
          w:    5 + Math.random()*3,
          gust: 7 + Math.random()*5,
          dir:  180,
          precipRate: Math.random() < 0.2 ? Math.random() : 0,
          precipTotal: Math.random() < 0.2 ? Math.random()*5 : 0,
          uv:   Math.random()*6,
          rad:  300 + Math.random()*200
        });
      }
      return rows;
    };

    const CONC = 3;
    for (let i = 0; i < dates.length; i += CONC) {
      const chunk = dates.slice(i, i + CONC);
      const parts = await Promise.all(chunk.map(fetchOne));
      parts.forEach(r => allRows.push(...r));
      status.textContent = `Cargando… ${allRows.length} registros`;
    }

    const tbody = document.querySelector("#dataTable tbody");
    tbody.innerHTML = "";
    allRows.forEach(r => {
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
        <td>${fmt(r.precipRate,2)}</td>
        <td>${fmt(r.precipTotal,2)}</td>
        <td>${fmt(r.uv,1)}</td>
        <td>${fmt(r.rad,1)}</td>
      `;
      tbody.appendChild(tr);
    });

    status.textContent = `OK (${allRows.length} registros)`;
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
  const fromISO = document.getElementById("dateFrom").value;
  const toISO   = document.getElementById("dateTo").value || fromISO;
  a.href = URL.createObjectURL(blob);
  a.download = `wu_${fromISO}_a_${toISO}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

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

  document.getElementById("btnLoad").addEventListener("click", loadData);
  document.getElementById("btnCSV").addEventListener("click", toCSV);
})();

