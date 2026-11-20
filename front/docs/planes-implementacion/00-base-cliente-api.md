# Plan 0 — Base: compilación, cliente HTTP y estándar de recurso

## Objetivo

Dejar lista la infraestructura que usan todos los demás planes:
- que el proyecto compile;
- un cliente HTTP único con errores normalizados;
- el estándar de archivo para un recurso de API;
- un conmutador mock/real **por módulo**, para conectar de a uno.

No conecta ningún módulo todavía.

## 1. Arreglar la compilación

`npx tsc -b` falla con 2 errores, porque al commit `3e72a03` le faltan cambios en `institution`:

| Archivo | Importa | Qué hacer |
|---|---|---|
| `modules/notifications/components/notification-message-preview.tsx:13` | `useSavedInstitutionName` de `institution/hooks/use-institution-profile` | Crear el hook: el nombre **guardado** (no el borrador), o `null` si está vacío. |
| `modules/notifications/lib/prepare-appointment-message.ts:3` | `readSavedInstitutionName` de `institution/types/institution.types` | Crear la función: lee el perfil guardado y devuelve `name.trim() \|\| null`. |

Antes de escribirlas, preguntarle a Josue si las tiene sin subir, para no duplicar.

**Terminado:** `npm run build` y `npm run lint` pasan. En el plan 2 ambas funciones pasan a leer de la API.

## 2. Mocks que se deshabilitan en este plan

Ninguno. `shared/lib/mock.ts` (`mockDelay`, `paginate`, `nextId`) se queda hasta el plan 11 y solo lo importan los archivos `*.mock.ts`.

## 3. Conmutador por módulo

Hoy `VITE_USE_MOCK_API` cambia **todo** a la vez. Para conectar de a uno, se agrega en `shared/lib/env.ts`:

```ts
// VITE_API_MODULES=auth,institution,patients  → esos módulos usan la API; el resto, el mock.
// VITE_USE_MOCK_API=false                     → todos usan la API (comportamiento actual).
const realModules = new Set((import.meta.env.VITE_API_MODULES ?? "").split(",").map((m: string) => m.trim()).filter(Boolean))
export const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000/api",
  useMockApi: import.meta.env.VITE_USE_MOCK_API !== "false",
  usesApi(module: ApiModule) { return !this.useMockApi || realModules.has(module) },
} as const
```

- `ApiModule` es una unión con los nombres de los planes:

  ```ts
  type ApiModule = "auth" | "institution" | "patients" | "agenda" | "treatments" | "inventory" | "clinical-history" | "notifications" | "finance" | "reports"
  ```
- Documentar `VITE_API_MODULES` en `.env.example`.
- **Regla:** un módulo solo se pasa a la API cuando ya lo están los que necesita (tabla del README). Mezclar, por ejemplo, citas reales con pacientes mock da `400 "El paciente no existe"`.

## 4. Cliente HTTP (`shared/lib/http.ts`)

| Cambio | Por qué |
|---|---|
| `withCredentials: true` | El navegador manda y guarda la cookie `clinicapp_refresh` (ruta `/api/auth`). El CORS del back ya tiene `AllowCredentials`. |
| Usar `normalizeProblem` de `api-problem.ts` en el interceptor de respuesta, y quitar `toFieldErrors` | Un solo formato de error. Lee el `ValidationProblemDetails` actual y también el formato de `ClinicApp.ErrorHandling` (`code`, `errors` como lista). Nunca muestra detalles de un `500`. |
| `ApiError` suma `kind`, `code` y `traceId` (en `shared/types/common.ts`), sin romper `message`, `status` ni `fieldErrors` | `getErrorMessage` y las pantallas siguen igual. `traceId` sirve para buscar el error en el log del servidor. |
| Las rutas de error de listas: `pathParts` de `field-issues.ts` ya convierte `plan[0].tooth` en `plan.0.tooth` | El pendiente "convertir `[0]` en `.0`" **ya está resuelto** para los formularios que usan `applyServerFieldErrors`. Revisar que todos lo usen (ver los planes 3 y 7). |
| El manejo del `401` (renovar la sesión) | Se mueve al plan 1. Aquí solo se deja el punto de extensión. |

## 5. Estándar de recurso de API

Cada módulo pasa de un `<módulo>.api.ts` mezclado a esta estructura:

```
modules/patients/api/
  patients.contract.ts   interfaz PatientsApi (los métodos que usan los hooks)
  patients.http.ts       implementación real: solo llamadas http + mapeo DTO → modelo
  patients.mock.ts       implementación de demostración (antes listMock, getMock…)
  patients.mock-data.ts  datos de demostración (sin cambios)
  patients.api.ts        elige una sola vez: export const patientsApi: PatientsApi = env.usesApi("patients") ? httpPatientsApi : mockPatientsApi
  patients.queries.ts    hooks de React Query (sin cambios de forma)
```

