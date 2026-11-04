# Plan — Pacientes

- **Sección:** Pacientes (`/pacientes/:id`, pestaña "Historial clínico")
- **Módulos:** `front/src/modules/patients`, `front/src/modules/clinical-history`
- **Estado:** Pendiente
- **Responsable:** Jorge Flores

## Objetivo

Adaptar el resumen clínico de la ficha del paciente al nuevo modelo de historia editable con atenciones.

## 1. Resumen clínico (`clinical-history/components/patient-clinical-summary.tsx`)

| Hoy | Después |
|---|---|
| Visitas cerradas | **Atenciones registradas** |
| Última visita (fecha, profesional, diagnóstico) | **Última atención** (fecha, profesional, diagnóstico) |
| Próximo control (de la última visita cerrada) | Próximo control (de la última atención) |
| Visita en borrador | **Tratamientos realizados** (cantidad registrada en atenciones) |

- Se mantiene la etiqueta "Dato clínico sensible · acceso restringido por rol".
- Se mantiene el botón "Abrir historia clínica".
- `pages/patient-detail-page.tsx` no cambia.

## 2. Validación

- La ficha de un paciente con atenciones muestra el conteo, la última atención y el próximo control correctos.
- Un paciente sin atenciones muestra "Sin atenciones" y "Por definir".
- "Abrir historia clínica" abre la historia editable.
