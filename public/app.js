function getStationIdFromRails() {
  const meta = document.querySelector('meta[name="wu-station-id"]');
  return meta?.content || "IALFAR32";
}

function toYYYYMMDD(iso) { return iso.replaceAll('-', ''); }
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
function parseWUResponse(json) { return json.rows || json.observations || []; }

async function fetchJsonSafe(url) {
  const res = await fetch(url);
  const ct = res.headers.get("content-type") || "";
  const isJSON = ct.includes("application/json") || ct.includes("+json");
  let payload;
  try {
    payload = isJSON ? await res.json() : await res.text();
  } catch (e) {
    // si falla el parseo json(), cae a texto
    try { payload = await res.text(); } catch (_) { payload = ""; }
  }
  if (!res.ok) {
    const msg = (isJSON ? (payload?.error || payload?.message) : String(payload || "")).trim();
    const hint = msg ? ` (${msg})` : "";
    throw new Error(`${res.status} ${res.statusText}${hint}`);
  }
  if (!isJSON) {
    throw new Error(`Respuesta inesperada del servidor: no es JSON (${res.status} ${res.statusText})`);
  }
  return payload;
}

async function loadRange() {
  const stationId = getStationIdFromRails();
  const fromISO = document.getElementById("dateFrom").value;
  const toISO = document.getElementById("dateTo").value || fromISO;
  const status = document.getElementById("status");

  if (!fromISO) { status.textContent = "El campo 'Desde' es obligatorio."; return; }
  status.textContent = "Cargando…";

  let startISO = fromISO, endISO = toISO;
  if (new Date(endISO) < new Date(startISO)) [startISO, endISO] = [endISO, startISO];

  try {
    const dates = eachDateISO(startISO, endISO);
    const allRows = [];
    const fetchOne = async (iso) => {
      const url = new URL(location.origin + "/api/wu/history");
      url.searchParams.set("stationId", stationId);
      url.searchParams.set("date", toYYYYMMDD(iso));
      // Log para depurar (lo verás en Network/Console)
      console.debug("GET", url.toString());
      const json = await fetchJsonSafe(url);
      return parseWUResponse(json);
    };
    const CONC = 3;
    for (let i=0;i<dates.length;i+=CONC){
      const chunk = dates.slice(i,i+CONC);
      const parts = await Promise.all(chunk.map(fetchOne));
      parts.forEach(r=>allRows.push(...r));
      status.textContent = `Cargando… ${allRows.length} registros`;
    }
    const tbody=document.querySelector("#dataTable tbody");
    tbody.innerHTML="";
    allRows.forEach(r=>{
      const tr=document.createElement("tr");
      tr.innerHTML=`
        <td>${r.timeLocal ?? r.obsTimeLocal ?? "—"}</td>
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
        <td>${fmt(r.rad,1)}</td>`;
      tbody.appendChild(tr);
    });
    status.textContent=`OK (${allRows.length} registros)`;
  } catch(err){
    console.error(err);
    status.textContent="Error: "+err.message;
    alert("No se pudieron obtener datos.\n\nDetalle: " + err.message + "\n\nRevisa la pestaña Network de DevTools para ver la respuesta exacta del servidor.");
  }
}

(function init(){
  const d=new Date();
  const yyyy=d.getFullYear(), mm=String(d.getMonth()+1).padStart(2,'0'), dd=String(d.getDate()).padStart(2,'0');
  const today=`${yyyy}-${mm}-${dd}`;
  document.getElementById("dateFrom").value=today;
  document.getElementById("dateTo").value=today;
  document.getElementById("btnLoad").addEventListener("click",loadRange);
})();
