# Plan de implementación — multi-clínica (`institutions`)

- **Responsable:** Jorge Flores
- **Estado:** **propuesta en espera** (2026-11-16). Se anotan aquí las ideas y decisiones para retomarlas después; por ahora el backend sigue para una sola clínica.
  - Aprobadas: M1, M3 (provisional) y M4 a M8.
  - Pendiente: M2, rediseñada como "una persona, varias clínicas". Sus preguntas abiertas están en § 2.1.
- **Por qué:** el sistema se venderá a varias clínicas. Cada una tendrá su propio personal y sus propios datos, y **ninguna puede ver los datos de otra**.
- **Cuándo se retoma:** cuando se decida. Cuantos más módulos existan, más tablas recibe `institution_id` en la migración (M8). Aun así, el paso es el mismo para todas: agregar la columna, asignar "Clínica demo" a lo existente y volverla obligatoria.

## 1. La idea en simple

Hoy la base guarda los datos de **una** clínica. Con este cambio:

1. Se crea la tabla `institutions`: una fila por clínica cliente, con su perfil (nombre, RUC, contacto...).
2. Una persona tiene **una sola cuenta** (un correo, una contraseña) y puede trabajar en **varias** clínicas, con un rol distinto en cada una (M2).
3. Cada fila de datos (un tratamiento, un insumo, una historia...) guarda a qué clínica pertenece, en la columna `institution_id`.
4. Al iniciar sesión, la persona elige la clínica (si tiene más de una), y esa clínica viaja dentro del token. En cada consulta, la API **agrega sola** el filtro "solo de mi clínica" y, al guardar, **pone sola** la clínica. Los controladores no tienen que acordarse de hacerlo.

Ejemplo: la doctora de la Clínica A pide `GET /inventory/items`. La API devuelve solo los insumos con `institution_id = A`. Si pide un insumo de la Clínica B por su `id`, recibe `404`, como si no existiera.

## 2. Decisiones

| # | Decisión | Propuesta | Estado |
|---|---|---|---|
| M1 | Cómo se separan los datos | **Una sola base de datos, con la columna `institution_id`** en cada tabla de datos de la clínica. `institutions` guarda también el perfil de la clínica. | ✅ Aprobada |
| M2 | Cuentas e inicio de sesión | **Una persona, un correo, varias clínicas.** Al entrar elige la clínica, y puede cambiarla sin volver a escribir la contraseña. | 🔍 Rediseñada, pendiente |
| M3 | Quién crea las clínicas | Por ahora, **por configuración al arrancar** (semilla), sin pantalla. | ✅ Provisional; la pantalla se piensa a futuro |
| M4 | Cómo se garantiza el aislamiento | **Filtro global de EF Core** más asignación automática al guardar. La clínica sale **solo del token**. | ✅ Aprobada |
| M5 | Qué tablas llevan `institution_id` | Las tablas "raíz" y las que se consultan solas. Las hijas que solo se leen por su padre, no (§ 4). | ✅ Aprobada |
| M6 | Datos propios de cada clínica | La **zona horaria** pasa a ser de la clínica (columna `time_zone`), no de la configuración del servidor. | ✅ Aprobada |
| M7 | Clínica desactivada | `active = false`: nadie puede entrar a esa clínica; quien tenga otras, sigue entrando a ellas. | ✅ Aprobada |
| M8 | Datos que ya existen | La migración crea la clínica "Clínica demo" y le asigna todo lo existente. | ✅ Aprobada |

### M1. Una base compartida con `institution_id`

| Opción | A favor | En contra |
|---|---|---|
| ✅ **Una base, columna `institution_id`** | Una sola migración para todas las clínicas, un solo respaldo, barato de alojar. Es lo habitual para un sistema que se vende a muchos clientes pequeños. | Un error de programación podría mezclar datos. Por eso el filtro es automático (M4) y se prueba con dos clínicas (§ 8). |
| Una base por clínica | Separación total | Cada migración se aplica N veces, N respaldos, N cadenas de conexión. Demasiado para el tamaño actual. |
| Un esquema de PostgreSQL por clínica | Intermedio | La misma complejidad de migraciones que la anterior, con menos herramientas de EF Core. |

