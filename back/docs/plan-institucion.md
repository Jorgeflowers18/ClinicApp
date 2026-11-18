# Plan de implementación — `institution`

- **Responsable:** Jorge Flores
- **Orden:** 6 de [`backlog-desgloce.md`](../backlog-desgloce.md). No depende de otros módulos: se puede adelantar.
- **Estado:** en revisión. Ninguna decisión aprobada.
- **Detalle de endpoints:** [`backlog.md` § `institution`](../backlog.md#institution)
- **Contrato del frontend:** `front/src/modules/institution/types/institution.types.ts` (`InstitutionProfile`, `InstitutionBranch`). **No hay `institution.api.ts`:** hoy el perfil se guarda en el navegador (`localStorage`), así que hay que crear el par Mock/Real.

## 1. Objetivo y alcance

El perfil de la clínica en la base de datos, en lugar de cada navegador:
- nombre, razón social y RUC;
- contacto: teléfono, correo, dirección y sitio web;
- logo, notas y horario;
- sedes.

Lo usan:
- la pantalla "Perfil de la institución";
- la de inicio de sesión (logo y nombre);
- las notificaciones (`[nombre de la clínica]`).

## 2. Decisiones

| # | Decisión | Propuesta |
|---|---|---|
| I1 | Dónde se guarda | Tabla `institutions` **con una sola fila**. Así, si se aprueba la multi-clínica ([`plan-multiclinica.md`](./plan-multiclinica.md), M1), la tabla ya existe y solo se agregan filas. |
| I2 | Sedes | Tabla propia `institution_branches`, porque más adelante los consultorios y las citas podrían apuntar a una sede. Como máximo una principal. |
| I3 | Logo | Igual que la foto de "Mi perfil": una data URL (PNG, JPG o WebP) de hasta ~500 KB en una columna de texto. El contrato del frontend no cambia. Si más adelante pesa demasiado, pasa a un archivo aparte (`POST /institution/logo`). **SVG no se acepta**, porque puede llevar código. |
| I4 | Pantalla de inicio de sesión | Endpoint **público** `GET /institution/public` que devuelve solo `{ name, logoText, logoImage }`. El perfil completo pide sesión. |
| I5 | Guardar | `PUT` reemplaza el perfil completo con sus sedes. Las sedes con `id` existente se actualizan, las nuevas se crean y las que no vienen se borran. Mismo criterio que los insumos de un tratamiento. |
| I6 | RUC | 13 dígitos o vacío. No se verifica el dígito validador del SRI, porque hay RUC de personas naturales, sociedades y entidades públicas, con reglas distintas. |

## 3. Archivos

### Nuevos

```text
back/docs/plan-institucion.md                       ← este plan (se borra al terminar)
back/src/ClinicApp.Api/Modules/Institution/
├── InstitutionEntities.cs        ← Institution, InstitutionBranch
├── InstitutionConfiguration.cs   ← tablas, índice de una sola sede principal
├── InstitutionDtos.cs            ← InstitutionProfileRequest/Dto, BranchRequest/Dto, PublicInstitutionDto
├── InstitutionController.cs      ← /api/institution
└── InstitutionSeeder.cs          ← crea la fila con los valores de initialInstitutionProfile si la tabla está vacía
back/src/ClinicApp.Api/Data/Migrations/<fecha>_CrearInstitucion.cs (+ .Designer.cs)
```

### Modificados

| Archivo | Cambio |
|---|---|
| `Data/AppDbContext.cs` | `DbSet` de las 2 tablas |
| `Common/Validation.cs` | Validación de data URL de imagen, compartida con "Mi perfil" |
| `Program.cs` | Registrar `InstitutionSeeder` |
| `ClinicApp.Api.http`, `docs/*`, `backlog.md`, `backlog-desgloce.md` | Documentación |

## 4. Entidades

### `Institution` → tabla `institutions` (una fila)

| Atributo | Tipo C# | Columna | Reglas |
|---|---|---|---|
| `Id` | `Guid` | `uuid` PK | Fijo |
| `Name` | `string` | `varchar(160)` | 2 a 160 |
| `LegalName` | `string` | `varchar(200)` | |
| `Ruc` | `string` | `varchar(13)` | I6 |
| `Phone` | `string` | `varchar(30)` | |
| `Email` | `string` | `varchar(254)` | Correo válido o vacío |
| `Address` | `string` | `varchar(250)` | |
| `Website` | `string` | `varchar(200)` | URL `http(s)://` o vacío |
| `LogoText` | `string` | `varchar(4)` | 1 a 4 caracteres ("CA") |
| `LogoImage` | `string?` | `text` null | I3 |
| `Notes` | `string` | `varchar(1000)` | |
| `Hours` | `string` | `varchar(500)` | |
| `UpdatedAt` | `DateTime` | `timestamptz` | |
| `UpdatedByUserId` | `Guid?` | `uuid` FK → `users` (set null) | |

### `InstitutionBranch` → tabla `institution_branches`

| Atributo | Tipo C# | Columna | Reglas |
|---|---|---|---|
| `Id` | `Guid` | `uuid` PK | El frontend lo genera al agregar; la API acepta un UUID nuevo o crea uno |
| `InstitutionId` | `Guid` | `uuid` FK → `institutions` (cascade) | |
| `Position` | `int` | `integer` | Orden en la pantalla |
| `Name` | `string` | `varchar(120)` | 2 a 120 |
| `Address` | `string` | `varchar(250)` | |
| `Phone` | `string` | `varchar(30)` | |
| `Hours` | `string` | `varchar(500)` | |
| `IsMain` | `bool` | `boolean` | Índice único parcial `WHERE is_main`: como máximo una (I2) |

## 5. Endpoints

| Método y ruta | Roles | Respuesta | Errores |
|---|---|---|---|
| `GET /api/institution/public` | Público | `200` `{ name, logoText, logoImage }` | |
| `GET /api/institution/profile` | Los tres | `200` `InstitutionProfile` con `branches` en orden | |
| `PUT /api/institution/profile` | `admin` | `200` `InstitutionProfile` | `400` por campo (`ruc`, `email`, `website`, `logoImage`, `branches[1].name`, más de una principal: `branches`) |

`GET /institution/public` tiene el mismo límite de intentos que los endpoints públicos de `auth`.

## 6. Migración

`CrearInstitucion`: crea las dos tablas. `InstitutionSeeder` inserta la fila al arrancar si no existe, con los valores de `initialInstitutionProfile` del frontend. Así nunca hay que manejar "sin perfil".

## 7. Pruebas

- **Roles:** `GET /public` sin sesión; `GET /profile` con los tres roles; `PUT` solo `admin` (`403` para los demás).
- **Validación:**
  - RUC de 12 dígitos o con letras;
  - correo o sitio web inválidos;
  - logo SVG, de más de 500 KB o que no es una data URL;
  - dos sedes principales;
  - sede sin nombre.
- **Sedes:** agregar, editar, quitar y reordenar en un `PUT`.
- **Público:** devuelve solo nombre, iniciales y logo; nunca el RUC ni las notas.

## 8. Al terminar

- **Anotar como pendiente en el frontend:**
  - crear `institution.api.ts` (Mock/Real) y usarlo en la pantalla de perfil;
  - que `auth-layout.tsx` lea `GET /institution/public`.
- Actualizar `estructura-base.md` y `endpoints-api.md`.
- Commit. Borrar este plan.
