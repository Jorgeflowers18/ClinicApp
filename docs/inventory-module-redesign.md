# Inventario: auditoría, rediseño y corrección de existencias
Fecha: 19 de noviembre de 2026.

Se revisaron las cinco pestañas reales: Insumos, Compras, Proveedores, Esterilización y Stock crítico. La implementación conserva los campos, contratos, validaciones y operaciones de las APIs existentes. No se añadieron campos comerciales, estados de proveedor, métodos de esterilización ni operaciones de edición que el sistema no ofrece.

## Resultado
- Pestañas con iconos y selección del color primario del tema, filtros sobre el catálogo completo y paginación local. Los valores introducidos en cada pestaña se conservan al alternarlas.
- Stock actual y mínimo alineados a la derecha, con cifras tabulares. El estado tiene una columna independiente; ninguna advertencia se inserta en la cantidad.
- Comparación original `stock <= minStock` conservada, incluida la igualdad. Los estados visuales son Suficiente, Bajo mínimo, Agotado cuando corresponde a cero y Sin datos para cantidades no disponibles.
- Singular y plural únicamente en la presentación: unidad/unidades, caja/cajas, litro/litros y jeringa/jeringas. Abreviaturas como ml, g y kg permanecen intactas; no se redondean cantidades.
- Crear y editar insumos comparten el mismo formulario. El proveedor sigue siendo texto libre donde así lo define el modelo. Las rutas directas existentes continúan funcionando.
- Entrada/salida en un modal pequeño; proveedor en un modal mediano; nueva compra y esterilización en modales amplios con acordeón exclusivo, animación, valores montados y apertura de la sección con errores. El acordeón queda limitado a esos formularios extensos de Inventario.
- Confirmación de descarte, foco contenido en el modal, devolución del foco al cerrar, un único desplazamiento interior y bloqueo de envíos duplicados mientras la operación está pendiente.
- Compras: crear no altera existencias; recibir y cancelar mantienen las operaciones y restricciones originales. La confirmación permanece abierta si falla la operación. Las órdenes recibidas o canceladas no ofrecen acciones pendientes.
- Detalle de compra de solo lectura, ancho de referencia de 860 px y adaptación al contenido disponible. Proveedor, creación y estado se distribuyen horizontalmente sin tarjetas internas; las líneas conservan cantidades, costos históricos y vencimientos. Observaciones compactas y una sola acción Cerrar, sin barra decorativa.
- Esterilización conserva instrumentos seleccionados, responsable, fecha, resultado y notas. El historial sanitario permanece independiente de las existencias.

Los tamaños de referencia son 560 px para movimientos, 760 px para proveedores, 800 px para insumos, 900 px para ciclos y 1040 px para nuevas compras. Todos se limitan al ancho disponible y a la altura del dispositivo.

## Archivos
Bajo `front/src/modules/inventory/`:
- Páginas: `pages/inventory-list-page.tsx`, `pages/inventory-item-form-page.tsx` y `pages/inventory-item-detail-page.tsx`.
- Pestañas: `components/inventory-items-tab.tsx`, `critical-stock-tab.tsx`, `purchase-orders-tab.tsx`, `suppliers-tab.tsx` y `sterilization-tab.tsx`.
- Formularios: `inventory-item-form-dialog.tsx`, `purchase-order-form-dialog.tsx`, `supplier-form-dialog.tsx`, `register-movement-dialog.tsx` y `sterilization-cycle-form-dialog.tsx`, dentro de `components/`.
- Componentes reutilizables del módulo: `inventory-dialog.tsx`, `inventory-filter.tsx`, `inventory-form-fields.tsx`, `inventory-presentation.tsx`, `inventory-sections.tsx` e `inventory-toolbar.tsx`.
- Hooks: `hooks/use-inventory-catalog.ts`, `use-inventory-accordion.ts` y `use-inventory-submit.ts`.
- Presentación: `lib/inventory-display.ts` e `inventory.css`.

Pruebas: `front/tests/inventory-redesign.spec.ts`, los casos de existencias de `finance-reports-redesign.spec.ts` y las adaptaciones de selectores en `frontend-redesign.spec.ts` y `form-actions.spec.ts`.

## Validación
- 22 pruebas de Inventario aprobadas, en claro y oscuro: filtros con 127 insumos y registros posteriores a la página 100; igualdad con el mínimo y mínimo cero; altas/ediciones; precisión decimal; entrada, salida y stock insuficiente; recepción y cancelación; rechazo de guardados y corrección; proveedores relacionados; ciclos fallidos; conservación de borradores, errores, foco y desplazamiento; animación y movimiento reducido.
- Casos adicionales de Finanzas/Reportes verifican estados independientes, cantidades decimales, unidades sin plural artificial, información faltante y costo histórico de compra distinto del costo actual del catálogo.
- Dos regresiones existentes de Inventario aprobadas. Se actualizó la aserción del indicador activo para verificar el pseudoelemento de la variante de pestañas con línea.
- Matriz de 320, 360, 375, 390, 430, 600, 768, 1024, 1280, 1440 y 1920 px, en ambos temas; las cinco pestañas y cuatro formularios. También 390 × 380 y 720 × 450 px, como comprobación de reflujo con poco alto disponible.
- Capturas reales en Chrome: 48 de referencia y 48 posteriores, bajo `front/test-results/inventory-redesign/`. La referencia se generó desde una copia de HEAD, sin cambiar la rama de trabajo.
- Build y TypeScript correctos. Lint sin errores: quedan cuatro advertencias previas en los componentes compartidos de botones, badges, pestañas y el editor de notificaciones.
- Las dos regresiones clínicas de edición/exportación y migración de visitas también pasan. No se modificaron odontograma, periodontograma, librería ni integración clínica.

## Alcance técnico
El catálogo completo se obtiene mediante las páginas del endpoint existente y se comparte en la caché. Esto evita filtros incompletos sobre los primeros 100 registros; en catálogos muy grandes supone más lecturas iniciales. No se cambió el contrato del servidor.

Las pruebas usan datos de demostración aislados en cada navegador. El bloqueo de envíos repetidos en el frontend no certifica por sí solo la atomicidad de un backend real.

No se realizaron commits, pushes ni cambios de rama.
