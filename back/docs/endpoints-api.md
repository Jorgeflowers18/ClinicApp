# Endpoints de la API — ClinicApp

Estado al **2026-11-17**: **57 endpoints implementados**:
- 1 de salud;
- 8 de `auth`;
- 9 de `treatments` (catálogo y tratamientos realizados);
- 18 de `inventory`;
- 6 de `patients`;
- 7 de `professionals` y `rooms`;
- 8 de `appointments` y `schedule-blocks`.

Las tablas que hay detrás están en [`estructura-base.md`](./estructura-base.md). Lo que falta, por módulo, está en [`../backlog.md`](../backlog.md). Para probarlos: `src/ClinicApp.Api/ClinicApp.Api.http`, o Scalar en `http://localhost:5000/scalar` (solo en desarrollo).

## 1. Reglas comunes

### URL base

- **Desarrollo:** `http://localhost:5000/api`.
- **Producción:** detrás de nginx, que atiende el HTTPS. El frontend la configura con `VITE_API_BASE_URL`.

### Sesión

- **Todos los endpoints piden sesión**, salvo los marcados como **público**. La sesión va en el encabezado `Authorization: Bearer <accessToken>`.
- **Access token:** JWT de 15 minutos. Trae los claims `sub` (id del usuario), `email`, `name` y `role`.
- **Renovación:** con la cookie `clinicapp_refresh`, que es `httpOnly`, `Secure`, `SameSite=Strict`, con ruta `/api/auth` y válida 7 días. El navegador la manda solo a los endpoints de `/api/auth`.
- **Sin sesión o con el token vencido:** `401` "Inicia sesión para continuar".

### Roles

`admin`, `recepcion` y `medico`. Si el rol no corresponde, `403` "No tienes permiso para realizar esta acción".

| Módulo | Roles |
|---|---|
| `treatments` | los tres; registrar un tratamiento realizado: `admin` y `medico` |
| `inventory`: leer insumos (`GET /inventory/items` y `GET /inventory/items/:id`) | los tres |
| `inventory`: todo lo demás | `admin`, `recepcion` |
| `patients` | los tres; dar de baja: `admin` y `recepcion`; reactivar: `admin` |
| `professionals`, `rooms` | leer: los tres; crear y editar: `admin` |
| `appointments`, `schedule-blocks` | los tres |

### Errores

Todos con formato `ProblemDetails` y título en español. El frontend (`shared/lib/http.ts`) muestra `detail` si existe y, si no, `title`.

- **Validación (`400`):** `ValidationProblemDetails`, con los nombres de campo del JSON. En listas van con índice: `lines[0].itemId`.
  ```json
  {
    "title": "Revisa los datos ingresados",
    "status": 400,
    "errors": { "name": ["Mínimo 2 caracteres"], "lines[0].itemId": ["El insumo no existe"] },
    "traceId": "00-…"
  }
  ```
- **Otros errores** (`401`, `403`, `404`, `405`, `409`, `415`, `429`, `500`):
  ```json
  { "title": "Insumo no encontrado", "status": 404, "traceId": "00-…" }
  ```
- **Conflicto con un campo (`409`):** cuando el choque es de un campo (cédula repetida, horario ocupado), el `409` usa el mismo formato de validación, con `errors.<campo>`, para que el formulario lo marque.
- **Errores inesperados (`500`):** solo traen `detail` en desarrollo. En producción el detalle queda en el log; se encuentra buscando el `traceId`.

### Paginación

Donde el frontend la pide, con los parámetros `?page=1&pageSize=10&search=texto`.
- `page` es como mínimo 1.
- `pageSize` va de 1 a **100**.

La respuesta tiene esta forma:

```json
{ "items": [ … ], "page": 1, "pageSize": 10, "totalItems": 42, "totalPages": 5 }
```

### Formatos

- **Identificadores:** UUID.
- **Fechas con hora:** ISO 8601 en UTC (`"2026-11-15T18:02:28.123Z"`).
- **Fechas sin hora:** `"YYYY-MM-DD"`. En los campos opcionales se acepta `""`, que es lo que manda un `<input type="date">` vacío.
- **Dinero:** número con hasta 2 decimales.
- **Campos opcionales vacíos:** en `treatments` e `inventory` se guardan y se devuelven como `null`; en `patients` como `""`, que es lo que espera su formulario.

### Límite de intentos

`login`, `password-recovery`, `password-reset` y `access-requests` aceptan **20 peticiones por minuto por IP**, contadas por endpoint. Al pasarse, responden `429` "Demasiados intentos. Espera un minuto e inténtalo de nuevo", con el encabezado `Retry-After`.

## 2. Índice