Si algún día una clínica grande exige su propia base, se puede instalar una copia de la API solo para ella: el código es el mismo.

**Perfil de la clínica en la misma tabla:** `institutions` tiene las columnas del perfil que hoy el frontend guarda en el navegador (`institution.types.ts`): razón social, RUC, teléfono, correo, dirección, sitio web, texto del logo, notas y horario (§ 4). Las **sedes** y la **imagen del logo** quedan fuera de este plan: las sedes probablemente necesitan su propia tabla (las citas y los consultorios las nombrarán) y el logo, decidir si se sube como archivo. Se definen con los endpoints del perfil.

### M2. Una persona, varias clínicas

**La idea:** se separa **quién es la persona** de **en qué clínicas trabaja**.

| Tabla | Qué guarda | Ejemplo |
|---|---|---|
| `users` (la persona) | Correo, contraseña, nombre y "Mi perfil". **Una fila por persona**, el correo es único en todo el sistema. | Dra. Torres, `mtorres@gmail.com` |
| `institution_memberships` (el vínculo) | En qué clínica trabaja, con qué rol, su profesional en esa clínica y si está activa allí. **Una fila por persona y clínica.** | Dra. Torres → Clínica A, `admin` · Dra. Torres → Clínica B, `medico` |

**Cómo entra, paso a paso:**

1. **Escribe su correo y contraseña,** como hoy (`POST /auth/login`). La API verifica la contraseña y busca sus clínicas activas.
2. **Si tiene una sola clínica,** entra directo, igual que hoy. La respuesta es la misma de siempre, con el token de esa clínica.
3. **Si tiene varias,** la API todavía no entrega la sesión. Responde la lista de clínicas (nombre, logo y su rol en cada una) y un **pase de selección**: un código firmado que dura 5 minutos y solo sirve para elegir clínica, no para ver datos.
4. **El frontend muestra "¿A qué clínica quieres entrar?"** con la lista. Puede dejar marcada la última que usó.
5. **Elige una** (`POST /auth/select-institution` con el pase y la clínica). La API verifica que de verdad trabaja ahí y entrega la sesión con esa clínica y **el rol de esa clínica**.

**Cambiar de clínica sin salir:** en el menú del usuario aparece "Cambiar de clínica". Llama al mismo `POST /auth/select-institution`, esta vez con la sesión actual en lugar del pase. La API cierra la sesión de la clínica anterior y abre la nueva; el frontend recarga los datos.

**Lo que hay que saber:**
- **El rol es por clínica.** La Dra. Torres es `admin` en A y `medico` en B. Al cambiar de clínica, cambia lo que puede hacer.
- **Una clínica a la vez por navegador.** La cookie de sesión es una sola por navegador. Si abre dos pestañas y cambia de clínica en una, la otra también pasa a la nueva clínica. El frontend avisa y recarga esa pestaña, para que nadie registre algo en la clínica equivocada. Para trabajar en dos clínicas a la vez, se usan dos navegadores.
- **"Mi perfil" es de la persona.** Su nombre, título, especialidad y foto son los mismos en todas sus clínicas. Su profesional (`professional_id`) sí es por clínica, porque cada clínica tiene su catálogo de profesionales.
- **Una contraseña para todo.** Recuperar la contraseña la cambia para todas sus clínicas.
- **Desactivar a alguien es por clínica.** Si la Clínica A da de baja a la Dra. Torres, ella deja de ver A, pero sigue entrando a B. `users.active = false` bloquea a la persona en todas (solo para casos de plataforma, como una cuenta robada).
- **Un administrador no ve las otras clínicas** de su personal. Al agregar a alguien que ya tiene cuenta, solo se crea el vínculo con su clínica; no ve ni cambia la contraseña de esa persona. Esto aplica cuando exista la gestión de usuarios (pendiente en `backlog.md`).
- **La pantalla de login** muestra la marca de ClinicApp, porque antes de entrar no se sabe a qué clínica va. El logo de cada clínica aparece en la lista para elegir y dentro de la app. `institutions` tiene un `slug` (`ceot`) por si más adelante cada clínica quiere su propia dirección web con su logo en el login.

