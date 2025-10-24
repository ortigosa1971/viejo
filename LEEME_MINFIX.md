# Arreglo mínimo del botón "Cargar datos"
Se ha modificado `public/app.js` para que no falle si no existe `<input id="stationId">`.
Ahora usa un valor por defecto `IALFAR32`:

```js
const stationEl = document.getElementById("stationId");
const stationId = (stationEl?.value || "IALFAR32").trim();
```