| Método | Ruta | Roles | Respuesta |
|---|---|---|---|
| `GET` | `/api/health` | público | `200` "Healthy" / `503` "Unhealthy" |
| `POST` | `/api/auth/login` | público | `200` sesión + cookie |
| `POST` | `/api/auth/refresh` | público (cookie) | `200` sesión + cookie nueva |
| `POST` | `/api/auth/logout` | público (cookie) | `204` |
| `GET` | `/api/auth/me` | con sesión | `200` usuario |
| `PUT` | `/api/auth/me/profile` | con sesión | `200` usuario |
| `POST` | `/api/auth/password-recovery` | público | `202` |
| `POST` | `/api/auth/password-reset` | público | `204` |
| `POST` | `/api/auth/access-requests` | público | `202` |
| `GET` | `/api/treatments` | los tres | `200` paginado o lista |
| `GET` | `/api/treatments/:id` | los tres | `200` |
| `POST` | `/api/treatments` | los tres | `201` |
| `PUT` | `/api/treatments/:id` | los tres | `200` |
| `DELETE` | `/api/treatments/:id` | los tres | `204` |
| `GET` | `/api/treatments/:id/assignments` | los tres | `200` lista |
| `GET` | `/api/treatment-assignments` | los tres | `200` lista |
| `POST` | `/api/treatment-assignments` | admin, medico | `201` (o `200` si ya existía) |
| `GET` | `/api/inventory/items` | los tres | `200` paginado |
| `GET` | `/api/inventory/items/:id` | los tres | `200` |
| `POST` | `/api/inventory/items` | admin, recepcion | `201` |
| `PUT` | `/api/inventory/items/:id` | admin, recepcion | `200` |
| `DELETE` | `/api/inventory/items/:id` | admin, recepcion | `204` |
| `GET` | `/api/inventory/items/:id/movements` | admin, recepcion | `200` lista |
| `POST` | `/api/inventory/items/:id/movements` | admin, recepcion | `201` |
| `GET` | `/api/inventory/items/:id/lots` | admin, recepcion | `200` lista |
| `GET` | `/api/inventory/suppliers` | admin, recepcion | `200` lista |
| `POST` | `/api/inventory/suppliers` | admin, recepcion | `201` |
| `PUT` | `/api/inventory/suppliers/:id` | admin, recepcion | `200` |
| `DELETE` | `/api/inventory/suppliers/:id` | admin, recepcion | `204` |
| `GET` | `/api/inventory/purchase-orders` | admin, recepcion | `200` lista |
| `POST` | `/api/inventory/purchase-orders` | admin, recepcion | `201` |
| `POST` | `/api/inventory/purchase-orders/:id/receive` | admin, recepcion | `200` |
| `POST` | `/api/inventory/purchase-orders/:id/cancel` | admin, recepcion | `200` |
| `GET` | `/api/inventory/sterilization-cycles` | admin, recepcion | `200` lista |
| `POST` | `/api/inventory/sterilization-cycles` | admin, recepcion | `201` |
| `GET` | `/api/patients` | los tres | `200` paginado |
| `GET` | `/api/patients/:id` | los tres | `200` |
| `POST` | `/api/patients` | los tres | `201` |
| `PUT` | `/api/patients/:id` | los tres | `200` |
| `DELETE` | `/api/patients/:id` | admin, recepcion | `204` (baja lógica) |
| `POST` | `/api/patients/:id/restore` | admin | `200` |
| `GET` | `/api/professionals` | los tres | `200` lista |
| `GET` | `/api/professionals/:id` | los tres | `200` |
| `POST` | `/api/professionals` | admin | `201` |
| `PUT` | `/api/professionals/:id` | admin | `200` |
| `GET` | `/api/rooms` | los tres | `200` lista |
| `POST` | `/api/rooms` | admin | `201` |
| `PUT` | `/api/rooms/:id` | admin | `200` |
| `GET` | `/api/appointments` | los tres | `200` lista |
| `GET` | `/api/appointments/:id` | los tres | `200` |
| `POST` | `/api/appointments` | los tres | `201` |
| `PUT` | `/api/appointments/:id` | los tres | `200` |
| `PATCH` | `/api/appointments/:id/status` | los tres | `200` |
| `GET` | `/api/schedule-blocks` | los tres | `200` lista |
| `POST` | `/api/schedule-blocks` | los tres | `201` |
| `DELETE` | `/api/schedule-blocks/:id` | los tres | `204` |
| `GET` | `/openapi/v1.json`, `/scalar` | público, **solo en desarrollo** | Descripción OpenAPI y página de pruebas |

## 3. Salud

### `GET /api/health`

Público. Responde `Healthy` (`200`) si la API llega a la base de datos, o `Unhealthy` (`503`) si no. Sirve para el monitoreo del servidor.

