# Plan 1 — `auth`: sesión, perfil, recuperación y solicitud de acceso

## Objetivo

Que el inicio de sesión, la sesión al recargar, "Mi perfil", "Recuperar contraseña" y "Solicitar acceso" funcionen con la API (`back/docs/endpoints-api.md` § 4). Hoy la sesión se pierde al recargar, y las dos últimas pantallas tienen el botón deshabilitado.

**Módulo del conmutador:** `auth`. **Necesita:** el plan 0.

## Mocks que se deshabilitan

| Mock (archivo) | Qué simula | Se reemplaza por |
|---|---|---|
| `MOCK_ACCOUNTS` + `loginMock` (`auth.api.ts`) | 3 cuentas fijas, token falso `mock-token.<id>` | `POST /auth/login` → `{ accessToken, expiresIn: 900, user }` y la cookie `clinicapp_refresh` |
| `logout: mockDelay(150)` | Nada | `POST /auth/logout` (`204`, borra la cookie) |
| `readMockSession` + `MOCK_SESSION_KEY` (`auth-store.ts`) | Sesión guardada en `sessionStorage` para sobrevivir a la recarga | Al cargar la app, `POST /auth/refresh`: la cookie `httpOnly` restaura la sesión. El token queda **solo en memoria**. |
| `profile-persistence.ts` (`readSavedProfile`, `persistProfile`) | "Mi perfil" en `localStorage` por usuario | `PUT /auth/me/profile` → devuelve el `AuthUser` actualizado. El perfil llega en `user.profile` del login, del refresh y de `/me`. |
| `onSubmit={(e) => e.preventDefault()}` + `AuthUnavailableAction` (`recover-password-page.tsx`, `request-access-page.tsx`) | Formularios de solo presentación | `POST /auth/password-recovery` (siempre `202`) y `POST /auth/access-requests` (`202`) |
| (no existe) | — | Página nueva `/restablecer-contrasena?token=…` → `POST /auth/password-reset`. El back arma el enlace con `{Auth:FrontendBaseUrl}/restablecer-contrasena?token=`. |

## Diferencias de contrato

| Punto | Frontend hoy | API | Resuelve |
|---|---|---|---|
| `AuthUser.professionalId` | No existe | `string \| null` | Front: sumarlo al tipo |
| `expiresIn` | 3600 (mock) | 900 s (15 min) | Front: renovar antes de que venza o ante el `401` |
| Perfil sin completar | `profile: null` → `ProtectedRoute` manda a `/perfil-usuario` | Igual: `profile` es `null` hasta el primer `PUT /me/profile` | Sin cambios |
| `avatarImage` | Data URL | PNG, JPG, WebP o GIF de hasta 400 000 caracteres | Front: avisar del tamaño antes de enviar (el `400` ya trae `errors.avatarImage`) |
| Errores de login | `401` | `401` "Correo o contraseña incorrectos", `403` "Tu cuenta está desactivada", `429` con `Retry-After` | Front: mostrar `detail`/`title` (ya lo hace `getErrorMessage`) |
| Contraseña nueva | — | De 8 a 128 caracteres | Front: esquema Zod de la página nueva |

## Cambios en el frontend

1. **Estándar del plan 0:**
   - `auth.contract.ts`: `login`, `refresh`, `logout`, `me`, `updateProfile`, `requestPasswordRecovery`, `resetPassword` y `requestAccess`;
   - `auth.http.ts` y `auth.mock.ts` (las cuentas mock se mudan aquí);
   - `auth.api.ts` elige con `env.usesApi("auth")`.
2. **Arranque de la sesión** (`app/providers.tsx` o un `SessionBootstrap` nuevo):
   - Con la API, al montar la app: `refresh()`.
     - Si responde `200`: `setSession(accessToken, user)`.
     - Si responde `401`: sin sesión.
   - Mientras tanto, `ProtectedRoute` muestra un "Cargando…" en lugar de mandar al login. Agregar al store el estado `status: "checking" | "authenticated" | "anonymous"`.
3. **Renovación** (`shared/lib/http.ts`), ante un `401` de cualquier endpoint que no sea `/auth/*`:
   - llama a `refresh()` **una sola vez** aunque fallen varias peticiones a la vez, con una promesa compartida;
   - reintenta la petición original;
   - si el refresh falla, `clearSession()` y lleva a `/login` con `state.from`.

   Opcional: programar el refresh a los `expiresIn − 60` segundos.
4. **Store (`auth-store.ts`):**
   - con la API, sin `sessionStorage` ni `localStorage`;
   - `updateUserProfile` pasa a ser asíncrono: `PUT /me/profile` y luego `set({ user })` con la respuesta;
   - `clearSession` también limpia `queryClient`, que hoy limpia `useLogout`.
5. **`useLogout`:** con la API, llamar a `logout()` antes de limpiar. Si falla, igual se limpia (`onSettled`, como hoy).
6. **Recuperar contraseña:**
   - enviar `{ email }` y mostrar siempre "Si el correo está registrado, te enviamos un enlace", también si el correo no existe;
   - quitar `AuthUnavailableAction`.
7. **Solicitar acceso:**
   - `prepareAccessRequest` ya arma `{ email, fullName, institution, message }`: enviarlo tal cual;
   - mostrar la confirmación con el `202`.
8. **Restablecer contraseña:**
   - página nueva con la ruta pública `/restablecer-contrasena` en `routes.tsx`, que lee `token` de la URL;
   - pide la contraseña dos veces (8 a 128) y envía `POST /auth/password-reset`;
   - con `204`, lleva al login con el aviso "Contraseña actualizada";
   - con `400` "El enlace no es válido o ya expiró", ofrece "Solicitar uno nuevo".
9. **Tipos:** `AuthUser.professionalId: string | null`. El plan 7 lo usa en `use-default-professional.ts`.

## Cambios necesarios en el back

Ninguno para conectar. Pendientes conocidos, que no bloquean:
- proveedor de correo real (el enlace hoy solo sale en el log de desarrollo);
- pantalla y endpoint para revisar las solicitudes de acceso;
- gestión de usuarios.

## Verificación

- **Manual, con `VITE_API_MODULES=auth`:**
  - login con `admin@clinica.com` (contraseña de `Seed:` en desarrollo);
  - recargar: sigue la sesión;
  - esperar 15 min o borrar el token en memoria: la siguiente petición renueva sola;
  - logout y luego recargar: sin sesión;
  - dos pestañas abiertas: las dos siguen funcionando, porque el back tolera dos refresh con el mismo token durante 30 s.
- **Mi perfil:** guardar nombre, cargo y foto; recargar: siguen ahí; con otro navegador, el mismo perfil.
- **Recuperación:** pedir el enlace, copiarlo del log del back, abrirlo, fijar la contraseña e iniciar sesión con la nueva. Usar el mismo enlace otra vez: error de enlace vencido.
- **E2E:** adaptar `auth-ui.spec.ts` y `authentication-interactions.spec.ts` para que corran también con la API (ver el plan 11).

## Terminado

- Sin `sessionStorage` ni `localStorage` en modo API.
- La sesión sobrevive a la recarga.
- El `401` renueva una sola vez.
- Recuperar, restablecer y solicitar acceso funcionan.
- `AuthUser.professionalId` existe.
