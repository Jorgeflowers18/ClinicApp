# Planes para conectar el frontend con la API

Estado al **2026-11-20**. El backend tiene los **91 endpoints** listos (`back/docs/endpoints-api.md`), incluido todo lo que estos planes le pedían al back. El frontend sigue funcionando con los mocks (`VITE_USE_MOCK_API=true`). Estos planes describen, módulo por módulo, qué mocks se apagan y cómo se reemplaza cada uno por la llamada real.

Donde un plan dice **"estándar del plan 0"**, el estándar está en `documentacion/arquitectura-frontend.md` § "Patrón mock ↔ real": `*.contract.ts`, `*.http.ts`, `*.mock.ts` y `*.api.ts` con `env.usesApi(módulo)`, los helpers `api*` de `shared/lib/http.ts`, `fetchAllPages` y los tipos de `src/shared/api/schema.d.ts` (`npm run api:types`).

**Flujo de trabajo:** un plan por módulo. Al terminarlo se hace el commit, se registra el cambio en `documentacion/arquitectura-frontend.md` y se borra el plan. Lo que quede pendiente se anota en `back/backlog-desgloce.md` § "Pendientes al cerrar los planes".

## Orden

El orden importa: las pantallas se cruzan por id (una cita apunta a un paciente, una atención a una cita y a un tratamiento), y un id del mock (`pat_1`) no existe en la base. Por eso cada módulo se conecta después de los que necesita.

| # | Plan | Necesita | Cambios en el back |
|---|---|---|---|
| 0 | ✅ Hecho (2026-11-21). Base: compilación, cliente HTTP, errores, estándar de recurso y conmutador por módulo | — | ✅ OpenAPI con números solo como números (`024cb45`) |
| 1 | ✅ Hecho (2026-11-21). `auth`: sesión, renovación, perfil, recuperación y solicitud de acceso | 0 | No |
| 2 | ✅ Hecho (2026-11-21). `institution`: perfil de la clínica, marca y sedes | 1 | ✅ `subtitle` (`53b1d64`) |
| 3 | ✅ Hecho (2026-11-21). `patients` | 1 | ✅ `documentType`, teléfono opcional, filtros y lista de dados de baja (`a5f633a`) |
| 4 | ✅ Hecho (2026-11-21). Agenda: profesionales, consultorios, citas y bloqueos | 3 | ✅ `patientName` en las citas (este plan) |
| 5 | [`05-treatments.md`](./05-treatments.md): catálogo y tratamientos realizados | 3 | No |
| 6 | [`06-inventory.md`](./06-inventory.md) | 4 (responsables de esterilización) | No |
| 7 | [`07-clinical-history.md`](./07-clinical-history.md): historia, atenciones, adjuntos y archivo clínico | 3, 4, 5 | ✅ Archivo clínico (`9dd2426`) y registro de la atención en una transacción (`fad02ef`) |
| 8 | [`08-notifications.md`](./08-notifications.md): plantilla, historial, mensajería y alertas | 2, 3, 4 | ✅ `GET /alerts`, y `patientName` y `message` en el historial (`d0aeeed`) |
| 9 | [`09-finance.md`](./09-finance.md): cartera, resúmenes y pagos | 3, 5 | No |
| 10 | [`10-reports-dashboard.md`](./10-reports-dashboard.md): reportes e Inicio | 4–9 | No |
| 11 | [`11-cierre.md`](./11-cierre.md): apagar el modo mock por defecto, pruebas E2E reales y limpieza | todos | No |

**El back ya no bloquea ningún plan:** lo que los planes 2, 3, 7 y 8 le pedían está implementado, con pruebas, y documentado en `back/docs/endpoints-api.md`. Queda una sola decisión de la clínica que afecta al frontend: si el teléfono del paciente es opcional. La API ya lo acepta vacío.

Los planes 5 y 6 se pueden hacer en paralelo con el 4.

## Hallazgos de la revisión del frontend (2026-11-20)