## 4. `auth`

**Usuario (`AuthUser`)**, que devuelven el login, el refresh, `/me` y `/me/profile`:

```json
{
  "id": "0199…",
  "name": "Ana Morales",
  "email": "admin@clinica.com",
  "role": "admin",
  "professionalId": "0199…",
  "profile": {
    "fullName": "Ana Morales",
    "title": "Directora clínica",
    "specialty": "Ortodoncia",
    "bio": "",
    "avatarColor": "#0f766e",
    "avatarImage": null
  }
}
```

`profile` es `null` hasta que el usuario completa "Mi perfil". `professionalId` es el profesional vinculado al usuario (lo asigna el admin con `PUT /api/professionals/:id`, campo `userId`), o `null`.

### `POST /api/auth/login` — público

**Body:** `{ "email": "...", "password": "..." }`.
- `email`: obligatorio, correo válido, hasta 254 caracteres. No distingue mayúsculas.
- `password`: obligatoria, hasta 128 caracteres.

**`200`:** `{ "accessToken": "...", "expiresIn": 900, "user": AuthUser }`, más la cookie de refresh. `expiresIn` va en segundos.

**Errores:**
- `400`: validación.
- `401` "Correo o contraseña incorrectos": el mismo mensaje y el mismo tiempo de respuesta exista o no el correo.
- `403` "Tu cuenta está desactivada": solo si la contraseña era correcta.
- `429`: demasiados intentos.

### `POST /api/auth/refresh` — público, usa la cookie

Renueva la sesión y **rota la cookie**: el token anterior deja de servir. Devuelve `200` con lo mismo que el login.

**Casos especiales:**
- **Dos renovaciones con el mismo token en menos de 30 s** (por ejemplo, dos pestañas): ambas funcionan.
- **Reuso de un token ya reemplazado, pasados esos 30 s:** se trata como robo. Se cierran todas las sesiones del usuario y queda un aviso en el log.

**Error:** `401` "Tu sesión expiró. Inicia sesión de nuevo", con la cookie borrada, si no hay cookie o el token es inválido, está vencido o fue revocado.

### `POST /api/auth/logout` — público, usa la cookie

Invalida el token de refresh y borra la cookie. Responde `204` aunque no haya sesión.

### `GET /api/auth/me`

Devuelve `200` con el `AuthUser` de la sesión. Si el usuario ya no existe o fue desactivado: `401`.

### `PUT /api/auth/me/profile`

Guarda "Mi perfil" y devuelve `200` con el `AuthUser` actualizado.

**Body:** `{ fullName, title, specialty, bio, avatarColor, avatarImage }`.
- `fullName`: obligatorio, hasta 120.
- `title` y `specialty`: hasta 80.
- `bio`: hasta 1000.
- `avatarColor`: `#RRGGBB`.
- `avatarImage`: `null`, o una data URL PNG, JPG, WebP o GIF de hasta 400 000 caracteres (~300 KB).

### `POST /api/auth/password-recovery` — público

**Body:** `{ "email": "..." }`. Responde **siempre `202`**, exista o no la cuenta, para no revelar qué correos están registrados.

Si la cuenta existe y está activa:
- Se genera un enlace de un solo uso, válido 60 minutos: `{Auth:FrontendBaseUrl}/restablecer-contrasena?token=...`.
- Pedir uno nuevo invalida los anteriores.
- **Envío:** hoy solo se escribe en el log, y solo en desarrollo. Falta un proveedor de correo real.

### `POST /api/auth/password-reset` — público

**Body:** `{ "token": "...", "password": "..." }`.
- `token`: hasta 100 caracteres.
- `password`: de 8 a 128 caracteres.

**`204`:** fija la contraseña y cierra todas las sesiones del usuario.

**Error:** `400` "El enlace no es válido o ya expiró", con el detalle "Solicita uno nuevo desde «Recuperar contraseña»."

### `POST /api/auth/access-requests` — público

**Body:** `{ email, fullName, institution, message }`.
- `email`: obligatorio, válido, hasta 254.
- `fullName`: obligatorio, hasta 120.
- `institution`: hasta 160.
- `message`: hasta 1000.

**`202`:** la solicitud queda guardada como `pendiente`. Todavía no hay pantalla ni endpoint para revisarlas.

## 5. `treatments`

**Tratamiento (`Treatment`):**

```json
{
  "id": "0199…",
  "name": "Endodoncia unirradicular",
  "category": "Endodoncia",
  "description": "Tratamiento de conducto de una raíz.",
  "durationMinutes": 60,
  "price": 120.00,
  "active": true,
  "consumption": [ { "itemId": "0199…", "quantity": 2 } ],
  "createdAt": "2026-11-15T18:10:00Z"
}
```