**Cambios en el frontend** (pendientes, se anotan en `backlog.md`):
- El login maneja la respuesta "elige clínica" y muestra la lista.
- La opción "Cambiar de clínica" en el menú del usuario.
- El aviso entre pestañas al cambiar de clínica.
- `user.role` sigue viniendo en la respuesta, ahora con el rol de la clínica actual. Las pantallas que revisan el rol **no cambian**.

### 2.1 Preguntas abiertas de M2

| # | Pregunta | Propuesta |
|---|---|---|
| P1 | Con varias clínicas, ¿se pregunta siempre a cuál entrar, o se entra directo a la última y se cambia desde el menú? | Preguntar siempre, con la última marcada, para que nadie registre algo en la clínica equivocada |
| P2 | ¿Basta con una clínica a la vez por navegador? Cambiar de clínica en una pestaña cambia las demás; para trabajar en dos a la vez se usan dos navegadores. | Sí, con un aviso y recarga en las otras pestañas |
| P3 | "Mi perfil" (nombre, título, especialidad, foto), ¿es de la persona o de cada clínica? | De la persona: el mismo en todas sus clínicas |

### M3. Crear clínicas

- **Hoy no hay pantalla** para crear clínicas. Se crean al arrancar la API, igual que el administrador inicial:
  - `Seed__InstitutionName`, `Seed__InstitutionSlug`, `Seed__InstitutionTimeZone`.
  - Con `Seed__AdminEmail` y `Seed__AdminPassword` se vincula su primer administrador. Si esa persona ya tiene cuenta, solo se crea el vínculo (M2).
  - Si el `slug` ya existe, no hace nada.
- **El `admin` de cada clínica** administra solo a su personal (la gestión de usuarios sigue pendiente en `backlog.md`).
- **A futuro (por pensar):** un rol de plataforma (`superadmin`, el dueño de ClinicApp) con una pantalla para crear y desactivar clínicas. No está en este alcance.

### M4. Aislamiento automático

| Pieza | Qué hace |
|---|---|
| `institution_id` en el token | Al entrar a una clínica y al renovar la sesión, `TokenService` agrega el claim `institution_id` y el rol de esa clínica. **La API nunca acepta la clínica desde el cuerpo, la URL ni un encabezado.** La única excepción es `POST /auth/select-institution`, que la recibe para **elegirla** y verifica el vínculo antes de emitir el token. |
| `TenantContext` | Lee el claim de la petición actual. Si no hay sesión, la clínica es "ninguna" (`Guid.Empty`). |
| Filtro global (`HasQueryFilter`) | En `AppDbContext`, cada entidad con `institution_id` recibe el filtro `institution_id = clínica de la sesión`. Se aplica a toda consulta, también a `Include`, `Count` y `Any`. **Sin sesión no devuelve nada**: es seguro por defecto. |
| Al guardar (`SaveChanges`) | Las filas nuevas reciben la clínica de la sesión. Si alguna trae otra clínica, la API lanza un error y no guarda nada. |
| SQL escrito a mano | El bloqueo de stock (`SELECT … FOR UPDATE`) agrega `AND institution_id = …` explícito. |
| Lo que corre sin sesión | El login, la renovación de sesión, la recuperación de contraseña y las tareas en segundo plano (limpieza de adjuntos) usan `IgnoreQueryFilters()` **a propósito**, cada uno con un comentario de por qué. |
| `id` de otra clínica | Responde `404`, nunca `403`, para no revelar que existe. |

Las referencias entre tablas también quedan protegidas. Por ejemplo, una orden de compra con un insumo de otra clínica responde `400` "El insumo no existe", porque el filtro no lo encuentra.

### M5. Qué tablas llevan `institution_id`

**Regla:** la llevan las tablas que se consultan solas. Las que solo se leen a través de su padre la heredan de él, y la API ya verifica que lo que referencian sea de la misma clínica.

