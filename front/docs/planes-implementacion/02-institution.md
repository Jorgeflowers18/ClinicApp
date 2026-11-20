# Plan 2 — `institution`: perfil, marca y sedes

## Objetivo

Que el perfil de la clínica se lea y se guarde en la API (`endpoints-api.md` § 11), en vez de en `localStorage`. Hoy cada navegador tiene su propio perfil: el logo que sube el admin no lo ve la recepción.

**Módulo del conmutador:** `institution`. **Necesita:** el plan 1, porque el perfil completo pide sesión.

## Mocks que se deshabilitan

`institution` no tiene `*.api.ts`: lee y escribe `localStorage` directamente. Al conectarlo se crea el recurso completo con el estándar del plan 0.

| Mock (archivo) | Qué simula | Se reemplaza por |
|---|---|---|
| `readInstitutionProfile` / `writeInstitutionProfile` + `INSTITUTION_PROFILE_STORAGE_KEY` (`institution.types.ts`) | El perfil guardado en el navegador | `GET /institution/profile` (los tres roles) y `PUT /institution/profile` (solo admin) |
| `useInstitutionProfile` (`useSyncExternalStore` + evento `storage`) | Que la barra lateral se entere de los cambios | `useQuery(institutionKeys.profile)`. Al guardar, `setQueryData` con la respuesta del `PUT`, y la barra se actualiza. |
| `initialInstitutionProfile` | Valores por defecto | Solo para el modo mock y como `placeholderData`. En la API, el perfil existe desde el primer arranque (`InstitutionSeeder`). |
| La marca del login (`auth-layout.tsx`) lee el mismo `localStorage` | Logo y nombre sin sesión | `GET /institution/public` → `{ name, logoText, logoImage }`, sin sesión. |
| `readSavedInstitutionName` / `useSavedInstitutionName` (plan 0) | Nombre para la mensajería | El `name` de la consulta del perfil |
| Ids de sede `branch-${Date.now()}` (`institution-branches.tsx:72-77`) | Id generado en el navegador | La sede nueva se envía **sin `id`**: el servidor le da un UUID y lo devuelve. |

## Diferencias de contrato

| Campo | Frontend | API | Resuelve |
|---|---|---|---|
| `subtitle` | Existe: lo muestran el login y la barra lateral | ✅ Hasta 120, en el perfil, en el `PUT` y en `/public` (`53b1d64`) | Coinciden |
| `logoText` | "Legacy": las iniciales se calculan del nombre | Hasta 10 caracteres | Front: seguir enviándolo (o `""`). No bloquea. |
| `updatedAt` | No existe | Lo devuelve la API | Front: sumarlo al tipo (sirve para mostrar "Actualizado el…") |
| `branches[i].id` | Texto del navegador | UUID del servidor; `""` o `null` para una sede nueva | Front: no generar ids. Usar un id temporal solo como `key` de React, sin enviarlo. |
| `branches[i].name` | Obligatorio en el formulario | Opcional; la API devuelve `label` ("Sede N" si no tiene nombre) | Front: mostrar `label`. Decidir con la clínica si el formulario deja el nombre vacío. |
| `branches[i].label` | No existe | Lo calcula la API | Front: sumarlo al tipo, de solo lectura |
| `logoImage` | Data URL, también SVG | PNG, JPG o WebP de hasta ~500 KB; **SVG no** | Front: rechazar SVG al elegir el archivo (`institution-logo-controls.tsx`) con el mismo mensaje del back |

## Cambios en el frontend

1. **Recurso nuevo:**
   - `institution/api/institution.contract.ts` (`getPublic`, `getProfile`, `saveProfile`);
   - `institution.http.ts`;
   - `institution.mock.ts`, con la lógica actual de `localStorage`;
   - `institution.api.ts`;
   - `institution.queries.ts` (`usePublicInstitution`, `useInstitutionProfile`, `useSaveInstitutionProfile`).
2. **`useInstitutionProfile`:**
   - conserva su nombre y su forma de retorno, para no tocar a quienes lo usan (`institution-brand.tsx`, `notification-message-preview.tsx`);
   - por dentro usa React Query y devuelve `data ?? initialInstitutionProfile`.
3. **`auth-layout.tsx`:** usa `usePublicInstitution()`, porque no hay sesión en el login.
4. **`institution-profile-page.tsx`:**
   - el estado inicial sale de la consulta, con "Cargando…" mientras llega;
   - `handleSave` y `handleCommitBranches` llaman a `useSaveInstitutionProfile` con el perfil completo, porque el `PUT` reemplaza todo, sedes incluidas;
   - los errores `400` se muestran por campo, incluido `branches[i].id`;
   - "Cancelar" vuelve a los datos de la consulta;
   - quitar los mensajes "en este navegador".
5. **`institution-branches.tsx`:**
   - la sede nueva va con `id: ""`;
   - tras guardar, la lista se reemplaza por la que devuelve la API (con los UUID);
   - mostrar `label`.
6. **Roles:** la página ya es solo admin (`routes.tsx`). La consulta del perfil la hacen los tres roles, para la barra lateral.

## Cambios necesarios en el back

✅ **Hecho** (`53b1d64`, migración `InstitucionSubtitulo`): `subtitle` en `institutions`, en el perfil, en el `PUT` y en `GET /institution/public` (`{ name, subtitle, logoText, logoImage }`). Ya no queda nada del back para este plan.

## Verificación

- **Admin:** cambia el nombre, el subtítulo y el logo. Recepción, en otro navegador, los ve en la barra lateral después de recargar. El login muestra el logo sin sesión.
- **Sedes:**
  - crear dos (una sin nombre: se ve "Sede 2"), cambiar la principal y borrar una;
  - recargar: el orden y los UUID se mantienen.
- **Errores:** un logo SVG lo rechaza el navegador; un RUC de 12 dígitos muestra el error en el campo, que viene del `400` del back.
- **E2E:** adaptar `institution-*.spec.ts` y `messaging-identity.spec.ts`.

## Terminado

- Sin `localStorage` para el perfil en modo API.
- El login usa `/public`.
- Las sedes usan los UUID del servidor.
- `subtitle` se guarda en la base y se ve en el login.
