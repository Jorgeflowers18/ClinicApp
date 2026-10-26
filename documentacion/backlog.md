# Backlog — ClinicApp

Lista de mejoras y funcionalidades pendientes para el sistema de gestión del grupo odontológico. Cada ítem se agrega aquí antes de implementarse. Al completarse se elimina del backlog: su detalle queda en [`arquitectura-frontend.md`](./arquitectura-frontend.md), los pendientes de backend en [`back/backlog.md`](../back/backlog.md) y la versión anterior de este archivo en el historial de git.

Prioridades: **Alta** / **Media** / **Baja**. Estados: **Pendiente** / **En progreso**.

Los números de ítem se conservan aunque se eliminen los completados, para no romper las referencias en otros documentos.

---

## 2. Página de modificación de Perfil de la institución

- **Estado:** Pendiente
- **Prioridad:** Media
- **Responsable:** Josue Cevallos

Página de configuración para editar los datos de la institución/clínica (nombre, logo, datos de contacto, sedes, horarios de atención, etc.). Pendiente de definir si el grupo odontológico maneja una sola institución o múltiples sedes/sucursales, y qué rol(es) pueden editar este perfil.

## 4. Gestión integral de pacientes

- **Estado:** Pendiente
- **Prioridad:** Alta
- **Responsable:** Josue Cevallos

Módulo central para registrar y administrar a los pacientes de la clínica odontológica, con datos personales, historial médico, antecedentes, contacto de emergencia, seguros, consentimiento informado y estado de tratamiento.

**Incluye:** alta, edición, baja lógica, búsqueda avanzada, perfiles por paciente, habilitación de notificaciones, seguimiento del tratamiento y documentos asociados.

## 8. Cobranza, pagos y facturación

- **Estado:** Pendiente
- **Prioridad:** Alta
- **Responsable:** Josue Cevallos

Módulo financiero para manejo de pagos por tratamiento, cuotas, seguros, facturación, recordatorios de pagos y control de cartera vencida.

**Incluye:** presupuestos, pagos parciales, cuotas, convenios, seguros, facturación, seguimiento de mora y reportes de ingresos por profesional y procedimiento.

## 12. Mejoras de la historia clínica según el formulario del consultorio

- **Estado:** Pendiente
- **Prioridad:** Alta
- **Responsable:** Jorge Flores

Realización completa de [`backlog_HC.md`](./backlog_HC.md): implementar en la página de historia clínica los elementos del formulario en papel "Historia Clínica Odontológica Integral" que usa el consultorio, clasificados entre Historial Clínico y Consulta, y quitar las partes del funcionamiento actual que dejen de aplicar.

---

## Notas

- Este backlog es de alto nivel; el detalle de diseño/implementación de cada ítem se discute al momento de tomarlo.
- Ver [`arquitectura-frontend.md`](./arquitectura-frontend.md) para el contrato con el backend y las convenciones de módulo que debe seguir cualquier funcionalidad nueva.
