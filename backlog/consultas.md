# Plan — Consultas (atenciones)

- **Sección:** Historial clínico → registro de atenciones
- **Módulo:** `front/src/modules/clinical-history`
- **Estado:** Implementado (fase 3)
- **Responsable:** Jorge Flores

## Objetivo

El doctor registra la atención que le dio al paciente en un solo paso, con confirmación. La atención queda en el historial del paciente y **no se puede editar** después, para evitar la manipulación de la información. Reemplaza a "Nueva visita" + "Cerrar visita".

## 1. Modelo: atención (`ClinicalEncounter`)

| Campo | Obligatorio | Origen hoy |
|---|---|---|
| `id`, `patientId`, `createdAt` | sistema | — |
| `date` (fecha de la atención) | sí; hoy o anterior, nunca futura | fecha de la visita |
| `professionalId` | sí | profesional de la visita |
| `appointmentId` | no | cita vinculada |
| `reason` (motivo) | sí, mín. 3 caracteres | igual |
| `diagnosis` (diagnóstico) | sí, mín. 3 caracteres | igual |
| `procedures` (procedimientos) | no | igual |
| `evolution` (evolución / indicaciones) | no | igual |
| `notes` (observaciones) | no | notas profesionales |
| `nextVisit` (próximo control) | no; ≥ fecha | igual |
| `performedTreatments` | no | tratamientos realizados: tratamiento, pieza y costo (ver [tratamientos.md](./tratamientos.md)) |
| `chartSnapshot` | sistema | copia automática del odontograma de la historia al guardar |
| `addenda` | sistema | notas aclaratorias agregadas después (ver punto 6) |

A futuro se suman los campos de `backlog_HC.md` marcados **Pertenece a: Consulta** (signos vitales, examen extraoral e intraoral, dolor, etc.).

## 2. Formulario "Registrar atención"

- Se abre con el botón **"Registrar atención"** del encabezado, en un panel lateral o diálogo amplio, sin pasos previos.
- **Valores por defecto:** fecha de hoy, profesional del usuario logueado y, si se llegó con `?cita=`, la cita con su fecha y profesional (ver [citas.md](./citas.md)).
- Campos: los de la tabla anterior más la sección **"Tratamientos realizados"** (ver tratamientos.md).
- Se reutilizan los campos de `components/consultation-tab.tsx` (React Hook Form + Zod, errores en línea).
- **Cambios sin guardar en la historia:** el formulario lo avisa y, al confirmar la atención, primero se guardan los cambios de la historia, para que la copia del odontograma refleje lo que se ve en pantalla.

## 3. Confirmación de guardado

Al pulsar "Guardar atención", con el formulario válido, se abre un diálogo de confirmación:
- "La atención no se podrá modificar después de guardarla."
- Resumen: N tratamientos realizados y su total; "La cita vinculada pasará a «Completada»" (si aplica); "También se guardarán los cambios pendientes de la historia" (si aplica).
- Botones "Volver" y "Confirmar y guardar".

## 4. Secuencia de guardado

Coordinada en el frontend (como el cierre actual de la visita), en este orden:
1. Guarda los cambios pendientes de la historia (si los hay).
2. Registra los tratamientos realizados (crea el registro de cada tratamiento y descuenta insumos; ver tratamientos.md).
3. Crea la atención con la copia del odontograma y los tratamientos realizados.
4. Actualiza la historia: los tratamientos propuestos que se registraron salen de la lista de propuestos.
5. Pasa la cita a "Completada" (no fatal; ver citas.md).

El id de la atención se genera antes del paso 2 para que un reintento no duplique asignaciones. Con backend real, todo esto debería ser una sola transacción de `POST /clinical-history/patients/:patientId/encounters` (se registra en `back/backlog.md`).

## 5. Historial de atenciones (pestaña "Atenciones")

- Tarjetas de la más reciente a la más antigua: fecha, profesional, cita, motivo, diagnóstico, procedimientos, evolución, observaciones, próximo control y tratamientos realizados.
- Botones por atención: **"Ver odontograma"** (abre la copia de ese momento en modo solo lectura) y **"Imprimir / Guardar PDF"** de la atención.
- Sin botones de editar ni eliminar.
- Con `?atencion=:id` se abre la pestaña y se resalta esa atención.

## 6. Notas aclaratorias

Para corregir o completar una atención ya guardada sin modificar lo original:
- Botón **"Agregar nota aclaratoria"** en cada atención.
- La nota guarda fecha, autor (usuario logueado) y texto (obligatorio, mínimo 10 caracteres).
- Antes de guardarla se pide confirmación: "La nota no se podrá modificar después".
- Se muestra debajo de la atención, marcada como nota aclaratoria, en orden cronológico; tampoco se edita ni se elimina.
- Se incluye en el PDF de la atención.
- API: `addEncounterNote(encounterId, text)` → Real `POST /clinical-history/encounters/:encounterId/notes`.

## 7. Evolución periodontal

El gráfico de evolución se arma con las copias del odontograma de cada atención más el estado actual de la historia (hoy se arma con las visitas cerradas más el borrador). `lib/chart-indicators.ts` no cambia; solo la fuente de datos.

## 8. Validación

- "Registrar atención" abre el formulario con fecha y profesional precargados.
- Sin motivo o diagnóstico no se puede guardar y los errores salen en línea.
- Una fecha futura muestra error; una fecha pasada se acepta.
- La confirmación muestra el resumen correcto; "Volver" no guarda nada.
- Tras guardar, la atención aparece primera en el historial, sin opción de editar.
- "Ver odontograma" muestra el estado de ese momento aunque después se modifique la historia.
- Con cambios sin guardar en la historia, la atención los guarda primero y su copia los incluye.
- La evolución periodontal suma un punto por atención.
- Una nota aclaratoria se agrega con confirmación, aparece bajo su atención y no se puede editar.
