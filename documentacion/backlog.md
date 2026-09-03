# Backlog — ClinicApp

Lista de mejoras y funcionalidades pendientes para el sistema de gestión del grupo odontológico. Cada ítem se agrega aquí antes de implementarse; al completarse se marca el estado y se referencia el módulo/commit correspondiente.

Prioridades: **Alta** / **Media** / **Baja**. Estados: **Pendiente** / **En progreso** / **Hecho**.

---

## 1. Módulo de Notificaciones

- **Estado:** Pendiente
- **Prioridad:** —

Notificaciones para pacientes y/o personal de la clínica (recordatorios de citas, cambios de estado, alertas de stock mínimo de inventario, etc.). Pendiente de definir: canal (email, SMS, in-app, push), disparadores (qué eventos generan notificación) y si aplica a un solo consultorio o a nivel de grupo (múltiples sedes).

## 2. Página de modificación de Perfil de la institución

- **Estado:** Pendiente
- **Prioridad:** —

Página de configuración para editar los datos de la institución/clínica (nombre, logo, datos de contacto, sedes, horarios de atención, etc.). Pendiente de definir si el grupo odontológico maneja una sola institución o múltiples sedes/sucursales, y qué rol(es) pueden editar este perfil.

## 3. Mejora al historial clínico del paciente

- **Estado:** Pendiente
- **Prioridad:** —

Mejoras sobre el módulo `clinical-history` existente (hoy: registro cronológico por paciente con adjuntos mock, restringido a roles `admin` y `medico`). Pendiente de definir alcance concreto de la mejora (odontograma, plantillas de diagnóstico, subida real de archivos, firma del profesional, exportar a PDF, etc.).

---

## Notas

- Este backlog es de alto nivel; el detalle de diseño/implementación de cada ítem se discute al momento de tomarlo.
- Ver [`arquitectura-frontend.md`](./arquitectura-frontend.md) para el contrato con el backend y las convenciones de módulo que debe seguir cualquier funcionalidad nueva.