| Tabla | ¿`institution_id`? | Motivo |
|---|---|---|
| `users` | ❌ | Es la persona, que puede estar en varias clínicas (M2) |
| `institution_memberships` | ✅ | El vínculo persona–clínica. Con filtro: el `admin` de A solo ve a su personal. El login lo lee sin filtro, a propósito. |
| `refresh_tokens` | Columna sí, filtro no | Guarda la clínica de esa sesión, para que al renovar se emita el token de la misma clínica. Se lee por su token, sin filtro. |
| `password_reset_tokens` | ❌ | Son de la persona |
| `access_requests` | ❌ | Son solicitudes de personas que **todavía no** tienen clínica: son de la plataforma |
| `treatments` | ✅ | Cada clínica tiene su catálogo y sus precios |
| `treatment_consumptions` | ❌ | Se leen por su tratamiento |
| `inventory_items`, `stock_lots`, `stock_movements` | ✅ | Lotes y movimientos se consultan solos (FEFO, historial) |
| `suppliers`, `purchase_orders`, `sterilization_cycles` | ✅ | |
| `purchase_order_lines`, `sterilization_cycle_items` | ❌ | Se leen por su orden o ciclo |
| Historia clínica: `clinical_records`, `clinical_record_versions`, `clinical_encounters`, `clinical_attachments` | ✅ | Ver `plan-historia-clinica.md` |
| `encounter_notes` | ❌ | Se lee por su atención |
| Módulos futuros (`patients`, `appointments`, `professionals`, `treatment_assignments`, `finance`, `notifications`...) | ✅ | **Regla para todo lo que venga:** toda tabla de datos de una clínica lleva `institution_id` |

**Índices:** los índices existentes de búsqueda pasan a empezar por la clínica, por ejemplo `(institution_id, name)` en `inventory_items`, porque toda consulta filtra por ella.

### M6. Zona horaria por clínica

- **Columna `institutions.time_zone`** con el nombre IANA (`America/Guayaquil`, `America/Bogota`...). Cada clínica tiene la suya y cambiarla **no requiere reiniciar** la API.
- **`Clinic:DefaultTimeZone`** (`America/Guayaquil`) se usa solo al crear una clínica sin zona.
- **`ClinicClock`** da "la fecha de hoy en la clínica de la sesión". La usan esterilización (hoy tolera un día de diferencia con UTC) y la historia clínica. Lee la zona de la clínica y la guarda en memoria unos minutos.
- **Zona inválida:** se rechaza al guardarla (`400`), así nunca queda una zona que la API no entienda.
- **Más adelante,** la pantalla del perfil de la institución (módulo `institution`) permitirá cambiar la zona junto con los demás datos del perfil, que ya están en esta tabla (M1).

### M7. Clínica o vínculo desactivado

- **Clínica desactivada (`institutions.active = false`):** no aparece en la lista para elegir. Si era la única clínica de la persona, el login responde `403` "No tienes una clínica activa. Comunícate con el administrador de tu clínica."
- **Vínculo desactivado (`institution_memberships.active = false`):** igual, pero solo para esa persona en esa clínica.
- **Sesión abierta:** renovar la sesión de una clínica o vínculo desactivado responde `401`. Como el token de acceso dura 15 minutos, en ese tiempo como máximo queda fuera.
- **Los datos no se borran.**

### M8. Datos existentes

- La migración crea "Clínica demo" con un `id` fijo, le asigna todas las filas existentes y **después** marca `institution_id` como obligatorio.
- **Usuarios existentes:** cada uno queda vinculado a "Clínica demo" con el rol y el profesional que tiene hoy. Luego se quitan `role` y `professional_id` de `users`.
- **Semillas de desarrollo** (solo en `Development`):
  - las tres cuentas actuales quedan en "Clínica demo";
  - una segunda clínica, "Clínica prueba", con `admin2@clinica.com` / `admin123`;
  - `medico@clinica.com` también se vincula a "Clínica prueba" como `admin`, para probar la elección y el cambio de clínica.

## 3. Archivos

### Nuevos

