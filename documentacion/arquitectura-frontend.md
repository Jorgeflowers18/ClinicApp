# Arquitectura del Frontend — ClinicApp

Este documento describe cómo está construido el frontend (`front/`) del sistema de gestión clínica: stack, estructura de carpetas, convenciones por módulo, manejo de datos remotos, autenticación y el contrato que espera del backend .NET.

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Framework | React 19 + TypeScript, Vite como bundler |
| Estilos / UI | Tailwind CSS v4 + shadcn/ui (estilo `base-nova`, sobre primitivas de [Base UI](https://base-ui.com), no Radix) |
| Datos remotos | TanStack Query (React Query) v5 |
| Formularios | React Hook Form + Zod (`@hookform/resolvers`) |
| Enrutamiento | React Router v7 (modo declarativo, `BrowserRouter`) |
| Estado global ligero | Zustand (sesión de usuario) |
| Cliente HTTP | Axios con interceptores |
| Gráficas | Recharts |
| Calendario de citas | `react-big-calendar` con localizer de `date-fns` |

**Nota sobre shadcn/ui:** este proyecto usa el estilo `base-nova`, construido sobre `@base-ui/react` en vez de Radix UI. Los componentes generados usan props como `render` (polimorfismo, equivalente a `asChild` de Radix) y `checked`/`onCheckedChange` en switches. Al agregar nuevos componentes con `npx shadcn@latest add <componente>`, revisa el archivo generado antes de usarlo: algunos componentes del registro público (como `form`) no existen en este estilo — en su lugar se usa el primitivo `field` (`src/components/ui/field.tsx`) combinado manualmente con React Hook Form.

## Estructura de carpetas

```
ClinicApp/
  front/            # Esta aplicación (Vite + React)
  back/             # Reservado para la API .NET (ver back/README.md)
  documentacion/     # Este documento y futura documentación del proyecto
```

Dentro de `front/src/`:

```
src/
  app/                    # Shell de la aplicación
    layout/app-layout.tsx # Sidebar + header, envuelve las rutas protegidas
    pages/                 # Páginas que no pertenecen a un dominio (dashboard, 404, 403)
    nav-config.ts          # Definición del menú lateral y roles permitidos por ítem
    providers.tsx           # QueryClientProvider, BrowserRouter, TooltipProvider, Toaster
    routes.tsx               # Árbol de rutas completo

  modules/                # Un directorio por dominio de negocio
    auth/
    patients/
    appointments/
    clinical-history/
    treatments/
    inventory/
    notifications/
    reports/

  shared/                 # Código reutilizable entre módulos (no específico de un dominio)
    components/            # DataTable, PaginationBar, SearchInput, ConfirmDialog, PageHeader...
    hooks/                  # useDebounce, useTableQueryState
    lib/                    # http.ts, query-client.ts, date.ts, number.ts, csv.ts, mock.ts, error-message.ts, env.ts
    types/                  # Paginated<T>, ApiError, PageQuery

  components/ui/           # Componentes shadcn/ui (gestionados por el CLI, no editar a mano salvo necesidad)
  lib/utils.ts              # Helper `cn()` de shadcn
```

### Convención de cada módulo

Cada carpeta en `modules/<dominio>/` sigue la misma forma:

```
modules/<dominio>/
  types/<dominio>.types.ts     # Schema de Zod + tipos TS inferidos + entidad completa
  api/
    <dominio>.mock-data.ts      # Datos en memoria usados mientras no hay backend
    <dominio>.api.ts            # Funciones CRUD: una versión *Mock y una *Real por operación
    <dominio>.queries.ts        # Hooks de TanStack Query (useXList, useX, useCreateX, ...)
  components/                    # Componentes específicos del dominio (diálogos, formularios reutilizables)
  pages/                          # Páginas de listado, formulario (crear/editar) y detalle
  lib/                            # (opcional) utilidades puras del dominio, ej. reports/lib/period.ts
```

Esta estructura es intencionalmente repetitiva entre módulos: se prioriza que cualquier desarrollador pueda abrir `modules/inventory` y entender `modules/treatments` por analogía, en vez de introducir una fábrica genérica de CRUD que ocultaría el comportamiento específico de cada dominio (validación de disponibilidad en citas, control de stock en inventario, etc.).

## Módulos implementados

| Módulo | Contenido |
|---|---|
| `auth` | Login, store de sesión (Zustand), rutas protegidas por autenticación y por rol |
| `patients` | CRUD completo: listado con búsqueda/paginación, formulario, detalle con tabs (citas, tratamientos, historial) |
| `appointments` | Calendario visual (mes/semana/día) con `react-big-calendar`, crear/editar/reprogramar cita, cambio de estado (incluye no-show), validación de disponibilidad de profesional y consultorio, bloqueos puntuales de horario, filtro por profesional |
| `treatments` | Catálogo de tratamientos, consumo de insumos por tratamiento (relación con inventario), asignaciones a pacientes con seguimiento de sesiones |
| `clinical-history` | Registro cronológico por paciente, adjuntos (mock), acceso restringido a roles `admin` y `medico` |
| `inventory` | CRUD de insumos (consumibles/instrumental), control de vencimientos por lote (FEFO), compras/órdenes de compra, ciclos de esterilización, reporte de stock crítico, historial de movimientos con ajuste de stock |
| `notifications` | Registro (`NotificationLog`) de notificaciones enviadas a pacientes (recordatorio/confirmación/cancelación de cita, por email o SMS). Página `/notificaciones` con editor de la plantilla predeterminada (`NotificationTemplate`, con variables insertables) y reporte del historial con filtro por nombre/identificación del paciente y rango de fechas. Consumido también desde `appointments` para mostrar si el cliente ya fue notificado de una cita puntual. Sin CRUD propio de logs: las notificaciones individuales las genera el backend, el frontend solo lee el historial y edita la plantilla |
| `reports` | Reportería derivada (sin datos propios ni CRUD): KPIs de agenda, productividad por profesional, tratamientos e inventario, con selector de periodo global y exportación CSV en navegador. Página `/reportes` (solo `admin`). El dashboard `/` consume los mismos hooks, así portada y reportes nunca se contradicen |

### Agenda de citas: consultorios, bloqueos y no-show

- **Consultorios:** catálogo simple (`Room { id, name }`), mismo patrón que `Professional` (mock plano, sin CRUD propio, expuesto vía `useRooms()`). `Appointment.roomId` es opcional. Se decidió deliberadamente no construir un módulo de administración de consultorios en esta iteración; si el negocio necesita administrarlos desde la UI (equipamiento, estado, sede), coordinar con el ítem 10 del backlog (administración institucional/sedes) para no duplicar trabajo.
- **Duración estimada:** al elegir un tratamiento en el formulario de cita, la hora de fin se autocompleta sumando `Treatment.durationMinutes` a la hora de inicio (`appointment-form-dialog.tsx`). Sigue siendo editable manualmente después.
- **Bloqueos de horario (`ScheduleBlock`):** bloqueos puntuales (sin recurrencia) de un profesional y/o un consultorio, con motivo obligatorio. Viven en los mismos archivos que `Appointment` (`appointment.types.ts`, `appointments.api.ts`, etc.) porque la validación de choques es bidireccional entre citas y bloqueos. Se crean/eliminan desde el botón "Bloquear horario" en `/citas`; se muestran en el calendario con estilo rayado distintivo y no abren el diálogo de detalle de cita al hacer clic (abren una confirmación de eliminación).
- **Disponibilidad:** `findAppointmentConflict` (en `appointments.api.ts`) valida, al crear/editar una cita, contra otras citas del mismo profesional, otras citas del mismo consultorio, y bloqueos de horario de cualquiera de los dos. `findScheduleBlockConflict` valida en sentido inverso: un bloqueo nuevo no puede crearse sobre una cita ya agendada (pero sí puede superponerse con otro bloqueo).
- **No-show:** nuevo estado `no_asistio` en `AppointmentStatus`, con su propio botón "Marcar inasistencia" en `AppointmentDetailDialog` y su propia clase CSS en el calendario (distinta de "cancelada": borde punteado en vez de tachado).
- **Filtro por profesional:** selector en `/citas` (estado local, no query param — a diferencia del filtro `?pacienteId=` que sí se enlaza desde el detalle de paciente) que filtra tanto citas como bloqueos mostrados en el calendario.

### Inventario: lotes, compras y esterilización

- **Tipo de insumo:** `InventoryItem.kind` distingue `consumible` de `instrumental` (instrumental esterilizable). El listado de insumos muestra un badge "Instrumental" solo para estos últimos.
- **Lotes y vencimiento por lote (`StockLot`):** cada entrada de stock (compra o ajuste manual) crea su propio lote con cantidad restante y vencimiento opcional — un insumo puede tener varios lotes con vencimientos distintos. Las salidas se consumen por **FEFO** (primero en vencer, primero en salir): `consumeFefo` en `inventory.api.ts` recorre los lotes del insumo ordenados por vencimiento ascendente (sin vencimiento al final) y genera un `StockMovement` por cada lote tocado. El consumo automático (ver más abajo) **no bloquea si el stock no alcanza** — consume lo disponible y se detiene, a diferencia del movimiento manual de salida que sí valida no superar el stock disponible antes de ejecutarse.
- **Compras / órdenes de compra (`PurchaseOrder`):** estado pendiente/recibida/cancelada, con líneas de insumo/cantidad/costo/vencimiento esperado. `supplierId` referencia a un `Supplier` del catálogo de proveedores (ver abajo). Al "recibir" una orden se generan automáticamente los lotes y movimientos de entrada de cada línea (`receivePurchaseOrder`), reemplazando el registro manual para compras. Las órdenes son inmutables una vez creadas: al hacer clic en una fila de la pestaña Compras se abre el mismo `PurchaseOrderFormDialog` de "Nueva orden" con la prop `order`, que lo pone en modo solo lectura (campos deshabilitados, sin agregar/quitar líneas, botón "Cerrar") — se reutiliza el formulario en vez de duplicar una vista de detalle.
- **Proveedores (`Supplier`):** CRUD completo (nombre, contacto, teléfono, correo, dirección, notas/condiciones) en la pestaña "Proveedores" de `/inventario` (`suppliers-tab.tsx` + `supplier-form-dialog.tsx`, mismo diálogo para crear y editar vía prop `supplier`). No se puede eliminar un proveedor con órdenes de compra asociadas (`409` en el mock). Las órdenes de compra eligen el proveedor con un `Select` alimentado por `useSuppliersList()`, eliminando el texto libre anterior. `InventoryItem.supplier` (el proveedor habitual de un insumo) sigue siendo texto libre por ahora: migrarlo a `supplierId` es un pendiente menor del ítem 11.
- **Esterilización (`SterilizationCycle`):** registro básico de ciclos (instrumentos incluidos, fecha, resultado aprobado/fallido, profesional responsable — reutiliza `Professional` de `appointments` vía `useProfessionals()`, no se creó un concepto de staff nuevo).
- **Trazabilidad clínica real:** `treatments.api.ts` (`advanceSessionMock`) llama a `inventoryApi.registerConsumption(...)` por cada línea de `Treatment.consumption` al completar una sesión, generando movimientos de salida reales vinculados a `treatmentAssignmentId`/`patientId` — antes `consumption` era solo un dato descriptivo que nunca descontaba stock. `treatments.queries.ts`'s `useAdvanceSession` invalida además las queries de `inventory`, mismo patrón cross-módulo que ya usan `appointments`↔`notifications`.
- **Stock crítico:** pestaña de solo lectura en `/inventario` (filtra `stock <= minStock` sobre `useInventoryList`), pensada para que el futuro dashboard (ítem 9 del backlog) la consuma como KPI sin duplicar la lógica.
- **UI:** `/inventario` se organiza en pestañas (Insumos / Compras / Esterilización / Stock crítico) sobre el mismo `Tabs` ya usado en `patient-detail-page.tsx`; no se agregaron rutas nuevas.

### Reportes y dashboard

- **Sin mock-data propio:** `modules/reports/api/reports.api.ts` no tiene `reports.mock-data.ts`. Toda la reportería se deriva en memoria, en solo lectura, de los `mock*` de `appointments`, `treatments`, `inventory`, `patients` y `notifications` (mismo precedente que `notifications.api.ts` leyendo `mockPatients`). Con backend real la agregación es SQL del lado del servidor vía `GET /reports/*`; el navegador no agrega nada.
- **Periodo:** `ReportPeriod { from, to }` en `YYYY-MM-DD`, inclusivo, hora local. Presets en `reports/lib/period.ts`: `semana`/`mes`/`año` usan el fin de calendario (incluyen citas futuras ya programadas; la etiqueta es "citas en el periodo", no "realizadas"), `últimos 30 días` es rodante hasta hoy. Campo de fecha que filtra cada entidad: citas → `start`, pacientes nuevos → `createdAt`, asignaciones → `startDate` (fecha pura, se parsea con `parseLocalDate` para evitar el desfase UTC), órdenes de compra y movimientos → `createdAt`, notificaciones → `sentAt`.
- **KPIs puntuales vs por periodo:** `patientsTotal`, `activeTreatments` y `criticalStockItems` ignoran el periodo (son el estado actual); el resto filtra. `noShowRate = noShow / (completadas + noShow)`; `completionRate = completadas / (programadas − canceladas)`.
- **Ingreso estimado** en tratamientos = precio × asignaciones completadas. Es provisional y está etiquetado así en la UI: no existe módulo de facturación (ítem 8 del backlog).
- **Recálculo:** los hooks usan `refetchOnMount: "always"` en vez de invalidarse desde las mutaciones de otros módulos — la dependencia queda unidireccional (reports lee, nadie conoce a reports).
- **CSV:** `shared/lib/csv.ts` (`downloadCsv(filename, rows, columns)`) genera el archivo en el navegador con BOM para que Excel abra acentos; cabeceras en español y orden determinista vía `columns`.
- **Semillas mock:** las citas y notificaciones de ejemplo son relativas a hoy, pero pacientes, asignaciones y compras tienen fechas estáticas (nov-2025 a feb-2026). La página muestra un aviso solo en modo mock; no se reescribieron las semillas de otros módulos.
- **Fuera de alcance (deliberado):** pagos pendientes / salud financiera (ítem 8) y rendimiento por sede (ítem 10) — no se muestran placeholders. Productividad por sesiones de tratamiento tampoco es posible: `TreatmentAssignment` no registra `professionalId`.

### Notificaciones a pacientes

- **Preferencia por paciente:** `Patient` tiene un campo `notificationsEnabled: boolean`, editable como switch en `modules/patients/pages/patient-form-page.tsx` (crear y editar). El backend debe crear los pacientes con `notificationsEnabled: true` por defecto.
- **Estado de una cita puntual:** `AppointmentDetailDialog` (`modules/appointments/components/appointment-detail-dialog.tsx`) consulta `useAppointmentNotifications(appointmentId)` del módulo `notifications` para mostrar si el paciente ya fue notificado de esa cita (y cuándo). Es un ejemplo del patrón ya usado en `appointments-calendar-page.tsx` de importar hooks de otro módulo de dominio directamente en vez de duplicar lógica.
- **Reporte:** `modules/notifications/pages/notifications-report-page.tsx` lista el historial completo (`GET /notifications`), paginado y filtrable por nombre/identificación del paciente y por rango de fechas (`dateFrom`/`dateTo`). Restringido a los roles `admin` y `recepcion` (mismo criterio de acceso que `inventory`, ajustar si el negocio lo requiere distinto).
- **Plantilla predeterminada:** `modules/notifications/components/notification-template-editor.tsx` (usado en la misma página `/notificaciones`) edita un `NotificationTemplate` singleton (`GET`/`PUT /notifications/template`) con un único campo `message`. Los botones sobre el textarea insertan, en la posición del cursor, una variable de `notificationVariables` (`notification.types.ts`) — tokens con el formato `[nombre del cliente]`, `[fecha de la cita]`, etc. — que el backend debe reemplazar por el dato real de cada paciente/cita al momento de enviar. Incluye una vista previa que sustituye los tokens por valores de ejemplo para que el usuario vea el resultado final sin enviar nada.
- **Disparo automático simulado:** `notificationsApi.logAppointmentEvent({ patientId, appointmentId, type })` genera un `NotificationLog` automáticamente al crear una cita (`confirmacion_cita`) y al cancelarla (`cancelacion_cita`), respetando `Patient.notificationsEnabled` (si está en `false`, no se genera nada). Se invoca desde `modules/appointments/api/appointments.queries.ts` (`useCreateAppointment`, `useUpdateAppointmentStatus`) — un módulo de dominio llamando a la API pública de otro, no a sus datos mock directamente. **Limitación conocida:** el tipo `recordatorio_cita` (aviso previo a la cita) no se puede simular así, porque requiere un disparador por tiempo (scheduler/cron) y no por una acción del usuario; en el mock solo existe como dato semilla estático. La versión real de `logAppointmentEvent` es un no-op documentado: en producción esto lo dispara el propio backend desde sus endpoints de citas.

## Autenticación y autorización

- **Login:** `modules/auth/pages/login-page.tsx` usa React Hook Form + Zod. Al autenticar, `useLogin` (TanStack Query mutation) guarda `{ accessToken, user }` en el store de Zustand (`modules/auth/store/auth-store.ts`).
- **Token en memoria:** el access token **no se persiste** en `localStorage` para reducir superficie de robo por XSS. Al recargar la página se pierde, tal como ocurrirá en producción hasta que el backend exponga `/auth/me` respaldado por una cookie `httpOnly` de refresh.
  - *Excepción solo en modo mock:* mientras `VITE_USE_MOCK_API=true`, la sesión se guarda en `sessionStorage` únicamente para comodidad de desarrollo (evitar reloguear en cada recarga). Este comportamiento está aislado y comentado en `auth-store.ts`, y debe eliminarse (o simplemente dejará de activarse) al conectar el backend real.
- **Rutas protegidas:** `modules/auth/components/protected-route.tsx` es un layout-route de React Router:
  - Sin sesión → redirige a `/login`.
  - Con sesión pero rol no permitido (`allowedRoles`) → redirige a `/403`.
- **Roles:** `admin`, `recepcion`, `medico` (ver `modules/auth/types/auth.types.ts`). El menú lateral (`app/nav-config.ts`) también filtra ítems por rol, así que un usuario sin permiso ni siquiera ve el enlace — la ruta protegida es la barrera real, el menú es solo UX.
- **Cuentas mock:** `admin@clinica.com` / `admin123`, `recepcion@clinica.com` / `recepcion123`, `medico@clinica.com` / `medico123`.

## Comunicación con la API

Todo el tráfico HTTP pasa por `shared/lib/http.ts` (instancia única de Axios):

- **Interceptor de request:** agrega `Authorization: Bearer <token>` desde el store de auth.
- **Interceptor de response:**
  - `401` → limpia la sesión y redirige a `/login`.
  - Cualquier error se normaliza a `ApiError` (`shared/types/common.ts`), extrayendo `errors: Record<string, string[]>` del formato `ValidationProblemDetails` estándar de ASP.NET Core (`400`) hacia una lista plana de `{ field, message }` que los formularios pueden mostrar.

### Patrón mock ↔ real

Cada `*.api.ts` exporta un objeto (`patientsApi`, `inventoryApi`, etc.) cuyas funciones se resuelven en tiempo de módulo según `env.useMockApi` (`VITE_USE_MOCK_API`, ver `.env.example`):

```ts
export const patientsApi = {
  list: env.useMockApi ? listMock : listReal,
  // ...
}
```

Las funciones `*Real` ya están escritas contra los endpoints esperados (ver más abajo) y quedan listas para activarse con solo cambiar la variable de entorno — no requieren tocar páginas ni hooks de React Query. Todas están marcadas con `// TODO: conectar a endpoint real -> MÉTODO /ruta`.

### Tipado end-to-end con la API .NET

Cuando el backend exponga su esquema OpenAPI/Swagger, genera tipos con:

```bash
npx openapi-typescript@latest https://localhost:5001/swagger/v1/swagger.json -o src/shared/types/api.gen.ts
```

(`openapi-typescript` no está instalado como dependencia fija para evitar conflictos de peer-dependencies con la versión de TypeScript del proyecto; se ejecuta puntualmente con `npx`.)

## Endpoints que el backend .NET debe exponer

Extraídos de los comentarios `TODO` en cada `*.api.ts`:

**Auth**
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me` *(pendiente de agregar — necesario para restaurar sesión vía cookie httpOnly)*

**Pacientes**
- `GET /patients` (query: `page`, `pageSize`, `search`)
- `GET /patients/:id`
- `POST /patients`
- `PUT /patients/:id`
- `DELETE /patients/:id`

**Citas**
- `GET /appointments` (idealmente con filtro de rango de fechas)
- `GET /appointments/:id`
- `POST /appointments` (el backend debe validar disponibilidad del profesional y del consultorio, y disparar la notificación de confirmación)
- `PUT /appointments/:id`
- `PATCH /appointments/:id/status` (al pasar a `cancelada` el backend debe disparar la notificación de cancelación; `no_asistio` es un valor válido más de estado)
- `GET /professionals`
- `GET /rooms` — catálogo de consultorios
- `GET /schedule-blocks` — bloqueos de horario vigentes
- `POST /schedule-blocks` (el backend debe validar que no se solape con una cita ya agendada)
- `DELETE /schedule-blocks/:id`

**Historial clínico** (requiere autorización por rol en el backend, no solo en el frontend)
- `GET /clinical-history`
- `GET /clinical-history/:id`
- `POST /clinical-history`
- `PUT /clinical-history/:id`

**Tratamientos**
- `GET /treatments`
- `GET /treatments?active=true`
- `GET /treatments/:id`
- `POST /treatments`
- `PUT /treatments/:id`
- `DELETE /treatments/:id`
- `GET /treatments/:id/assignments`
- `POST /treatment-assignments/:id/advance-session` (el backend debe descontar stock de inventario por cada línea de `consumption` del tratamiento, igual que simula el mock)

**Inventario**
- `GET /inventory/items`
- `GET /inventory/items/:id`
- `POST /inventory/items` (incluye `kind: "consumible" | "instrumental"`)
- `PUT /inventory/items/:id`
- `DELETE /inventory/items/:id`
- `GET /inventory/items/:id/movements`
- `POST /inventory/items/:id/movements` (entrada admite `expirationDate` opcional, crea un lote nuevo)
- `GET /inventory/items/:id/lots` — lotes del insumo con cantidad restante y vencimiento
- `GET /inventory/suppliers`
- `POST /inventory/suppliers`
- `PUT /inventory/suppliers/:id`
- `DELETE /inventory/suppliers/:id` (`409` si tiene órdenes de compra asociadas)
- `GET /inventory/purchase-orders`
- `POST /inventory/purchase-orders` (body con `supplierId`)
- `POST /inventory/purchase-orders/:id/receive` (genera los lotes y movimientos de entrada de cada línea)
- `POST /inventory/purchase-orders/:id/cancel`
- `GET /inventory/sterilization-cycles`
- `POST /inventory/sterilization-cycles`

**Notificaciones**
- `GET /notifications` (query: `page`, `pageSize`, `search` — nombre o identificación del paciente —, `dateFrom`, `dateTo`) — reporte de notificaciones enviadas
- `GET /notifications?appointmentId=:id` — notificaciones asociadas a una cita puntual, usado para mostrar si el paciente ya fue notificado
- `GET /notifications/template` — plantilla predeterminada de notificación (mensaje con variables sin reemplazar, ej. `[nombre del cliente]`)
- `PUT /notifications/template` — actualiza el mensaje de la plantilla predeterminada (body: `{ message: string }`)

**Reportes** (solo rol `admin`; `from`/`to` en `YYYY-MM-DD`, inclusivos, zona horaria de la clínica; las respuestas siguen las interfaces de `modules/reports/types/report.types.ts`)
- `GET /reports/summary?from&to`
- `GET /reports/agenda?from&to`
- `GET /reports/productivity?from&to`
- `GET /reports/treatments?from&to`
- `GET /reports/inventory?from&to`

**Pacientes (campo adicional)**
- `POST /patients` y `PUT /patients/:id` ahora incluyen `notificationsEnabled: boolean` en el body. El backend debe persistirlo y crear los registros nuevos con `true` por defecto.

### Formato de error esperado (400)

El interceptor de Axios espera el formato estándar de `ValidationProblemDetails` de ASP.NET Core:

```json
{
  "title": "One or more validation errors occurred.",
  "detail": "Mensaje legible opcional",
  "errors": {
    "email": ["El correo ya está registrado."]
  }
}
```

## Estados de carga, error y vacío

`shared/components/data-table.tsx` centraliza los tres estados para cualquier tabla:
- **Cargando:** filas skeleton.
- **Error:** `Alert` destructivo con el mensaje de `ApiError`.
- **Vacío:** ícono + título + descripción configurables por página.

Las páginas de detalle/formulario usan `Skeleton` de shadcn para el estado de carga y `Alert` para errores de carga puntuales.

## Validación de formularios

Todos los formularios comparten el mismo patrón:
1. Schema de Zod en `modules/<dominio>/types/<dominio>.types.ts`.
2. `useForm({ resolver: zodResolver(schema) })`.
3. Inputs nativos (`Input`, `Textarea`) via `register(...)`; componentes controlados (`Select`, `Switch`) via `Controller`.
4. Errores de campo mostrados con `<FieldError errors={errors.campo ? [errors.campo] : undefined} />` (`components/ui/field.tsx`).
5. Errores de servidor (400 con `fieldErrors`) se muestran vía `toast.error(getErrorMessage(error))`; para mapear un error de servidor a un campo específico se puede usar `form.setError(field, { message })` en el `onError` de la mutación (no implementado aún porque no hay backend real que lo dispare).

## Variables de entorno

Ver `front/.env.example`:

```
VITE_API_BASE_URL=http://localhost:5000/api
VITE_USE_MOCK_API=true
```

Cambia `VITE_USE_MOCK_API=false` cuando el backend .NET esté disponible y accesible en `VITE_API_BASE_URL`.

## Decisiones pendientes / próximos pasos sugeridos

- Reemplazar los `Select` simples de paciente/profesional/insumo (alimentados con hasta 100 registros) por un combobox con búsqueda asíncrona cuando el volumen real de datos lo justifique.
- Implementar `GET /auth/me` + cookie httpOnly de refresh en el backend para restaurar sesión sin re-login en cada carga.
- Definir política de subida real de archivos para historial clínico (hoy los adjuntos son solo nombres de archivo, sin almacenamiento).
- Considerar mover la generación de tipos desde OpenAPI a un paso de CI una vez el backend tenga un contrato estable.
