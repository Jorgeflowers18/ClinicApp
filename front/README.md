# ClinicApp — frontend

React 19 + TypeScript + Vite, con React Query, React Hook Form + Zod y Zustand. La arquitectura y las convenciones están en [`../documentacion/arquitectura-frontend.md`](../documentacion/arquitectura-frontend.md).

## Levantar

```bash
npm install
npm run dev          # http://localhost:5173
```

### Contra el back

El frontend siempre usa la API. La única variable es `VITE_API_BASE_URL` (por defecto `http://localhost:5000/api`; ver `.env.example`).

1. Levantar el back (ver [`../back/README.md`](../back/README.md)): la base en Docker (`clinicapp-db`) y la API en `http://localhost:5000`. En desarrollo, el back crea tres cuentas de prueba: `admin@clinica.com` / `admin123`, `recepcion@clinica.com` / `recepcion123` y `medico@clinica.com` / `medico123`.
2. `npm run dev`. El CORS de desarrollo del back permite `http://localhost:5173` (con credenciales, para la cookie de sesión).

La sesión dura 15 minutos y se renueva sola con la cookie `httpOnly` del back; el token nunca se guarda en el navegador.

El modo demostración (datos de ejemplo en el navegador, sin back) se quitó de esta rama; se conserva en la rama `jf/front-demo-mocks`.

## Scripts

| Script | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo. |
| `npm run build` | Compila TypeScript y genera `dist/`. |
| `npm run lint` | Oxlint. |
| `npm run api:types` | Regenera `src/shared/api/schema.d.ts` desde el OpenAPI del back (con la API levantada). Hacerlo cada vez que cambie un endpoint. |
| `npm run test:e2e` | Pruebas de Playwright contra la API real, con una base de datos propia que se borra al terminar (abajo). |

## Pruebas E2E

```bash
npm run test:e2e                          # todas
npm run test:e2e -- tests/auth.spec.ts    # argumentos extra para Playwright
```

Solo necesitan el contenedor `clinicapp-db` encendido. `scripts/run-api-e2e.mjs` hace todo lo demás:

1. compila la API;
2. borra `clinicapp_e2e` si quedó de una corrida anterior y la crea con todas las migraciones;
3. levanta la API en `http://127.0.0.1:5100` (entorno Development: crea las cuentas de prueba, profesionales y consultorios; adjuntos en una carpeta temporal; notificaciones solo al log) y un Vite propio en `http://127.0.0.1:5185`;
4. corre Playwright (`tests/`);
5. **siempre** apaga la API y Vite, **borra la base `clinicapp_e2e`** y la carpeta de adjuntos, aunque las pruebas fallen o se corte con Ctrl+C. Después comprueba que la base ya no exista; si no pudo borrarla, lo dice, muestra el comando para hacerlo a mano y termina con error.

**Seguridad:** el nombre de la base es fijo (`clinicapp_e2e`) y el servidor debe ser local (`localhost`, `127.0.0.1` o `::1`); si no, el script no corre. Nunca toca la base de desarrollo (`clinicapp`), la de las pruebas del back (`clinicapp_test`) ni la de producción. Solo se pueden cambiar el puerto y las credenciales locales (`E2E_DB_PORT`, `E2E_DB_USER`, `E2E_DB_PASSWORD`) y el contenedor (`E2E_DB_CONTAINER`). Con `E2E_VERBOSE=1` se ve la salida de la API y de Vite.

Las pruebas crean sus propios datos por la API (pacientes con nombres únicos), así que no dependen del orden ni de datos fijos. Para correr Playwright contra otro servidor ya levantado: `CLINIC_TEST_URL` (front) y `E2E_API_URL` (API) con `npx playwright test`.

El Vite de las pruebas usa su propia caché (`node_modules/.vite-e2e`): si dos Vite comparten `node_modules/.vite`, se reoptimizan entre sí y la página carga dos copias de React.

## Conectar un recurso nuevo a la API

Cada módulo sigue el mismo estándar (`documentacion/arquitectura-frontend.md` § "Patrón de recurso de API"):

```
modules/<módulo>/api/
  <módulo>.contract.ts   interfaz con los métodos que usan los hooks
  <módulo>.http.ts       llamadas api* + mapeo DTO → modelo (tipos de src/shared/api/schema.d.ts)
  <módulo>.api.ts        export const xApi: XApi = httpXApi
  <módulo>.queries.ts    hooks de React Query (queryFn con signal)
```