```text
back/docs/plan-multiclinica.md                       ← este plan (se borra al terminar)
back/src/ClinicApp.Api/Common/
├── ClinicClock.cs              ← "hoy" en la zona horaria de la clínica de la sesión (M6)
└── Tenancy/
    ├── ITenantEntity.cs        ← interfaz: "esta entidad tiene InstitutionId"
    └── TenantContext.cs        ← la clínica de la petición actual, leída del token
back/src/ClinicApp.Api/Modules/Institutions/
├── InstitutionEntities.cs      ← Institution, InstitutionMembership
├── InstitutionConfiguration.cs ← tablas, slug único, vínculo único (persona, clínica), CHECK del rol
└── InstitutionSeeder.cs        ← crea "Clínica demo" / "Clínica prueba" en desarrollo, o la de Seed__Institution* (M3)
back/src/ClinicApp.Api/Data/Migrations/<fecha>_AgregarInstituciones.cs (+ .Designer.cs)
```

### Modificados

| Archivo | Cambio |
|---|---|
| `Data/AppDbContext.cs` | `DbSet` de `Institution` e `InstitutionMembership`. Filtro global para toda entidad `ITenantEntity`. `SaveChanges` asigna y verifica `InstitutionId` (M4). |
| `Modules/Auth/AuthEntities.cs`, `AuthConfiguration.cs` | `User` pierde `Role` y `ProfessionalId` (pasan al vínculo). `RefreshToken.InstitutionId`. |
| `Modules/Auth/TokenService.cs` | Claims `institution_id` y rol de la clínica; `GetInstitutionId()`; pase de selección de 5 minutos con otra audiencia (`clinicapp-select`), para que no sirva como token de acceso |
| `Modules/Auth/AuthController.cs` | Login con una o varias clínicas; `POST /auth/select-institution`; refresh con la clínica de la sesión; rechazo de clínica o vínculo desactivado (M7) |
| `Modules/Auth/AuthDtos.cs` | `LoginResponse` con la variante "elige clínica"; `AuthUserDto` agrega `institution` e `institutions` (§ 7) |
| `Modules/Auth/UserSeeder.cs` | Crea las personas y sus vínculos |
| `Common/RateLimits.cs` | `POST /auth/select-institution` con el mismo límite que el login |
| `Modules/Treatments/*` (entidad y configuración) | `InstitutionId` e índices |
| `Modules/Inventory/InventoryEntities.cs`, `InventoryConfiguration.cs` | `InstitutionId` en las 6 tablas de M5 e índices |
| `Modules/Inventory/StockService.cs` | `AND institution_id = …` en el `FOR UPDATE` |
| `Modules/Inventory/SterilizationCyclesController.cs` | "No futura" con `ClinicClock` (quita la tolerancia de un día) |
| `Program.cs` | Registrar `TenantContext`, `ClinicClock` e `InstitutionSeeder` |
| `appsettings.json` | `Clinic:DefaultTimeZone` |
| `ClinicApp.Api.http` | Peticiones con la segunda clínica |
| `README.md` | Variables `Seed__Institution*` |
| `docs/estructura-base.md`, `docs/endpoints-api.md` | Tabla `institutions`, columna `institution_id`, regla de aislamiento |
| `backlog.md`, `backlog-desgloce.md` | Lo hecho y lo pendiente (rol de plataforma, login por `slug`) |

Los controladores de tratamientos e inventario **casi no cambian**: el filtro y la asignación son automáticos.

## 4. Entidades

### `Institution` → tabla `institutions` (nueva)

| Atributo | Tipo C# | Columna | Reglas |
|---|---|---|---|
| `Id` | `Guid` | `uuid` PK | |
| `Name` | `string` | `varchar(160)` | Nombre comercial, 2 a 160 |
| `Slug` | `string` | `varchar(60)` | Único. Minúsculas, números y guiones (`ceot`, `sonrisa-norte`). Para una dirección web propia a futuro (M2). |
| `TimeZone` | `string` | `varchar(60)` | Nombre IANA válido (M6) |
| `Active` | `bool` | `boolean` | M7 |
| `LegalName` | `string` | `varchar(200)` | Razón social. Vacío si no se indicó. |
| `Ruc` | `string` | `varchar(13)` | 13 dígitos o vacío |
| `Phone` | `string` | `varchar(30)` | |
| `Email` | `string` | `varchar(254)` | |
| `Address` | `string` | `varchar(250)` | |
| `Website` | `string` | `varchar(200)` | |
| `LogoText` | `string` | `varchar(10)` | Iniciales que se muestran sin imagen ("CA") |
| `Notes` | `string` | `varchar(1000)` | |
| `Hours` | `string` | `varchar(500)` | Horario de atención |
| `CreatedAt` | `DateTime` | `timestamptz` | |