**`patients.contract.ts`:**

```ts
export interface PatientsApi {
  list(query: PatientsQuery, signal?: AbortSignal): Promise<Paginated<Patient>>
  get(id: string, signal?: AbortSignal): Promise<Patient>
  create(values: PatientFormValues): Promise<Patient>
  update(id: string, values: PatientFormValues): Promise<Patient>
  remove(id: string): Promise<void>
}
```

**`patients.http.ts`:**

```ts
import type { components } from "@/shared/api/schema"        // tipos generados (ver 6)
type PatientDto = components["schemas"]["PatientDto"]

const toPatient = (dto: PatientDto): Patient => ({ ...dto, documentType: dto.documentType ?? undefined })

export const httpPatientsApi: PatientsApi = {
  async list(query, signal) {
    const page = await apiGet<Paginated<PatientDto>>("/patients", { params: query, signal })
    return { ...page, items: page.items.map(toPatient) }
  },
  async get(id, signal) { return toPatient(await apiGet<PatientDto>(`/patients/${id}`, { signal })) },
  async create(values) { return toPatient(await apiPost<PatientDto>("/patients", values)) },
  async update(id, values) { return toPatient(await apiPut<PatientDto>(`/patients/${id}`, values)) },
  async remove(id) { await apiDelete(`/patients/${id}`) },
}
```

**Helpers en `shared/lib/http.ts`:** `apiGet`, `apiPost`, `apiPut`, `apiPatch` y `apiDelete`, que devuelven `data` directamente. También `apiBlob`, para los adjuntos, y `apiForm`, para multipart.

**Reglas del estándar:**
1. Las pantallas y los hooks solo importan `<módulo>Api` (o los hooks), nunca `*.http.ts` ni `*.mock.ts`.
2. `*.http.ts` no tiene lógica de negocio: valida el servidor. Si una regla vive en el mock (choques de citas, FEFO, saldos), en la versión real **no se copia**.
3. Las conversiones `null` → `undefined`, fechas y campos calculados se hacen en el mapeo de `*.http.ts`, no en las pantallas.
4. `queryFn: ({ signal }) => patientsApi.list(query, signal)`: las búsquedas viejas se cancelan.
5. Los efectos que hace el servidor (notificaciones, descuento de stock) **no** existen en el contrato: si el mock los necesita, los hace dentro de su propia implementación.
6. `fetchAllPages(list, pageSize = 100)` va en `shared/lib/pagination.ts` y reemplaza las tres copias:
   - `allPages` en `use-treatment-options.ts`;
   - el bucle de `use-inventory-catalog.ts`;
   - `collectAlertPages` en `use-global-alerts.ts`.

El paso a este estándar se hace **en cada plan**, al conectar su módulo, no todo de una vez aquí. Aquí se dejan solo los helpers, la utilidad de paginación y el ejemplo.

## 6. Tipos generados desde OpenAPI

- Agregar `openapi-typescript` como `devDependency` y el script:

  ```json
  "api:types": "openapi-typescript http://localhost:5000/openapi/v1.json -o src/shared/api/schema.d.ts"
  ```
- `schema.d.ts` se sube al repo, para que compile sin el back levantado, y se regenera cuando cambia un endpoint.
- Revisar que el back publique los DTO con nombres estables. Hoy son `PatientDto`, `AppointmentDto`, etc.

## 7. Cambios necesarios en el back

Ninguno.
- **CORS:** `Cors:AllowedOrigins` en `appsettings.Development.json` ya incluye `http://localhost:5173`. Confirmar que también esté el puerto de las pruebas E2E (`127.0.0.1:5175`).
- **Producción:** el origen real se configura con `Cors__AllowedOrigins__0`.

## 8. Verificación

- `npm run build` y `npm run lint` sin errores.
- **Prueba unitaria de `normalizeProblem`:** un `400` de la API real con `errors["lines[0].itemId"]` y un `500` con `detail` (que no debe mostrarse). Agregar Vitest si se decide tener pruebas unitarias en el front; hoy solo hay Playwright.
- **E2E en modo mock:** las 58 pruebas de Playwright siguen pasando con `VITE_USE_MOCK_API=true`.

## 9. Terminado

- El proyecto compila.
- `env.usesApi(módulo)` existe.
- `http.ts` usa `withCredentials` y `normalizeProblem`.
- Están los helpers `api*`, `fetchAllPages` y el script `api:types`.
- `arquitectura-frontend.md` explica el estándar de recurso.
