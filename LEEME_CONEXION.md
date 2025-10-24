# Conexión a Weather Underground (Rails + Front en public/)

## Qué incluye
- `public/app.js`: ahora llama a `/api/wu/history?date=YYYYMMDD` (Rails guarda la estación y la API key).
- `app/controllers/api/wu_controller.rb`: controlador Rails que consulta la API de WU.
- `config/routes.rb.patch`: snippet para rutas.
- `.env.example`: variables necesarias.

## Pasos de integración
1. Copia `public/` sobre el `public/` de tu proyecto Rails.
2. Copia `app/controllers/api/wu_controller.rb` (crea directorios si no existen).
3. Abre `config/routes.rb` y añade:
   ```ruby
   namespace :api do
     get 'wu/history', to: 'wu#history'
   end
   ```
4. Configura variables de entorno o credenciales:
   - ENV: `WU_STATION_ID` y `WU_API_KEY`
   - Credenciales (`bin/rails credentials:edit`):
     ```yaml
     wu:
       station_id: IALFAR32
       api_key: 43c4f747135944db84f747135914db79
     ```
5. Arranca Rails (`bin/rails s`) y abre el front. El botón **Cargar datos** pedirá a `/api/wu/history` por cada día del rango.

## Notas
- Si usas autenticación CSRF tradicional, este endpoint JSON usa `protect_from_forgery with: :null_session`.
- Front y backend en el mismo dominio → no necesitas CORS.
- El front ya no envía `stationId`; Rails usa los valores del entorno.