**Body de `POST` y `PUT`:** todos los campos menos `id` y `createdAt`.
- `name`: 2 a 120.
- `category`: 2 a 80.
- `description`: hasta 1000.
- `durationMinutes`: 5 a 1440.
- `price`: 0 a 99 999 999,99.
- `consumption`: hasta 50 líneas; si no viene, se toma como `[]`. En cada línea, `itemId` es obligatorio y `quantity` va de 1 a 10 000.
  - Insumo inexistente: `400` "El insumo no existe", en `errors["consumption[1].itemId"]`.
  - Insumo repetido: `400` "Insumo repetido: suma las cantidades en una sola línea", en el mismo campo.

| Endpoint | Detalle |
|---|---|
| `GET /api/treatments?page&pageSize&search` | `200` paginado, ordenado por nombre. `search` busca en nombre y categoría. |
| `GET /api/treatments?active=true` | `200` con la lista de **todos** los activos, sin paginar (selectores de la historia clínica) |
| `GET /api/treatments/:id` | `200`, o `404` "Tratamiento no encontrado" |
| `POST /api/treatments` | `201` con el tratamiento y el encabezado `Location`; `400` |
| `PUT /api/treatments/:id` | `200`; `400`, `404`. Los insumos se reemplazan por los del body. |
| `DELETE /api/treatments/:id` | `204` (también borra sus insumos); `404`; `409` "Este tratamiento ya se usó. Desactívalo en su lugar." si aparece en una cita o en un tratamiento realizado. |


### Tratamientos realizados (`treatment-assignments`)

**Tratamiento realizado (`TreatmentAssignment`):**

```json
{
  "id": "0199…", "treatmentId": "0199…", "patientId": "0199…",
  "totalSessions": 1, "completedSessions": 1, "status": "completado",
  "startDate": "2026-11-17", "tooth": "26",
  "sourceEncounterId": "8f1c…", "price": 35.00, "sourceKey": "8f1c…:4b2a…"
}
```

| Endpoint | Roles | Detalle |
|---|---|---|
| `GET /api/treatments/:id/assignments` | los tres | `200` lista, del más reciente al más antiguo; `404` |
| `GET /api/treatment-assignments?patientId=` | los tres | `200` lista, del más reciente al más antiguo; `400` sin `patientId` |
| `POST /api/treatment-assignments` | admin, medico | Ver abajo |

**Registrar (`POST /api/treatment-assignments`):** body `{ treatmentId, patientId, date, tooth, sourceEncounterId, sourceKey, price }` (`CreateAssignmentInput`).
- Crea el tratamiento realizado ya `completado`, 1 de 1 sesión. `price` de 0 a 99 999 999,99; si no viene, el precio del catálogo.
- **Descuenta los insumos** del tratamiento (`consumption`) por FEFO, con movimientos de salida que llevan `treatmentAssignmentId`, `patientId` y el motivo "Tratamiento realizado: <nombre>". **Si el stock no alcanza, se registra igual**: descuenta lo que hay y deja un aviso en el log.
- **Idempotente por `sourceKey`:** si ya existe, `200` con el existente y sin volver a descontar. Diez reintentos simultáneos registran y descuentan una sola vez. El mismo `sourceKey` con otro paciente o tratamiento: `409` (`errors.sourceKey`).
- `201`; `404` "Tratamiento no encontrado"; `400` tratamiento inactivo, paciente inexistente o dado de baja, fecha futura, precio fuera de rango o `sourceEncounterId` que no es UUID.

## 6. `inventory`

### Insumos

**Insumo (`InventoryItem`):**

```json
{
  "id": "0199…",
  "name": "Guantes de nitrilo",
  "category": "Protección",
  "unit": "caja",
  "kind": "consumible",
  "minStock": 5,
  "unitCost": 8.50,
  "supplier": "Dental Sur",
  "stock": 13,
  "createdAt": "2026-11-15T18:10:00Z"
}
```

**Body de `POST` y `PUT`:** `{ name, category, unit, kind, minStock, unitCost, supplier }`.
- `name`: 2 a 120.
- `category`: 2 a 80.
- `unit`: obligatoria, hasta 30.
- `kind`: `consumible` o `instrumental`.
- `minStock`: 0 a 1 000 000.
- `unitCost`: 0 a 99 999 999,99.
- `supplier`: texto libre opcional, hasta 120.

El stock **no** se envía: nace en 0 y solo cambia con movimientos.

