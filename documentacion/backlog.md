# Backlog — ClinicApp

Lista de mejoras y funcionalidades pendientes para el sistema de gestión del grupo odontológico. Cada ítem se agrega aquí antes de implementarse; al completarse se marca el estado y se referencia el módulo/commit correspondiente.

Prioridades: **Alta** / **Media** / **Baja**. Estados: **Pendiente** / **En progreso** / **Hecho**.

---

## 1. Módulo de Notificaciones

- **Estado:** Completo
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

- **Estado:** Pendiente
- **Prioridad:** Media
- **Responsable:** Josue Cevallos

Página de configuración para editar los datos de la institución/clínica (nombre, logo, datos de contacto, sedes, horarios de atención, etc.). Pendiente de definir si el grupo odontológico maneja una sola institución o múltiples sedes/sucursales, y qué rol(es) pueden editar este perfil.

## 3. Mejora al historial clínico del paciente

- **Estado:** Pendiente
- **Prioridad:** Alta
- **Responsable:** Jorge Flores

Mejoras sobre el módulo `clinical-history` existente (hoy: registro cronológico por paciente con adjuntos mock, restringido a roles `admin` y `medico`). Pendiente de definir alcance concreto de la mejora (odontograma, plantillas de diagnóstico, subida real de archivos, firma del profesional, exportar a PDF, etc.).

## 4. Gestión integral de pacientes

- **Estado:** Pendiente
- **Prioridad:** Alta
- **Responsable:** Josue Cevallos

Módulo central para registrar y administrar a los pacientes de la clínica odontológica, con datos personales, historial médico, antecedentes, contacto de emergencia, seguros, consentimiento informado y estado de tratamiento.

**Incluye:** alta, edición, baja lógica, búsqueda avanzada, perfiles por paciente, habilitación de notificaciones, seguimiento del tratamiento y documentos asociados.

## 5. Agenda clínica y calendario de citas

- **Estado:** Completado
- **Prioridad:** Alta
- **Responsable:** Jorge Flores

Sistema de agendamiento para citas odontológicas por especialista, tipo de procedimiento, consultorio y duración estimada. Debe permitir bloqueo de horarios, reasignaciones, recordatorios automáticos y control de ausencias.

**Incluye:** calendario semanal/mensual, agenda por profesional, disponibilidad por consultorio, tiempos de tratamiento, citas confirmadas y no-show.

