/**
 * Vencimientos de la cartera: total vencido, próximo vencimiento, días de mora, estado "Vencida" y seguros
 * pendientes. Llegan con la etapa B de finanzas (cuotas, seguros y factura: decisión pendiente de la clínica).
 * Hasta entonces la API responde siempre 0 y `null`, y nunca "vencida", así que las pantallas los ocultan en
 * lugar de mostrar "$0" o "Sin vencimientos pendientes". Al implementar la etapa B, poner `true`.
 */
export const showDueDates: boolean = false