| Endpoint | Detalle |
|---|---|
| `GET /api/inventory/items?page&pageSize&search` | `200` paginado, ordenado por nombre. `search` busca en nombre, categoría y proveedor. |
| `GET /api/inventory/items/:id` | `200`, o `404` "Insumo no encontrado" |
| `POST /api/inventory/items` | `201` con `stock: 0` y `Location`; `400` |
| `PUT /api/inventory/items/:id` | `200`; `400`, `404`. No cambia el stock. |
| `DELETE /api/inventory/items/:id` | `204`; `404`. `409` "No se puede eliminar: el insumo tiene movimientos o está en uso" si tiene movimientos o lotes, o aparece en una orden de compra, un ciclo de esterilización o un tratamiento. |

### Movimientos y lotes

**Movimiento (`StockMovement`):**

```json
{
  "id": "0199…",
  "itemId": "0199…",
  "type": "salida",
  "quantity": 3,
  "reason": "Uso en consultorio 1",
  "lotId": "0199…",
  "treatmentAssignmentId": null,
  "patientId": null,
  "purchaseOrderId": null,
  "createdAt": "2026-11-15T18:12:00Z"
}
```

**Lote (`StockLot`):**

```json
{
  "id": "0199…",
  "itemId": "0199…",
  "quantity": 7,
  "expirationDate": "2027-01-31",
  "purchaseOrderId": null,
  "receivedAt": "2026-11-15T18:11:00Z"
}
```

`quantity` es la cantidad que queda en el lote. `expirationDate` es `null` si el lote no vence.

**`GET /api/inventory/items/:id/movements`:** `200` con la lista, del más reciente al más antiguo; `404` si el insumo no existe.

**`POST /api/inventory/items/:id/movements`:** registra un movimiento manual.

Body: `{ type, quantity, reason, expirationDate }`.
- `type`: `entrada` o `salida`.
- `quantity`: 1 a 1 000 000.
- `reason`: 3 a 300 caracteres.
- `expirationDate`: `"YYYY-MM-DD"`, `""` o `null`. Solo se usa en las entradas.

Qué hace según el tipo:
- **Entrada:** crea un lote nuevo con esa cantidad y ese vencimiento.
- **Salida:** descuenta por FEFO. Si abarca varios lotes, crea un movimiento por lote y la respuesta es el primero.

Responde `201` con el movimiento.

Errores:
- `400`: validación.
- `400` "Stock insuficiente. Disponible: N", con `errors.quantity`: la salida supera el stock. No cambia nada.
- `404`: el insumo no existe.

**`GET /api/inventory/items/:id/lots`:** `200` con los lotes, incluidos los vacíos, en orden FEFO; `404` si el insumo no existe.

### Proveedores

**Proveedor (`Supplier`):** `{ id, name, contactName, phone, email, address, notes, createdAt }`. Todos son opcionales (`null`) salvo `name`.

**Body de `POST` y `PUT`:** los mismos campos, sin `id` ni `createdAt`.
- `name`: 2 a 120.
- `contactName`: hasta 120.
- `phone`: hasta 30.
- `email`: correo válido o vacío, hasta 254; se guarda en minúsculas.
- `address`: hasta 250.
- `notes`: hasta 1000.
- Los campos que llegan como `""` se guardan como `null`.

| Endpoint | Detalle |
|---|---|
| `GET /api/inventory/suppliers` | `200` con la lista completa, sin paginar, ordenada por nombre |
| `POST /api/inventory/suppliers` | `201`; `400` |
| `PUT /api/inventory/suppliers/:id` | `200`; `400`, `404` "Proveedor no encontrado" |
| `DELETE /api/inventory/suppliers/:id` | `204`; `404`. `409` "No se puede eliminar: el proveedor tiene órdenes de compra asociadas". |

### Órdenes de compra

**Orden (`PurchaseOrder`):**

```json
{
  "id": "0199…",
  "supplierId": "0199…",
  "status": "pendiente",
  "notes": "Pedido mensual",
  "lines": [
    { "itemId": "0199…", "quantity": 20, "unitCost": 8.75, "expirationDate": "2027-06-30" },
    { "itemId": "0199…", "quantity": 4, "unitCost": 12.00, "expirationDate": null }
  ],
  "createdAt": "2026-11-15T18:20:00Z",
  "receivedAt": null
}
```

| Endpoint | Detalle |
|---|---|
| `GET /api/inventory/purchase-orders` | `200` con la lista completa, sin paginar, de la más reciente a la más antigua, con sus líneas en el orden en que se crearon |
| `POST /api/inventory/purchase-orders` | Ver abajo |
| `POST /api/inventory/purchase-orders/:id/receive` | Ver abajo |
| `POST /api/inventory/purchase-orders/:id/cancel` | `200` con la orden `cancelada`; no mueve stock. `404`, y `409` "Solo se pueden cancelar órdenes pendientes". |

**Crear (`POST /api/inventory/purchase-orders`):** `201` con la orden en estado `pendiente`. No mueve stock.

