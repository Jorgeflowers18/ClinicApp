# Plan — Tratamientos

- **Sección:** Tratamientos (`/tratamientos`) y tratamientos del paciente en la historia clínica
- **Módulos:** `front/src/modules/clinical-history`, `front/src/modules/treatments`
- **Estado:** Pendiente
- **Responsable:** Jorge Flores

## Objetivo

Un flujo sencillo, pensado para un consultorio pequeño: cuando el doctor registra la atención, **registra los tratamientos que le hizo al paciente**, cada uno con su costo. Cada vez que se realiza un tratamiento adicional se registra igual, aunque el paciente no haya terminado de pagar los anteriores. Los pagos se revisarán a futuro.

Reemplaza el flujo actual de asignaciones con sesiones, estados "Propuesto / Aprobado / Realizado" y asignación al cerrar la visita.

## 1. `/tratamientos` es el catálogo

`/tratamientos` es la lista de todos los tratamientos posibles de la clínica: nombre, categoría, duración, **precio** e insumos que consume. Se crean y editan ahí. No cambia.

Lo único que cambia es su página de detalle (`pages/treatment-detail-page.tsx`):
- La tarjeta **"Pacientes con este tratamiento"** pasa a ser **"Pacientes que recibieron este tratamiento"**: paciente, fecha, pieza o zona y enlace a la atención. Solo lectura.
- Se quita el botón **"+ Sesión"**: los tratamientos se registran únicamente desde una atención, para que todo quede en el historial del paciente.
- El "Resumen financiero" se mantiene sin cambios.

## 2. Registrar tratamientos en la atención

Sección **"Tratamientos realizados"** del formulario "Registrar atención" ([consultas.md](./consultas.md)):
- Se agregan uno o varios tratamientos **del catálogo** (solo los activos), cada uno con:
  - pieza o zona (opcional);
  - **costo**: el precio del catálogo, que se muestra y queda guardado en la atención.
- Se muestra el total de la atención.
- No hay sesiones ni estados que elegir: lo registrado es lo que se hizo.
- Atajo: los tratamientos **propuestos** de la historia (ver punto 3) aparecen primero para agregarlos con un clic; al registrarse salen de los propuestos.
- No se valida deuda: se puede registrar aunque haya saldos pendientes.

**Al guardar la atención**, por cada tratamiento registrado:
- se crea el registro del tratamiento del paciente, ya realizado (reutiliza `TreatmentAssignment` con una sesión completada);
- se descuentan los insumos del tratamiento en Inventario, como hoy;
- aparece en Finanzas del paciente con su costo;
- queda en la atención con tratamiento, pieza y costo, sin poder modificarse.

## 3. Tratamientos propuestos (pestaña de la historia, editable)

- La pestaña "Plan de tratamiento" se mantiene como lista sencilla de **tratamientos propuestos** al paciente: tratamiento del catálogo, pieza o zona y precio, con su total estimado.
- Se agregan y quitan con "Guardar cambios" de la historia.
- Desaparecen los estados, las sesiones y la columna de seguimiento.
- A futuro se le suman la fase y la fecha prevista de `backlog_HC.md` (Datos de Plan de Tratamiento por Fases).

## 4. Pestaña "Tratamientos" de la historia (solo lectura)

Lista de todos los tratamientos realizados al paciente, del más reciente al más antiguo: fecha, tratamiento, pieza o zona, costo, profesional y enlace a la atención. Reemplaza la tarjeta "Tratamientos asignados al paciente" con su progreso por sesiones.

## 5. Cambios en el módulo `treatments`

- `TreatmentAssignment`: `sourceVisitId` pasa a `sourceEncounterId`; `sourcePlanItemId` se reemplaza por una clave por atención y posición, para que un reintento no duplique el registro.
- `createAssignment` crea el registro con una sesión y lo marca completado en el mismo paso; deja de hacer falta llamar a `advanceSession` desde la historia.
- Las asignaciones antiguas con varias sesiones (datos de ejemplo) se siguen mostrando con su progreso; no se convierten.
- Hooks: `usePatientAssignments` alimenta la pestaña "Tratamientos" y el resumen del paciente.

## 6. Efectos en otros módulos

- **Inventario:** descuento de insumos al registrar el tratamiento (sin cambios en `inventory`).
- **Finanzas:** cada tratamiento registrado suma su valor a la cartera del paciente (la cartera ya se calcula por llamada). Los pagos y abonos se revisarán a futuro (ítem 8 de `documentacion/backlog.md`).
- **Reportes:** se recalculan solos.

## 7. Validación

- En la atención se registran dos tratamientos del catálogo; el total coincide con sus precios.
- Al guardar, ambos aparecen en la pestaña "Tratamientos" de la historia, en Finanzas del paciente y en "Pacientes que recibieron este tratamiento" de `/tratamientos/:id`.
- Inventario descuenta los insumos de cada tratamiento.
- Un tratamiento propuesto agregado a la atención sale de la lista de propuestos.
- Se puede registrar un tratamiento nuevo aunque el paciente tenga saldos pendientes.
- El detalle del catálogo ya no tiene el botón "+ Sesión".

## Puntos por confirmar

- **Costo editable:** hoy el costo es el precio del catálogo. ¿El doctor necesita cambiarlo en la atención (por ejemplo, un descuento)? Afecta a Finanzas, que hoy calcula con el precio del catálogo; se puede revisar junto con los pagos.
