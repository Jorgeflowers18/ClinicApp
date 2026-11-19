# Finanzas y Reportes: auditoría y estandarización
Fecha: 19 de noviembre de 2026.

La intervención se realizó sobre los módulos existentes, después de revisar sus consultas, cálculos y exportaciones. El diseño utiliza los tokens actuales: violeta en claro, Acid Lime en oscuro y colores semánticos para importes y estados.

## Finanzas
Se conservaron los cuatro indicadores, con alturas uniformes, importes agrupados y cifras tabulares. Las explicaciones se muestran mediante controles de información accesibles por teclado y toque, sin aumentar la altura de una tarjeta aislada. Un vencido de cero utiliza un tono neutro.

Los dos accesos anteriores navegaban a la misma ruta de Tratamientos. Se mantuvo únicamente Ver tratamientos en el encabezado.

Cartera activa conserva sus nueve campos y cada registro paciente/tratamiento. La búsqueda por nombre o tratamiento y los filtros de estado y saldo se aplican a todos los registros recibidos, sin modificar los totales superiores ni inferir mora a partir del calendario. Los importes quedan juntos, alineados a la derecha; fechas y estados ocupan columnas compactas. En anchos pequeños se conserva toda la información en registros adaptables, sin tarjetas anidadas.

La auditoría encontró dos discrepancias anteriores entre etiquetas y cálculos:
- Cobrado este mes suma los pagos de toda la cartera, sin limitar el periodo al mes.
- Seguros pendientes cuenta tratamientos con próximo vencimiento; no consulta pendientes de aseguradora.

Se conservaron los nombres y las fórmulas solicitadas. Los controles de información explican expresamente esos límites. Corregirlos requiere una decisión funcional independiente; esta intervención no cambia su significado mediante cálculos nuevos.

No existen formularios de cobro, cuotas o seguros en esta página: sus APIs actuales son de lectura. No se crearon operaciones financieras nuevas.

## Reportes
- Selector de periodo con los nombres oficiales, nunca códigos como last30. Los presets muestran el rango; Personalizado permite editar Desde/Hasta, con las mismas restricciones y reglas inclusivas existentes.
- Los campos personalizados conservan sus valores y aparecen con una transición breve. La selección continúa compartida por las cuatro pestañas.
- Aviso de demostración compacto con todo el texto original, incluidos los periodos históricos de las semillas.
- Agenda: indicadores alineados; explicación de la tasa mediante popover; gráfico de 240–256 px, etiquetas adaptables y fecha completa en el tooltip. Verde para completadas, rojo para inasistencia y neutro para otras. Se conservan todas las series y todos los días.
- Productividad: gráfico horizontal con los profesionales reales y tabla completa, sin atribuir sesiones a profesionales cuando esa relación no existe.
- Tratamientos: mismos precios, asignaciones, sesiones e ingreso estimado. La explicación aclara que una estimación no confirma un cobro; el pequeño avance de sesiones solo aparece cuando los valores permiten representarlo.
- Inventario: existencias actuales separadas del periodo; cantidades alineadas y estado independiente, reutilizando la misma presentación que Inventario. Compras y consumos mantienen las agrupaciones originales y sus unidades.
- Los errores no se presentan como ceros o listas vacías. Mientras cambia el rango, no se muestran datos del periodo anterior como si correspondieran al nuevo. Las exportaciones permanecen deshabilitadas si no hay datos válidos para exportar.
- Las tablas extensas conservan desplazamiento local, sin introducir desbordamiento horizontal de la página.

La tasa continúa usando su denominador original de citas completadas más no asistidas. Cuando ese denominador es cero, la API devuelve 0%; la explicación advierte que no equivale a cumplimiento confirmado.

## Archivos
Finanzas:
- `front/src/modules/finance/pages/finance-page.tsx`
- `front/src/modules/finance/components/active-portfolio.tsx`
- `front/src/modules/finance/finance.css`

Reportes, bajo `front/src/modules/reports/`:
- `pages/reports-page.tsx`
- `components/period-selector.tsx`
- `components/kpi-card.tsx`
- `components/report-table-card.tsx`
- `components/report-error.tsx`
- `components/agenda-report-tab.tsx`
- `components/productivity-report-tab.tsx`
- `components/treatments-report-tab.tsx`
- `components/inventory-report-tab.tsx`
- `reports.css`

La opción de explicación en popover de KpiCard es optativa; su comportamiento predeterminado continúa siendo el anterior para los demás módulos. Los estilos de estos cambios quedan limitados a los módulos correspondientes. La presentación de existencias se comparte con los componentes documentados en `inventory-module-redesign.md`.

Pruebas:
- `front/tests/finance-reports-redesign.spec.ts`
- `front/tests/administrative-responsive.spec.ts`, adaptada a la nueva distribución conservando la comprobación de los nueve campos y la navegación real.

## Evidencia
- 12 pruebas nuevas aprobadas, seis por tema: importes y filtros; presets y fechas personalizadas; siete CSV; consultas fallidas y cambios de rango lentos; matriz responsive; existencias y detalle histórico de compras.
- Las siete descargas se compararon byte por byte con las filas reales y las columnas originales, incluidos nombre de archivo, comillas, saltos CRLF y BOM UTF-8. Son 14 descargas comprobadas entre ambos temas.
- Las siete expresiones downloadCsv del código original y el nuevo son idénticas al compararlas mediante el analizador de TypeScript.
- Las cuatro fórmulas de Finanzas permanecen idénticas. La comparación de capturas, con fecha fijada al 19 de noviembre de 2026, conserva: $100,00 cobrado; $95,00 pendiente; $0,00 vencido; contador 1.
- 320, 360, 375, 390, 430, 600, 768, 1024, 1280, 1440 y 1920 px, claro y oscuro, las cuatro pestañas y cartera. También Sidebar abierto/cerrado, selectores dentro del viewport y reflujo en 390 × 380 y 720 × 450 px.
- Dos regresiones anteriores de cartera y cuatro de creación/cancelación y acciones administrativas aprobadas. Dos regresiones de Inventario y dos clínicas aprobadas.
- Capturas reales en Chrome: 24 de referencia y 24 finales bajo `front/test-results/finance-reports-redesign/`.
- `npm.cmd run build` y TypeScript correctos; lint sin errores y con cuatro advertencias previas. Vite mantiene su aviso de tamaño de algunos bundles, fuera del alcance visual.
- `git diff --check` correcto. Auditoría de alcance en `front/test-results/scope-audit.json`: APIs, tipos, reglas de periodos, escritor CSV y código clínico sin cambios funcionales; la comparación de fuentes normaliza únicamente CRLF/LF.

Las evidencias locales en test-results están ignoradas por Git. Para ejecutar las pruebas sin borrarlas, utilizar un subdirectorio de salida, por ejemplo:
```powershell
$env:CLINIC_TEST_URL = 'http://127.0.0.1:5173'
npx.cmd playwright test tests/inventory-redesign.spec.ts tests/finance-reports-redesign.spec.ts --output=test-results/playwright --workers=2
```

No se realizaron commits, pushes ni cambios de rama. Los cambios anteriores de Tratamientos se conservaron.