Body: `{ supplierId, lines, notes }`.
- `supplierId`: obligatorio.
- `lines`: de 1 a 100. En cada línea:
  - `itemId`: obligatorio.
  - `quantity`: ≥ 1.
  - `unitCost`: ≥ 0.
  - `expirationDate`: `"YYYY-MM-DD"` o `""`.
- `notes`: hasta 1000.

Errores `400`: validación, `errors.supplierId` "El proveedor no existe" o `errors["lines[0].itemId"]` "El insumo no existe".

**Recibir (`POST /api/inventory/purchase-orders/:id/receive`):** `200` con la orden `recibida` y su `receivedAt`.
- Por cada línea crea un lote y un movimiento de entrada, con el motivo "Recepción de orden de compra #&lt;id&gt;".
- Todo ocurre en una transacción: si algo falla, no se recibe nada.
- La orden queda bloqueada mientras se recibe: dos recepciones simultáneas no duplican el stock.

Errores: `404` "Orden de compra no encontrada", y `409` "Solo se pueden recibir órdenes pendientes".

### Ciclos de esterilización

**Ciclo (`SterilizationCycle`):**

```json
{
  "id": "0199…",
  "itemIds": ["0199…"],
  "performedAt": "2026-11-14",
  "result": "aprobado",
  "responsibleProfessionalId": "0199…",
  "notes": "Autoclave 1",
  "createdAt": "2026-11-15T18:30:00Z"
}
```

| Endpoint | Detalle |
|---|---|
| `GET /api/inventory/sterilization-cycles` | `200` con la lista completa, sin paginar, por fecha del ciclo de la más reciente a la más antigua |
| `POST /api/inventory/sterilization-cycles` | Ver abajo |

**Crear (`POST /api/inventory/sterilization-cycles`):** `201`. Body: `{ itemIds, performedAt, result, responsibleProfessionalId, notes }`.
- `itemIds`: de 1 a 200; los repetidos se unen.
- `performedAt`: `"YYYY-MM-DD"`, obligatoria y no futura según el día de hoy en la zona horaria de la clínica (`Clinic:TimeZone`).
- `result`: `aprobado` o `fallido`.
- `responsibleProfessionalId`: obligatorio; debe ser un profesional existente y activo (`400` en `errors.responsibleProfessionalId`).
- `notes`: hasta 1000.

Errores `400`: validación, `errors.itemIds` "Alguno de los instrumentos seleccionados no existe", o "«nombre» no es instrumental esterilizable".

**Pendientes de `inventory`:**
- Las llaves foráneas de los movimientos ya están (pacientes, profesionales y tratamientos realizados).
- Desactivar insumos en lugar de borrarlos.
- Más de 100 insumos en los selectores y en "Stock crítico" (el frontend pide `pageSize: 100`).

## 7. `patients`

**Paciente (`Patient`)**, con la forma de `patient.types.ts`:

```json
{
  "id": "0199…",
  "clinicalRecordNumber": "HC-000123",
  "firstName": "María",
  "lastName": "Pérez",
  "documentId": "1712345678",
  "birthDate": "1990-05-12",
  "gender": "femenino",
  "maritalStatus": "",
  "occupation": "", "company": "", "nationality": "Ecuatoriana",
  "phone": "0991234567", "email": "", "address": "", "city": "Quito",
  "notes": "",
  "notificationsEnabled": true,
  "emergencyContactName": "", "emergencyContactRelationship": "", "emergencyContactPhone": "",
  "insuranceProvider": "", "insurancePolicy": "",
  "consentSigned": false,
  "treatmentStatus": "activo",
  "lastVisitAt": "",
  "createdAt": "2026-11-17T15:00:00Z",
  "deletedAt": null
}
```

- **`clinicalRecordNumber`:** lo asigna el servidor con una secuencia de PostgreSQL y nunca cambia; `PUT` lo ignora.
- **Textos opcionales:** van como `""`, no `null`. Las fechas vacías también van como `""`.
- **`deletedAt`:** `null` si el paciente está activo (baja lógica).

**Body de `POST` y `PUT`:** los campos de `patientSchema`, sin `id`, `clinicalRecordNumber`, `createdAt` ni `deletedAt`.
- **Obligatorios:**
  - `firstName` y `lastName`: 2 a 80;
  - `documentId`: 5 a 20;
  - `birthDate`: no futura y desde 1900;
  - `gender`: `femenino`, `masculino` u `otro`;
  - `phone`: 7 a 30.
