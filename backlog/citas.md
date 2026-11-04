# Plan — Citas

- **Sección:** Agenda / citas (`/citas`) y pestaña "Citas" de la historia clínica
- **Módulos:** `front/src/modules/appointments`, `front/src/modules/clinical-history`
- **Estado:** Implementado (fase 5)
- **Responsable:** Jorge Flores

## Objetivo

Desde una cita se registra directamente la atención del paciente, y la historia clínica acumula las citas del paciente con su estado y observaciones.

## 1. Acceso desde la cita

- El botón **"Abrir historia clínica"** del detalle de la cita (`components/appointment-detail-dialog.tsx`) se mantiene: solo para admin y médico, en citas programadas, confirmadas o completadas.
- Navega a `/historial-clinico/paciente/:patientId?cita=:id` como hoy, pero en lugar del diálogo "Nueva visita" abre el formulario **"Registrar atención"** con la cita, su fecha y su profesional precargados (ver [consultas.md](./consultas.md)).
- Si la cita ya tiene una atención registrada, abre la pestaña Atenciones en esa atención.
- Desaparece el aviso "Hay una visita en borrador" (ya no hay borradores).

## 2. Cita completada al registrar la atención

- Al guardar una atención con cita vinculada, la cita pasa a **"Completada"** si estaba programada o confirmada (como hoy al cerrar la visita).
- Si estaba cancelada o marcada como no asistida, no se cambia y se avisa.
- Si falla la actualización de la cita, la atención queda guardada y se muestra un aviso (no fatal).
- Una cita solo puede vincularse a una atención (`hooks/use-patient-appointment-options.ts`, adaptado de visitas a atenciones).

## 3. Pestaña "Citas" en la historia clínica

- Lista de las citas del paciente, de la más reciente a la más antigua: fecha y hora, profesional, tratamiento, consultorio, estado y **observaciones** (`notes` de la cita).
- Si la cita tiene atención registrada: enlace "Ver atención".
- Si la cita no tiene atención y es programada, confirmada o completada: botón "Registrar atención".
- Solo lectura: las citas se editan desde la Agenda.
- Hoy no existe un listado de citas por paciente: se agrega `appointmentsApi.listByPatient` con su hook (Mock filtra la lista actual; Real `GET /appointments?patientId=`, que se registra en `back/backlog.md`).

## 4. Validación

- Desde una cita, "Abrir historia clínica" abre "Registrar atención" con la cita precargada.
- Al guardar, la cita queda "Completada" en la Agenda.
- Una cita con atención no aparece como opción en otra atención y abre su atención existente.
- La pestaña Citas muestra todas las citas del paciente con sus observaciones.
- Recepción no ve el botón "Abrir historia clínica".
