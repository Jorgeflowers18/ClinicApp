# Backlog — ClinicApp

Mejoras y funcionalidades pendientes del sistema del grupo odontológico, a nivel de producto. Cada ítem se agrega aquí antes de implementarse y se elimina al completarse: su detalle queda en [`arquitectura-frontend.md`](../documentacion/arquitectura-frontend.md), los pendientes de backend en [`back/backlog-desgloce.md`](../back/backlog-desgloce.md) y la versión anterior de este archivo en el historial de git.

Prioridades: **Alta** / **Media** / **Baja**. Estados: **Pendiente** / **En progreso** / **Por decidir**.

Los números de ítem se conservan aunque se eliminen los completados, para no romper las referencias en otros documentos.

**Completados y retirados (revisión del 2026-11-24):**
- **2. Perfil de la institución:** página `/perfil-institucion` con nombre, subtítulo, logo, datos legales y de contacto, y sedes con sus horarios.
- **4. Gestión integral de pacientes:** alta, edición, baja lógica y reactivación, búsqueda en el servidor, ficha con citas, tratamientos, finanzas y documentos, contacto de emergencia, seguro, consentimiento y notificaciones.

---

## 8. Cobranza, pagos y facturación (etapa B)

- **Estado:** Por decidir
- **Prioridad:** Alta
- **Responsable:** Josue Cevallos

**Ya está hecho (etapa A):**
- el precio de cada tratamiento realizado;
- registrar y anular pagos;
- la cartera con lo pagado y lo pendiente;
- el resumen por paciente y por tratamiento.

**Lo que falta** depende del tipo de financiamiento que use la clínica. Hasta definirlo, el front no muestra vencimientos, mora, seguros ni factura:
- **Cuotas y convenios:** plan de pagos con fechas; con ellas, el total vencido, el próximo vencimiento y los días de mora.
- **Seguros:** cobertura de la aseguradora, copago y reclamos.
- **Facturación electrónica (SRI):** proveedor o firma electrónica, o integración con el sistema que ya use la clínica.
- **Presupuestos:** cotización antes de empezar un tratamiento.
- **Recordatorios de pago y seguimiento de mora.**
- **Ingresos reales en los reportes:** por profesional y por procedimiento, desde los pagos. Hoy el reporte de tratamientos muestra un ingreso estimado (precio × realizados).

**Para empezar, hay que preguntarle a la clínica:**
1. ¿Los pacientes pagan en cuotas o con un plan de pagos? ¿Quién fija las fechas y cada cuánto?
2. ¿Trabajan con aseguradoras? ¿La clínica le cobra a la aseguradora o el paciente paga y luego reclama?
3. ¿Ya facturan con otro sistema o quieren hacerlo desde ClinicApp?

## 14. Mensajería por WhatsApp

- **Estado:** Pendiente
- **Prioridad:** Media
- **Responsable:** por asignar

Decidido el 2026-11-23: el canal de mensajes será la **API de WhatsApp**, para contactar a pacientes (confirmaciones y recordatorios de citas) y a proveedores. Por ahora no se envía nada en producción (`Notifications:Provider` vacío). Hay que elegir la cuenta (WhatsApp Business Platform) y aprobar las plantillas de mensajes.

---

## Notas

- Este backlog es de alto nivel: el diseño de cada ítem se discute al tomarlo.
- Los elementos del formulario en papel de la historia clínica que faltan están en [`backlog_HC.md`](./backlog_HC.md).
- Lo que falta conectar entre el front y la API (solicitudes de acceso, proveedor de correo, etc.) está en `front/docs/planes-implementacion/12-campos-sin-conectar.md` y en [`back/backlog-desgloce.md`](../back/backlog-desgloce.md).