Las columnas del perfil son los campos de `InstitutionProfile` del frontend (M1). Sus endpoints (`GET/PUT /institution/profile`), las sedes y la imagen del logo se hacen con el módulo `institution`.

### `InstitutionMembership` → tabla `institution_memberships` (nueva, M2)

| Atributo | Tipo C# | Columna | Reglas |
|---|---|---|---|
| `Id` | `Guid` | `uuid` PK | |
| `UserId` | `Guid` | `uuid` FK → `users` (restrict) | |
| `InstitutionId` | `Guid` | `uuid` FK → `institutions` (restrict) | Único `(user_id, institution_id)`: una persona tiene un solo vínculo por clínica |
| `Role` | `string` | `varchar(20)` | `admin`, `recepcion` o `medico` (`CHECK`). **El rol en esta clínica.** |
| `ProfessionalId` | `Guid?` | `uuid` null | Su profesional en esta clínica. Sin FK hasta que exista `professionals`. |
| `Active` | `bool` | `boolean` | M7 |
| `LastSelectedAt` | `DateTime?` | `timestamptz` null | Última vez que entró a esta clínica. Ordena la lista para elegir. |
| `CreatedAt` | `DateTime` | `timestamptz` | |

### Cambios en `users` y `refresh_tokens`

| Tabla | Cambio |
|---|---|
| `users` | Se quitan `role` y `professional_id` (pasan al vínculo). Quedan correo, nombre, contraseña, `profile`, `active` (bloqueo de la persona en todas sus clínicas) y fechas. |
| `refresh_tokens` | Se agrega `institution_id` (FK restrict): la clínica de esa sesión. Al renovar, el token nuevo es de la misma clínica. |

### Columna `institution_id` en las tablas existentes

En las 7 tablas de datos que ya existen (`treatments`, `inventory_items`, `stock_lots`, `stock_movements`, `suppliers`, `purchase_orders`, `sterilization_cycles`):

| Atributo | Tipo C# | Columna | Reglas |
|---|---|---|---|
| `InstitutionId` | `Guid` | `uuid` FK → `institutions` (restrict) | Obligatoria. La asigna la API (M4). Primera columna de los índices de búsqueda. |

## 5. Migración

`AgregarInstituciones`, en este orden:
1. Crear `institutions` e insertar "Clínica demo" (`id` fijo, `slug` = `demo`, `America/Guayaquil`).
2. Crear `institution_memberships` y vincular cada usuario existente a "Clínica demo", con su `role` y su `professional_id` actuales.
3. Quitar `role` y `professional_id` de `users`.
4. Agregar `institution_id` **nulable** a las 7 tablas de datos y a `refresh_tokens`.
5. `UPDATE … SET institution_id = <id de Clínica demo>` en todas.
6. Volverla obligatoria y crear las FK y los índices nuevos.

Antes de aplicarla se revisa el SQL con `dotnet ef migrations script`.

## 6. Reglas de negocio

- Toda consulta y todo guardado quedan limitados a la clínica de la sesión (M4).
- Los `id` de otra clínica responden `404` en `GET`, `PUT` y `DELETE`, y `400` cuando vienen dentro de un cuerpo (insumos de una orden, consumos de un tratamiento, instrumentos de un ciclo).
- El correo de una persona es único en todo el sistema. La contraseña y "Mi perfil" son de la persona; el rol, el profesional y el estado activo, de cada vínculo (M2).
- Las solicitudes de acceso (`access_requests`) siguen siendo de la plataforma.

## 7. Endpoints

**`POST /auth/login`** `{ email, password }`:
- **Con una sola clínica activa:** `200` igual que hoy, `{ accessToken, expiresIn, user }`, con la cookie de sesión.
- **Con varias:** `200` sin sesión ni cookie:
  ```json
  {
    "requiresInstitution": true,
    "selectionToken": "<pase de 5 minutos>",
    "institutions": [
      { "id": "…", "name": "Clínica A", "logoText": "CA", "role": "admin" },
      { "id": "…", "name": "Clínica B", "logoText": "CB", "role": "medico" }
    ]
  }
  ```
  Ordenadas por la última que usó.