- **Opcionales:**
  - `maritalStatus`: `""` o una de 5 opciones;
  - `email`: correo válido o `""`;
  - `treatmentStatus`: una de 4 opciones, `activo` por defecto;
  - `lastVisitAt`: no futura;
  - `notificationsEnabled`: `true` si no viene;
  - máximos de largo de `patientSchema`; `notes` hasta 2000.

| Endpoint | Roles | Detalle |
|---|---|---|
| `GET /api/patients?page&pageSize&search` | los tres | `200` paginado, sin los dados de baja, del más reciente al más antiguo. `search` no distingue mayúsculas ni tildes y busca en nombres y apellidos (en cualquier orden), cédula, teléfono y N.° de historia (`HC-000123`). |
| `GET /api/patients/:id` | los tres | `200` (también si está dado de baja, con `deletedAt`); `404` "Paciente no encontrado" |
| `POST /api/patients` | los tres | `201` con `Location`; `400`; `409` "Ya existe un paciente con esta cédula" con `errors.documentId` |
| `PUT /api/patients/:id` | los tres | `200`; `400`; `404`. `409` si la cédula **cambió** a una que ya usa otro paciente activo, o si el paciente está dado de baja ("Reactiva al paciente antes de editarlo"). |
| `DELETE /api/patients/:id` | admin, recepcion | `204`. **Baja lógica:** el paciente deja de aparecer en la lista y en la búsqueda, pero se conserva. Repetirla responde `204`. |
| `POST /api/patients/:id/restore` | admin | `200` con el paciente reactivado; `404`; `409` si otro paciente activo ya usa su cédula |

**Cédulas repetidas:** la base no exige cédula única, porque los datos de la clínica que se importarán tienen repetidas. La regla la aplica la API, con un candado por cédula para que dos altas simultáneas no pasen las dos.
## 8. `professionals` y `rooms`

Catálogos de la agenda. **No se borran:** se desactivan (`active: false`), porque tienen citas, atenciones y ciclos que deben seguir mostrando su nombre. Las listas devuelven también los inactivos; el frontend debe ofrecer solo los activos en los selectores.

**Profesional (`Professional`):**

```json
{ "id": "0199…", "name": "Dra. Carla Ríos", "specialty": "Odontología general", "registrationNumber": "MSP-17-04581", "active": true, "userId": "0199…" }
```

- `userId`: el usuario de la app vinculado (o `null`). Es el `professionalId` que devuelve `/auth/me`.

**Consultorio (`Room`):** `{ "id": "0199…", "name": "Consultorio 1", "active": true }`.

| Endpoint | Roles | Detalle |
|---|---|---|
| `GET /api/professionals` | los tres | `200` lista completa, sin paginar, por nombre |
| `GET /api/professionals/:id` | los tres | `200`; `404` "Profesional no encontrado" |
| `POST /api/professionals` | admin | `201`. Body: `{ name (3-120), specialty (2-80), registrationNumber? (≤40), active? (true), userId? }` |
| `PUT /api/professionals/:id` | admin | `200` con `futureAppointments`: cuántas citas no canceladas tiene desde ahora, para avisar al desactivarlo. `400` (`errors.userId` "El usuario no existe"); `404`; `409` "Ese usuario ya está vinculado a otro profesional". `userId: null` desvincula. |
| `GET /api/rooms` | los tres | `200` lista completa, por nombre |
| `POST /api/rooms` | admin | `201`. Body: `{ name (2-60), active? }`. `409` "Ya existe un consultorio activo con ese nombre" (`errors.name`, sin distinguir mayúsculas). |
| `PUT /api/rooms/:id` | admin | `200`; `400`, `404`, `409` |

**En desarrollo,** si las tablas están vacías, se crean los 3 profesionales y los 3 consultorios del modo mock, y `medico@clinica.com` queda vinculado a la Dra. Carla Ríos.

## 9. `appointments` y `schedule-blocks`

**Hora de la clínica:** el frontend envía `date` (`"YYYY-MM-DD"`) y `startTime`/`endTime` (`"HH:mm"`) tal como los escribe el usuario. La API los convierte a UTC con la zona de la clínica (`Clinic:TimeZone`) y devuelve `start`/`end` en ISO UTC. Ejemplo: 09:00 en Ecuador → `"…T14:00:00Z"`.

**Cita (`Appointment`):**

```json
{
  "id": "0199…", "patientId": "0199…", "professionalId": "0199…",
  "treatmentId": null, "roomId": "0199…",
  "start": "2026-12-01T14:00:00Z", "end": "2026-12-01T14:30:00Z",
  "status": "programada", "notes": "Control", "createdAt": "2026-11-17T20:00:00Z"
}
```

