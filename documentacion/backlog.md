# Backlog — ClinicApp

Lista de mejoras y funcionalidades pendientes para el sistema de gestión del grupo odontológico. Cada ítem se agrega aquí antes de implementarse; al completarse se marca el estado y se referencia el módulo/commit correspondiente.

Prioridades: **Alta** / **Media** / **Baja**. Estados: **Pendiente** / **En progreso** / **Hecho**.

---

## 1. Módulo de Notificaciones

- **Estado:** En progreso
- **Prioridad:** Alta
- **Responsable:** Jorge Flores

Notificaciones para pacientes y/o personal de la clínica (recordatorios de citas, cambios de estado, alertas de stock mínimo de inventario, etc.).

**Avance en frontend (mock):**
- Módulo `modules/notifications` creado (tipos, mock data, API con patrón mock/real, hooks de React Query).
- Toggle "Notificaciones habilitadas" en el alta/edición de paciente (`patients`), por defecto activado.
- Indicador de "Cliente notificado" (sí/no + fecha) en el modal de detalle de cita (`appointments`).
- Página de reporte `/notificaciones` con tabla filtrable por nombre, identificación y rango de fechas. Restringida a roles `admin` y `recepcion`.
- Editor de la plantilla predeterminada de notificación (mensaje único con variables insertables tipo `[nombre del cliente]`, `[fecha de la cita]`, etc., con vista previa), en la misma página `/notificaciones`.
- Detalle en [`arquitectura-frontend.md`](./arquitectura-frontend.md#notificaciones-a-pacientes).

**Pendiente:** backend real (`GET/PUT /notifications/template`, `GET /notifications`, persistencia de `notificationsEnabled` en `Patient`), definir disparadores automáticos de envío, canal real (hoy el modelo soporta email/SMS pero no hay integración), si la plantilla debe variar por tipo de notificación (recordatorio/confirmación/cancelación) en vez de ser una sola, y si aplica a nivel de grupo (múltiples sedes).

## 2. Página de modificación de Perfil de la institución

- **Estado:** Completado
- **Prioridad:** Media
- **Responsable:** Josue Cevallos

Página de configuración para editar los datos de la institución/clínica (nombre, logo, datos de contacto, sedes, horarios de atención, etc.). Con la implementación actual, la clínica ya cuenta con edición y guardado persistente del perfil institucional, identidad visual con logo, creación de sedes y configuración operativa del usuario.

**Avance realizado:**
- perfil institucional con edición y guardado persistente
- identidad visual con carga de logo
- creación manual de sedes desde la interfaz
- bloqueo de acceso hasta completar perfil del usuario
- perfil de usuario editable desde el menú del usuario
- soporte de modo claro y oscuro

## 3. Mejora al historial clínico del paciente

- **Estado:** Pendiente
- **Prioridad:** Alta
- **Responsable:** Jorge Flores

Mejoras sobre el módulo `clinical-history` existente (hoy: registro cronológico por paciente con adjuntos mock, restringido a roles `admin` y `medico`). Pendiente de definir alcance concreto de la mejora (odontograma, plantillas de diagnóstico, subida real de archivos, firma del profesional, exportar a PDF, etc.).

## 4. Gestión integral de pacientes

- **Estado:** Completado
- **Prioridad:** Alta
- **Responsable:** Josue Cevallos

Módulo central para registrar y administrar a los pacientes de la clínica odontológica, con datos personales, historial médico, antecedentes, contacto de emergencia, seguros, consentimiento informado y estado de tratamiento.

**Incluye:** alta, edición, baja lógica, búsqueda avanzada, perfiles por paciente, habilitación de notificaciones, seguimiento del tratamiento y documentos asociados.

**Avance realizado:**
- administración completa de pacientes en frontend
- registro de datos personales y contacto de emergencia
- soporte de notificaciones habilitadas por paciente
- flujo de edición y consulta del perfil del paciente
- integración con el módulo de citas y notificaciones

## 5. Agenda clínica y calendario de citas

- **Estado:** Pendiente
- **Prioridad:** Alta
- **Responsable:** Jorge Flores

Sistema de agendamiento para citas odontológicas por especialista, tipo de procedimiento, consultorio y duración estimada. Debe permitir bloqueo de horarios, reasignaciones, recordatorios automáticos y control de ausencias.

**Incluye:** calendario semanal/mensual, agenda por profesional, disponibilidad por consultorio, tiempos de tratamiento, citas confirmadas y no-show.

## 6. Historia clínica y tratamiento odontológico

- **Estado:** Pendiente
- **Prioridad:** Alta
- **Responsable:** Josue Cevallos

Módulo clínico para registrar la evolución del paciente, diagnósticos, procedimientos realizados, planes de tratamiento, odontograma digital y seguimiento de cada caso.

**Incluye:** odontograma, periodontograma, evolución por visita, diagnóstico, plan de tratamiento, consentimientos, fotos, radiografías, notas profesionales y exportación de documentos.

**Detalle adicional:** periodontograma con registro de bolsas periodontales, recesiones, sangrado, movilidad, furcaciones, placa y cálculo, además de seguimiento de salud periodontal por visita.

## 7. Inventario, compras y esterilización

- **Estado:** Pendiente
- **Prioridad:** Media
- **Responsable:** Jorge Flores

Gestión del stock de insumos, materiales de consumo, equipos y productos específicos de odontología, incluyendo control de vencimientos, compras, niveles mínimos y procesos de esterilización.

**Incluye:** proveedores, compras, ordenes de compra, stock crítico, trazabilidad de materiales, control de esterilización y alertas por faltantes.

## 8. Cobranza, pagos y facturación

- **Estado:** Pendiente
- **Prioridad:** Alta
- **Responsable:** Josue Cevallos

Módulo financiero para manejo de pagos por tratamiento, cuotas, seguros, facturación, recordatorios de pagos y control de cartera vencida.

**Incluye:** presupuestos, pagos parciales, cuotas, convenios, seguros, facturación, seguimiento de mora y reportes de ingresos por profesional y procedimiento.

## 9. Reportes, dashboard y administración

- **Estado:** Pendiente
- **Prioridad:** Media
- **Responsable:** Jorge Flores

Panel de gestión para supervisar indicadores de operación, productividad médica, volumen de pacientes, tratamiento activos, cumplimiento de agenda y salud financiera de la clínica.

**Incluye:** dashboard ejecutivo, KPIs por especialista, productividad, ocupación, no-show, tratamientos activos, pagos pendientes, stock crítico y rendimiento por sede.

## 10. Módulo de seguros, convenios y administración institucional

- **Estado:** Completado
- **Prioridad:** Media
- **Responsable:** Josue Cevallos

Administración de la parte institucional de la clínica, incluyendo convenios, seguros, sedes, perfiles de usuarios, permisos por rol, configuración de horarios y parámetros operativos.

**Incluye:** perfil de la institución, sedes, horarios de atención, permisos de roles, configuración de servicios, acuerdos con proveedores y logística interna.

**Avance realizado hoy:**
- perfil institucional con edición y guardado persistente
- identidad visual con carga de logo
- creación manual de sedes desde la interfaz
- primera vez: bloqueo de acceso hasta completar perfil del usuario
- perfil de usuario editable más adelante desde el menú del usuario
- soporte de modo claro y oscuro

---

## Notas

- Este backlog es de alto nivel; el detalle de diseño/implementación de cada ítem se discute al momento de tomarlo.
- Ver [`arquitectura-frontend.md`](./arquitectura-frontend.md) para el contrato con el backend y las convenciones de módulo que debe seguir cualquier funcionalidad nueva.