1. **El frontend no compila.** `npx tsc -b` da 2 errores: `useSavedInstitutionName` (`notification-message-preview.tsx:13`) y `readSavedInstitutionName` (`prepare-appointment-message.ts:3`) no existen. El commit `3e72a03` ("Actualiza ClinicApp") solo agregó archivos nuevos; los cambios que esos archivos necesitaban en `institution` no se subieron. ✅ Corregido en el plan 0.
2. **El back recibió un proyecto nuevo, `back/ClinicApp.ErrorHandling`,** con otro formato de error (`code`, `errors` como lista). La API no lo referencia, así que hoy no cambia nada. El plan 0 deja el frontend preparado para los dos formatos; adoptarlo en la API es otra decisión.
3. **El frontend había avanzado más que el contrato del back** en cuatro puntos. Los tres primeros ya están en el back:
   - el tipo de documento del paciente y los filtros de la lista;
   - el subtítulo de la institución;
   - el archivo clínico digital (metadatos, categorías, etiquetas y archivado de archivos).

   El cuarto, los pagos con estado `reversado`, espera la etapa B de finanzas: el frontend lo deja sin uso (plan 9).
4. **Mocks con efectos que en la API hace el servidor:**
   - las notificaciones de las citas;
   - el descuento de insumos;
   - el número de historia;
   - la cartera de finanzas.

   Al conectar hay que **quitar** esas llamadas del frontend, no reemplazarlas.
5. **Lecturas masivas:**
   - las alertas globales leen todos los pacientes, todas las citas y todo el inventario;
   - la agenda y la vista previa de mensajería leen todas las citas.

   Con 820 pacientes eso son muchas peticiones. Las alertas tienen ahora una sola petición (`GET /alerts`, plan 8) y la agenda se pide por rango (`?from&to`, plan 4).

## El estándar que falta para un recurso de API reutilizable

Hoy cada archivo `<módulo>.api.ts` mezcla tres cosas:
- el mock;
- la llamada real;
- la decisión `env.useMockApi ? xMock : xReal`, repetida función por función.

Faltan cuatro piezas, que el plan 0 implementa:

1. **Un contrato por recurso (patrón *repositorio*, o puerto y adaptadores).** Una interfaz `PatientsApi` con sus métodos, y dos implementaciones separadas: `patients.http.ts` (real) y `patients.mock.ts` (demostración). Las pantallas y los hooks dependen solo de la interfaz, y la elección se hace **una sola vez** por módulo. Así el mock no se cuela en producción y se puede borrar sin tocar las pantallas.
2. **Un cliente HTTP único que normaliza errores.** `shared/lib/api-problem.ts` ya tiene `normalizeProblem`, pero `http.ts` no lo usa: tiene su propio `toFieldErrors`. Todo error debe salir como un único `ApiError` con `kind`, `fieldErrors` y `traceId`, sea cual sea el formato del servidor.
3. **Una capa de mapeo (DTO → modelo).** La API devuelve `null` donde los tipos del frontend esperan `undefined` (`expirationDate`, `price`, `treatmentId`…), y trae campos que la pantalla no usa (`deletedAt`, `references`, `label`). Cada `*.http.ts` convierte la respuesta en el modelo de la pantalla; ninguna pantalla lee el DTO crudo.
4. **Tipos generados desde OpenAPI.** El back publica `/openapi/v1.json` en desarrollo. Con `openapi-typescript` los DTO se generan en `src/shared/api/schema.d.ts`: si el back cambia un campo, el frontend deja de compilar en vez de fallar en la pantalla. Esto habría detectado `documentType` y `subtitle`.

Además:
- pasar el `signal` de React Query a cada petición, para cancelar las búsquedas viejas;
- una utilidad `fetchAllPages` compartida, porque hoy hay tres copias: `use-treatment-options.ts`, `use-inventory-catalog.ts` y `use-global-alerts.ts`.

Esto **no** es una fábrica genérica de CRUD, que `arquitectura-frontend.md` descarta a propósito. Cada módulo sigue escribiendo sus métodos y sus reglas; lo que se estandariza es la forma del archivo y el manejo de la red.

## Formato de cada plan

1. **Objetivo y alcance.**
2. **Mocks que se deshabilitan:** cada función mock, qué simula, y por qué endpoint o comportamiento del servidor se reemplaza.
3. **Diferencias de contrato:** front ↔ back, y quién las resuelve.
4. **Cambios en el frontend:** archivos y pasos.
5. **Cambios necesarios en el back.**
6. **Verificación:** pruebas y casos manuales.
7. **Criterio de terminado.**