**Body de `POST` y `PUT`** (`appointmentSchema`): `{ patientId, professionalId, treatmentId?, roomId?, date, startTime, endTime, notes? }`.
- `treatmentId` y `roomId` aceptan `""` o `null` cuando no se eligen.
- El paciente debe existir y estar activo; el profesional, el consultorio y el tratamiento deben existir y estar activos. Al editar, solo se revisa lo que cambió.
- La hora de fin debe ser posterior a la de inicio, con una duración de 5 minutos a 12 horas. Se permiten citas en el pasado, para registrar tarde.
- `notes`: hasta 1000.

**Choques (`409` con `errors.startTime`).** Se revisan en este orden, con los mensajes del mock:
1. "El profesional ya tiene una cita agendada en ese horario"
2. "El consultorio ya está ocupado en ese horario"
3. "El profesional tiene un bloqueo de horario en ese rango"
4. "El consultorio tiene un bloqueo de horario en ese rango"

Cuenta como ocupado toda cita **no cancelada** y todo bloqueo. Dos citas pegadas (una termina a las 10:00 y otra empieza a las 10:00) no chocan. Si dos personas agendan a la vez el mismo horario, un candado de PostgreSQL por profesional y por consultorio hace que una reciba `201` y la otra `409`.

| Endpoint | Detalle |
|---|---|
| `GET /api/appointments?from&to&patientId&professionalId` | `200` lista sin paginar, por inicio. `from`/`to` son fechas de la clínica, inclusivas (las dos o ninguna); **sin rango devuelve todas**. Con `patientId`, de la más reciente a la más antigua. `400` si `from > to`. |
| `GET /api/appointments/:id` | `200`; `404` "Cita no encontrada" |
| `POST /api/appointments` | `201` (`programada`); `400`; `409` choque |
| `PUT /api/appointments/:id` | `200`; `400`; `404`; `409` choque (sin contar la propia cita) o "Solo se pueden editar citas programadas o confirmadas" |
| `PATCH /api/appointments/:id/status` | Body `{ status }`. `200`; `400` estado desconocido; `404`; `409` cambio no permitido. Repetir el mismo estado responde `200` sin cambios. |

**Cambios de estado permitidos** (los botones del detalle de la cita): `programada → confirmada`; `programada` o `confirmada` → `completada`, `no_asistio` o `cancelada`. `cancelada`, `completada` y `no_asistio` son finales.

**Bloqueo (`ScheduleBlock`):** `{ id, professionalId, roomId, start, end, reason, createdAt }`. Body de `POST` (`scheduleBlockSchema`): `{ professionalId?, roomId?, date, startTime, endTime, reason (3-300) }`, con al menos un profesional o un consultorio (`errors.roomId`).

| Endpoint | Detalle |
|---|---|
| `GET /api/schedule-blocks?from&to` | `200` lista por inicio. Con rango, los que se cruzan con esos días; sin rango, todos. |
| `POST /api/schedule-blocks` | `201`; `400`; `409` si cae sobre una cita no cancelada ("El profesional tiene una cita agendada en ese horario" / "El consultorio tiene una cita agendada en ese horario"). Los bloqueos sí pueden superponerse entre sí. |
| `DELETE /api/schedule-blocks/:id` | `204`; `404` "Bloqueo no encontrado" |

## Estado de los módulos

| Módulo | Responsable | Estado |
|---|---|---|
| Base (errores, paginación, salud, CORS, configuración, logs) | Jorge Flores | ✅ Hecho |
| `auth` | Jorge Flores | ✅ Endpoints hechos. Faltan el proveedor de correo, la gestión de usuarios, la revisión de solicitudes de acceso y la limpieza de tokens viejos. |
| `treatments` | Jorge Flores | ✅ Catálogo, insumos y tratamientos realizados |
| `inventory` | Jorge Flores | ✅ Los 18 endpoints |
| `clinical-history` | Jorge Flores | 📝 Plan en revisión: [`plan-historia-clinica.md`](./plan-historia-clinica.md) |
| `patients` | Jorge Flores | ✅ Los 6 endpoints, con baja lógica y N.° de historia |
| `appointments`: profesionales y consultorios | Jorge Flores | ✅ Los 7 endpoints |
| `appointments`: citas y bloqueos | Jorge Flores | ✅ Los 8 endpoints, con choques, candados y hora de la clínica |
| `institution`, `notifications`, `finance`, `reports` | Jorge Flores | ⏳ Sin empezar en el backend |

**Para conectar el frontend** (`VITE_USE_MOCK_API=false`): falta la parte de sesión del frontend, detallada en `backlog.md` § `auth`.
- `withCredentials: true` en `shared/lib/http.ts`.
- Llamar a `POST /auth/refresh` al cargar la app.
- Renovar la sesión ante un `401`.
- Las funciones `*Real` que faltan en `auth.api.ts`.

Sin eso, la sesión se pierde al recargar la página.
