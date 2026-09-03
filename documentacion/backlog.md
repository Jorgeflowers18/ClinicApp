# Backlog — ClinicApp

Lista de mejoras y funcionalidades pendientes para el sistema de gestión del grupo odontológico. Cada ítem se agrega aquí antes de implementarse; al completarse se marca el estado y se referencia el módulo/commit correspondiente.

Prioridades: **Alta** / **Media** / **Baja**. Estados: **Pendiente** / **En progreso** / **Hecho**.

---

## 1. Módulo de Notificaciones

- **Estado:** En progreso
- **Prioridad:** —
- **Responsable:** Jorge Flores

Notificaciones para pacientes y/o personal de la clínica (recordatorios de citas, cambios de estado, alertas de stock mínimo de inventario, etc.).

**Avance en frontend (mock):**
- Módulo `modules/notifications` creado (tipos, mock data, API con patrón mock/real, hooks de React Query).
- Toggle "Notificaciones habilitadas" en el alta/edición de paciente (`patients`), por defecto activado.
- Indicador de "Cliente notificado" (sí/no + fecha) en el modal de detalle de cita (`appointments`).
- Página de reporte `/notificaciones` con tabla filtrable por nombre, identificación y rango de fechas. Restringida a roles `admin` y `recepcion`.
- Detalle en [`arquitectura-frontend.md`](./arquitectura-frontend.md#notificaciones-a-pacientes).

**Pendiente:** backend real (`GET /notifications`, persistencia de `notificationsEnabled` en `Patient`), definir disparadores automáticos de envío, canal real (hoy el modelo soporta email/SMS pero no hay integración), y si aplica a nivel de grupo (múltiples sedes).

## 2. Página de modificación de Perfil de la institución

- **Estado:** Pendiente
- **Prioridad:** —
- **Responsable:** —

Página de configuración para editar los datos de la institución/clínica (nombre, logo, datos de contacto, sedes, horarios de atención, etc.). Pendiente de definir si el grupo odontológico maneja una sola institución o múltiples sedes/sucursales, y qué rol(es) pueden editar este perfil.

## 3. Mejora al historial clínico del paciente

- **Estado:** Pendiente
- **Prioridad:** —
- **Responsable:** —

Mejoras sobre el módulo `clinical-history` existente (hoy: registro cronológico por paciente con adjuntos mock, restringido a roles `admin` y `medico`). Pendiente de definir alcance concreto de la mejora (odontograma, plantillas de diagnóstico, subida real de archivos, firma del profesional, exportar a PDF, etc.).

---

## Notas

- Este backlog es de alto nivel; el detalle de diseño/implementación de cada ítem se discute al momento de tomarlo.
- Ver [`arquitectura-frontend.md`](./arquitectura-frontend.md) para el contrato con el backend y las convenciones de módulo que debe seguir cualquier funcionalidad nueva.