**Avance en frontend (mock):**
- Consultorios como catálogo simple (`Room`, mismo patrón que `Professional`), asignable en el formulario de cita.
- Hora de fin autocompletada según la duración del tratamiento elegido (sigue siendo editable).
- Bloqueos de horario puntuales (profesional y/o consultorio, con motivo), creables/eliminables desde el calendario, con estilo visual propio.
- Validación de disponibilidad extendida: choque de horario por profesional, por consultorio y contra bloqueos activos.
- Nuevo estado "No asistió" (no-show) con su propio botón y color en el calendario.
- Filtro por profesional sobre el calendario de citas.
- Integración simulada con notificaciones: crear una cita genera un aviso de confirmación, cancelarla genera un aviso de cancelación (respeta `notificationsEnabled` del paciente); ver [`arquitectura-frontend.md`](./arquitectura-frontend.md#agenda-de-citas-consultorios-bloqueos-y-no-show).
- Reasignaciones (cambiar profesional/consultorio/fecha/hora) ya cubiertas por el formulario de edición existente, sin pantalla adicional.

**Pendiente:** backend real (nuevos endpoints `GET /rooms`, `GET/POST /schedule-blocks`, `DELETE /schedule-blocks/:id`, y que el backend dispare las notificaciones automáticas); vista de calendario con columnas por profesional (se optó por un filtro simple en esta iteración); recurrencia en bloqueos de horario (hoy solo puntuales); CRUD completo de consultorios (coordinar con el ítem 10 si el negocio lo necesita antes).

## 6. Historia clínica y tratamiento odontológico

- **Estado:** Pendiente
- **Prioridad:** Alta
- **Responsable:** Josue Cevallos

Módulo clínico para registrar la evolución del paciente, diagnósticos, procedimientos realizados, planes de tratamiento, odontograma digital y seguimiento de cada caso.

**Incluye:** odontograma, evolución por visita, diagnóstico, plan de tratamiento, consentimientos, fotos, radiografías, notas profesionales y exportación de documentos.

## 7. Inventario, compras y esterilización

- **Estado:** Completado
- **Prioridad:** Media
- **Responsable:** Jorge Flores

Gestión del stock de insumos, materiales de consumo, equipos y productos específicos de odontología, incluyendo control de vencimientos, compras, niveles mínimos y procesos de esterilización.

**Incluye:** compras/órdenes de compra, control de vencimientos por lote, trazabilidad de consumo clínico (vínculo real con `treatments`), stock crítico, control básico de esterilización (instrumental esterilizable + ciclos) y alertas por faltantes.

**Fuera de este ítem:** gestión de proveedores como entidad propia — se separó como ítem propio, ver [ítem 11](#11-módulo-de-proveedores), ya construido: las órdenes de compra eligen el proveedor desde ese catálogo.

**Avance en frontend (mock):**
- Insumos ganan `kind` (consumible / instrumental esterilizable), con badge en el listado.
- Control de vencimientos **por lote** (`StockLot`): cada entrada crea su propio lote con vencimiento opcional; las salidas se consumen por FEFO (primero en vencer, primero en salir). Tarjeta "Lotes" en el detalle del insumo.
- Órdenes de compra básicas (`PurchaseOrder`: pendiente/recibida/cancelada), con líneas de insumo/cantidad/costo/vencimiento; al recibirlas se generan automáticamente los lotes y movimientos de entrada.
- Ciclos de esterilización básicos (instrumentos incluidos, resultado, profesional responsable).
- **Trazabilidad clínica real:** completar una sesión de un tratamiento ahora descuenta stock de verdad según `Treatment.consumption` (antes era solo un dato descriptivo sin ningún efecto).
- Pestaña de "Stock crítico" (insumos en o bajo el mínimo).
- `/inventario` se reorganizó en pestañas (Insumos / Compras / Esterilización / Stock crítico), sin rutas nuevas.
- Detalle en [`arquitectura-frontend.md`](./arquitectura-frontend.md#inventario-lotes-compras-y-esterilización).

**Pendiente:** backend real (nuevos endpoints de lotes/compras/esterilización, ver `back/backlog.md`). El stock crítico ya se expone como KPI en el dashboard y en `/reportes` (ítem 9).

## 8. Cobranza, pagos y facturación

- **Estado:** Pendiente
- **Prioridad:** Alta
- **Responsable:** Josue Cevallos

Módulo financiero para manejo de pagos por tratamiento, cuotas, seguros, facturación, recordatorios de pagos y control de cartera vencida.

**Incluye:** presupuestos, pagos parciales, cuotas, convenios, seguros, facturación, seguimiento de mora y reportes de ingresos por profesional y procedimiento.

## 9. Reportes, dashboard y administración

- **Estado:** Completado
- **Prioridad:** Media
- **Responsable:** Jorge Flores

Panel de gestión para supervisar indicadores de operación, productividad médica, volumen de pacientes, tratamiento activos, cumplimiento de agenda y salud financiera de la clínica.

**Incluye:** dashboard ejecutivo, KPIs por especialista, productividad, ocupación, no-show, tratamientos activos, pagos pendientes, stock crítico y rendimiento por sede.

**Avance en frontend (mock):**
- Nuevo módulo `modules/reports` (sin datos propios: deriva todo de los demás módulos) con página `/reportes`, solo para `admin`.
- Selector de periodo global (esta semana, este mes, últimos 30 días, este año, personalizado) aplicado a todas las pestañas.
- Pestañas: **Agenda** (citas, completadas, no-show y tasa; gráfico por día; citas por estado; ocupación por consultorio), **Productividad** (por profesional: programadas/completadas/no asistió/canceladas/% cumplimiento + gráfico), **Tratamientos** (citas, asignaciones activas/completadas, sesiones, ingreso estimado), **Inventario** (stock crítico, compras del periodo con total, consumo del periodo).
- Exportación CSV por tabla, generada en el navegador (`shared/lib/csv.ts`).
- El dashboard `/` dejó de ser estático: consume los mismos hooks (pacientes, citas del mes, tratamientos en curso, insumos bajo mínimo, gráfico de citas del mes) y enlaza a `/reportes` para admin.
- Detalle en [`arquitectura-frontend.md`](./arquitectura-frontend.md#reportes-y-dashboard).

**Pendiente / fuera de este avance:** backend real (`GET /reports/*` con agregación SQL, ver `back/backlog.md`); **pagos pendientes e ingresos reales** dependen del ítem 8 (Josue Cevallos) — hoy el ingreso de tratamientos es solo estimado; **rendimiento por sede** depende del ítem 10 (no existe el concepto de sede); productividad por sesiones de tratamiento requiere agregar `professionalId` a `TreatmentAssignment` (gap de modelo, coordinar con el ítem 6); ocupación real contra horario de atención requiere los horarios institucionales del ítem 10.

## 10. Módulo de seguros, convenios y administración institucional

- **Estado:** Pendiente
- **Prioridad:** Media
- **Responsable:** Josue Cevallos

Administración de la parte institucional de la clínica, incluyendo convenios, seguros, sedes, perfiles de usuarios, permisos por rol, configuración de horarios y parámetros operativos.

**Incluye:** perfil de la institución, sedes, horarios de atención, permisos de roles, configuración de servicios, acuerdos con proveedores y logística interna.

## 11. Módulo de Proveedores

- **Estado:** Completado
- **Prioridad:** Media
- **Responsable:** Jorge Flores

Módulo propio para administrar proveedores de insumos/materiales como entidad (no como texto libre): datos de contacto, condiciones comerciales, y relación con los insumos/órdenes de compra que abastecen. Se separó del ítem 7 (Inventario, compras y esterilización) porque merece su propio CRUD en vez de ser un campo suelto.

**Avance en frontend (mock):**
- Entidad `Supplier` (nombre, persona de contacto, teléfono, correo, dirección, notas/condiciones) dentro del módulo `inventory`.
- Nueva pestaña "Proveedores" en `/inventario` con listado, alta, edición y eliminación (bloqueada si el proveedor tiene órdenes de compra asociadas).
- El modal "Nueva orden" de Compras ahora elige el proveedor desde este catálogo (`supplierId`) en vez de texto libre; el detalle de orden muestra el nombre resuelto.
- Detalle en [`arquitectura-frontend.md`](./arquitectura-frontend.md#inventario-lotes-compras-y-esterilización).

**Pendiente:** backend real (`GET/POST /inventory/suppliers`, `PUT/DELETE /inventory/suppliers/:id`); migrar `InventoryItem.supplier` (proveedor habitual del insumo, hoy texto libre) a `supplierId`; coordinar con el ítem 10 (administración institucional, Josue Cevallos) para no duplicar "acuerdos con proveedores" si ese ítem termina cubriendo convenios a nivel institucional.

---

## Notas

- Este backlog es de alto nivel; el detalle de diseño/implementación de cada ítem se discute al momento de tomarlo.
- Ver [`arquitectura-frontend.md`](./arquitectura-frontend.md) para el contrato con el backend y las convenciones de módulo que debe seguir cualquier funcionalidad nueva.