- **Sin ninguna activa:** `403` (M7). Correo o contraseña incorrectos: `401`, igual que hoy.

**`POST /auth/select-institution`** (nuevo) `{ institutionId, selectionToken? }`:
- **Después del login:** con `selectionToken`.
- **Para cambiar de clínica:** sin `selectionToken`, con la sesión actual. Revoca la sesión de la clínica anterior.
- **Respuesta:** `200` `{ accessToken, expiresIn, user }` con la cookie de sesión de la clínica elegida.
- **Errores:** `401` pase inválido o vencido; `403` si no trabaja en esa clínica o el vínculo o la clínica están desactivados.

**`user` en las respuestas de sesión y en `GET /auth/me`:**
- `role` y `professionalId` son los de la clínica actual. El frontend no necesita cambiar las pantallas que los usan.
- **Nuevos:** `institution: { id, name, logoText }` (la clínica actual) e `institutions` (sus clínicas activas, para el menú "Cambiar de clínica").

**`POST /auth/refresh`:** emite el token de la misma clínica de la sesión. `401` si la clínica o el vínculo se desactivaron.

## 8. Pruebas

Script de punta a punta con **dos clínicas** (A = demo, B = prueba):

- **Aislamiento, con un admin de cada una:**
  - Listas: A no ve tratamientos, insumos, proveedores, órdenes, ciclos ni movimientos de B.
  - Por `id`: `GET`, `PUT` y `DELETE` de un registro de B desde A responden `404`, y el registro de B no cambia.
  - Referencias: una orden de A con un insumo de B, un consumo de A con un insumo de B y un ciclo de A con un instrumento de B responden `400`.
  - Stock: una salida de A no toca el stock de B.
- **Al guardar:** lo que crea A queda con `institution_id = A`, sin enviarlo.
- **Sesión:** el token trae `institution_id`; `/auth/me` devuelve la clínica.
- **Una persona, varias clínicas** (`medico@clinica.com`, médico en A y admin en B):
  - El login responde la lista de clínicas y el pase, sin sesión. Con una sola clínica entra directo.
  - Elegir B con el pase: sesión de B con rol `admin`. Elegir una clínica donde no trabaja: `403`. Pase vencido o usado como token de acceso: `401`.
  - Cambiar de A a B con la sesión: la sesión de A queda revocada y el rol cambia.
  - La renovación de sesión mantiene la clínica.
  - El `admin` de A no ve en su personal los vínculos de B.
- **Desactivados:**
  - Clínica B desactivada: no aparece en la lista; si era la única, `403`; renovar una sesión de B, `401`.
  - Vínculo desactivado en A: la persona sigue entrando a B.
- **Zona horaria:**
  - con B en `Asia/Tokyo` y A en `America/Guayaquil`, "hoy" es distinto para cada una en esterilización;
  - una zona inválida se rechaza.
- **Migración:** las filas existentes quedan en "Clínica demo".
- **Regresión:** las 80 pruebas de inventario y tratamientos siguen pasando.

## 9. Al terminar

- Actualizar `estructura-base.md` y `endpoints-api.md`.
- **Anotar como pendientes** en `backlog.md`:
  - el rol de plataforma con su pantalla de clínicas (M3);
  - **el cobro a las clínicas por usar ClinicApp** (suscripción o plan, habilitar o suspender el acceso de una clínica según su pago). No se crea por ahora, y es distinto de los pagos de los pacientes de `finance`;
  - en el frontend: la pantalla "¿A qué clínica quieres entrar?", "Cambiar de clínica" en el menú y el aviso entre pestañas (M2);
  - la dirección web propia por clínica (`slug`) con su logo en el login, si se quiere (M2);
  - los endpoints del perfil de la institución, las sedes y el logo, sobre esta misma tabla (M1);
  - en la gestión de usuarios: agregar a alguien que ya tiene cuenta crea solo el vínculo (M2);
  - desde entonces, **toda tabla nueva lleva `institution_id`** e implementa `ITenantEntity`.
- Commit en la rama actual. El push, solo si lo pides.
- Borrar este plan.
