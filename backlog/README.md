# Backlog

Todo lo pendiente a nivel de producto, en un solo lugar:

| Archivo | Qué tiene |
|---|---|
| [`backlog.md`](./backlog.md) | Funcionalidades pendientes de la app, con prioridad, estado y responsable. |
| [`backlog_HC.md`](./backlog_HC.md) | Lo que falta de la historia clínica según el formulario en papel del consultorio, y lo que hay que confirmar con la clínica. |

Cada ítem se borra cuando queda implementado: su detalle pasa a [`documentacion/arquitectura-frontend.md`](../documentacion/arquitectura-frontend.md) y la versión anterior queda en el historial de git.

## Dónde están los demás pendientes

- **Backend, por módulo:** [`back/backlog-desgloce.md`](../back/backlog-desgloce.md) (orden y responsable) y [`back/backlog.md`](../back/backlog.md) (detalle por endpoint).
- **Lo que falta conectar entre el front y la API:** `front/docs/planes-implementacion/12-campos-sin-conectar.md`.

## Planes de implementación de pantallas

Cuando se diseña una pantalla nueva, su plan (qué cambia, cómo se implementa y cómo se valida) va en esta carpeta, un `.md` por sección, y se borra al terminar. Hoy no hay ninguno en curso.

Planes completados (detalle en `arquitectura-frontend.md` § Historia clínica odontológica):
- **Ítem 13, simplificación de la historia clínica:** historia editable, atenciones inmutables con notas aclaratorias, tratamientos realizados con costo y exportación.
- **Ítem 12, historia clínica según el formulario del consultorio:** antecedentes y alertas, "Registrar atención" por pasos, plan por fases, exámenes solicitados e índices periodontales.
