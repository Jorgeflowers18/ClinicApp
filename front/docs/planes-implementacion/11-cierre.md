# Plan 11 — Cierre: la API por defecto, pruebas reales y limpieza

## Objetivo

Cuando los planes 0 a 10 estén terminados:
- la app usa la API por defecto;
- el modo mock queda como demostración opcional, o se elimina;
- las pruebas E2E corren también contra el back real.

## Mocks que se deshabilitan

Todos, en el `.env` por defecto: `VITE_USE_MOCK_API=false` y `VITE_API_MODULES` sin uso. Hay que decidir qué pasa con el código mock.

| Opción | Qué implica |
|---|---|
| **A. Conservar el modo demostración** (recomendada mientras haya demos comerciales) | Los `*.mock.ts` y `*.mock-data.ts` se quedan. El build de producción **no debe incluirlos**: las implementaciones se cargan con `import()` dinámico dentro de `<módulo>.api.ts`, o con un alias de Vite según `VITE_USE_MOCK_API`. Verificar con `vite build` que ningún `mock-data` quede en `dist/`. |
| **B. Eliminar los mocks** | Borrar los `*.mock*.ts`, `shared/lib/mock.ts`, `clinical-history.mock-storage.ts` y `clinical-history.mock-migration.ts`, `profile-persistence.ts` y el código de `localStorage` de `institution`. Las pruebas E2E pasan a necesitar el back. |

## Cambios en el frontend

1. **`.env.example`:** `VITE_USE_MOCK_API=false` y `VITE_API_BASE_URL=http://localhost:5000/api`. En producción, la URL pública detrás de nginx.
2. **Sin restos del modo mock en modo API.** Buscar y revisar:

   ```
   rg "mockDelay|mock-data|mockPatients|localStorage|sessionStorage|indexedDB" src
   ```

   Lo único que debe quedar es:
   - las preferencias por navegador: vista del archivo clínico, alertas leídas y tema;
   - los archivos mock, si se elige la opción A.
3. **Pruebas E2E con el back real:**
   - un proyecto de Playwright `api`, con `CLINIC_TEST_URL` y el back levantado contra una base de pruebas;
   - el back ya tiene `clinicapp_test` para xUnit. Para E2E conviene una base aparte, `clinicapp_e2e`, que se recrea antes de cada corrida con las semillas de desarrollo.
   - Las pruebas que dependen de datos fijos del mock (nombres de pacientes, ids `pat_1`) se adaptan para crear sus datos por la API o por la UI.
4. **Documentación:**
   - `documentacion/arquitectura-frontend.md`: el estándar de recurso, el conmutador, la sesión con refresh y la sección "Código solo-mock" actualizada;
   - `front/README.md`: cómo levantar con el back.
5. **Borrar `front/docs/planes-implementacion/`** cuando no quede ningún plan.

## Cambios necesarios en el back

- `Cors:AllowedOrigins` con el origen de producción del frontend.
- `Auth:FrontendBaseUrl` con la URL pública, porque el enlace de restablecer contraseña la usa.

## Verificación

- `npm run build` con `VITE_USE_MOCK_API=false`: sin `mock-data` en `dist/` (opción A) o sin archivos mock (opción B).
- **Recorrido completo con los tres roles:**
  1. login;
  2. paciente nuevo;
  3. cita;
  4. historia y atención con tratamiento;
  5. pago;
  6. notificación;
  7. reporte;
  8. logout.
- **E2E:** la suite `api` pasa contra el back.

## Terminado

- La app funciona contra la API por defecto.
- La decisión A/B está aplicada.
- Las pruebas E2E reales pasan.
- La documentación está actualizada y esta carpeta borrada.
