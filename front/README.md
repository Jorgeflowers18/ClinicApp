# ClinicApp — frontend

React 19 + TypeScript + Vite, con React Query, React Hook Form + Zod y Zustand. La arquitectura y las convenciones están en [`../documentacion/arquitectura-frontend.md`](../documentacion/arquitectura-frontend.md).

## Levantar

```bash
npm install
npm run dev          # http://localhost:5173
```

### Modo demostración o API

El frontend funciona de dos formas, según `.env` (ver `.env.example`):

| Variable | Valor | Qué hace |
|---|---|---|
| `VITE_USE_MOCK_API` | `true` | **Demostración:** todo en el navegador, con datos de ejemplo (cuentas `admin@clinica.com` / `admin123`, `recepcion@clinica.com` / `recepcion123`, `medico@clinica.com` / `medico123`). |
| `VITE_USE_MOCK_API` | `false` | **API:** todos los módulos usan el back. |
| `VITE_API_MODULES` | `auth,patients,…` | Con la demostración activa, solo esos módulos usan la API (para conectar de a uno). |
| `VITE_API_BASE_URL` | `http://localhost:5000/api` | Dirección de la API. |

### Contra el back

1. Levantar el back (ver [`../back/README.md`](../back/README.md)): la base en Docker (`clinicapp-db`) y la API en `http://localhost:5000`. En desarrollo, el back crea las mismas tres cuentas de prueba.
2. En `.env.local`: `VITE_USE_MOCK_API=false`.
3. `npm run dev`. El CORS de desarrollo del back permite `http://localhost:5173` (con credenciales, para la cookie de sesión).

La sesión dura 15 minutos y se renueva sola con la cookie `httpOnly` del back; el token nunca se guarda en el navegador.

## Scripts

| Script | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo. |
| `npm run build` | Compila TypeScript y genera `dist/`. |
| `npm run lint` | Oxlint. |
| `npm run api:types` | Regenera `src/shared/api/schema.d.ts` desde el OpenAPI del back (con la API levantada). Hacerlo cada vez que cambie un endpoint. |
| `npm run test:e2e` | Pruebas de Playwright. Necesitan Vite en `http://127.0.0.1:5175` en modo demostración (`npx vite --host 127.0.0.1 --port 5175`), o `CLINIC_TEST_URL` con otra dirección. |

**Pruebas E2E:** si se levantan varios Vite a la vez (por ejemplo el de desarrollo y el de pruebas), cada uno debe usar su propia carpeta de caché (`cacheDir`); si comparten `node_modules/.vite`, se reoptimizan entre sí y la página carga dos copias de React. Después de cambiar un archivo con el Vite de pruebas corriendo, reiniciarlo: las pruebas que reemplazan funciones de un módulo (`import("/src/…")`) podrían tocar otra instancia del módulo.

## Conectar un recurso nuevo a la API

Cada módulo sigue el mismo estándar (`documentacion/arquitectura-frontend.md` § "Patrón mock ↔ real"):

```
modules/<módulo>/api/
  <módulo>.contract.ts   interfaz con los métodos que usan los hooks
  <módulo>.http.ts       llamadas api* + mapeo DTO → modelo (tipos de src/shared/api/schema.d.ts)
  <módulo>.mock.ts       implementación de demostración
  <módulo>.api.ts        export const xApi = env.usesApi("<módulo>") ? httpXApi : mockXApi
  <módulo>.queries.ts    hooks de React Query (queryFn con signal)
```
