# Fecha única y los dos controles «Hoy» de Citas

Implementación local del **12 de noviembre de 2026**, sobre `main` en `faaef10` y conservando los cambios locales anteriores del calendario. No se hicieron commits ni publicaciones.

## Comportamiento final

Se mantienen **los dos controles Hoy**: el de la barra principal y el del pie del selector. Ambos consumen la misma función `goToToday`, definida una sola vez en la página y compartida mediante el contexto de presentación del calendario. Esa función calcula `startOfDay(new Date())` al pulsar, utilizando la fecha local actual, y actualiza el `date` existente mediante `setDate`. No memoriza el día de carga de la página ni cambia la vista.

El control principal permite volver a hoy sin abrir el selector. El del selector, además, cierra el popover y devuelve el foco al botón que lo abrió. La presentación compacta utiliza la misma función. Ambos funcionan en Mes, Semana y Día, incluso después de explorar un año distante o dejar un año inválido escrito en el selector. Navegar no crea citas ni ejecuta guardados.

## Fecha elegida y período visible

El botón interactivo muestra siempre una fecha individual completa, por ejemplo **15 de noviembre de 2026**. Ya no recibe el intervalo semanal como etiqueta. El período representado por RBC se muestra como información secundaria separada, con nombre accesible «Periodo visible».

Por ejemplo, al elegir el 31 de diciembre de 2026, el botón mantiene esa fecha exacta y el texto contextual puede describir una semana entre 2026 y 2027. Semana conserva sus siete días horarios; Mes conserva todas sus semanas; Día conserva una jornada.

El selector mantiene `mode="single"` y `required`. Elegir el 15 después del 11 elimina el estado seleccionado anterior: no aparece un rango entre ambos días. Se conserva el callback de selección existente y la fecha controlada por la página como única fuente de navegación. El mes/año del popup sigue siendo un cursor temporal de exploración.

## Selector compacto

- Encabezado con mes y año que se están explorando, navegación mensual y descripción «Selecciona únicamente un día». Se conserva el título accesible «Ir a una fecha».
- Mes en español y año editable con la validación anterior, sin un rango artificial de años.
- Siete columnas L/M/M/J/V/S/D; se mantienen los nombres completos de los días en las etiquetas accesibles.
- Celdas de 40 px de alto en escritorio y 44 px en pantallas pequeñas/táctiles, con separación local de 4 px entre sus interiores.
- Una sola selección sólida con violeta o Acid Lime, según el tema. Hoy conserva un borde discreto cuando no está seleccionado; no se añade un punto especial duplicado para Hoy.
- Pie con «Fecha seleccionada», su fecha completa y botón Hoy primario sólido.

El encabezado y el pie permanecen accesibles cuando falta altura. Solo el cuerpo con los campos y la cuadrícula tiene scroll interno. Se mantienen Escape, teclado, cierre por selección y retorno del foco mediante Base UI y Day Picker.

En la captura de referencia de 1440 px, el popup mide 336 × 489,28 px; a 390 px mide 336 × 527,28 px. Ambos temas tienen la misma geometría. El ancho se limita al viewport y el alto al espacio disponible. No se añadieron reglas globales ni cálculos manuales de posición.

## Indicadores respaldados por citas existentes

Los puntos del selector consultan el mismo mapa de conteos que ya usa la cuadrícula mensual, derivado de los eventos filtrados de Citas. No se introducen consultas nuevas, citas ficticias ni patrones decorativos de puntos. Cada consulta por día es una lectura del mapa, no un recorrido completo de los eventos.

Se cuenta cada cita visible con su estado actual. Los bloqueos no incrementan el conteo. Los botones de día anuncian la cantidad de citas cuando existe, conservando las etiquetas accesibles originales. Un día sin citas no muestra punto, incluso si solo contiene un bloqueo.

La aplicación conserva su configuración de datos actual; las pruebas usaron el modo mock existente. «Existentes» se refiere a los eventos entregados por la fuente actual del proyecto, sin inventar datos para dibujar indicadores.

## Archivos de esta intervención

| Archivo | Cambio |
| --- | --- |
| `front/src/modules/appointments/components/calendar-date-navigator.tsx` | Fecha exacta, encabezado, puntos de citas y pie con Hoy. |
| `front/src/modules/appointments/components/calendar-date-navigator.module.css` | Dimensiones, jerarquía, separación y scroll exclusivo del cuerpo. |
| `front/src/modules/appointments/components/calendar-presentation-context.ts` | Contexto local para fecha, conteos y la acción compartida de Hoy. |
| `front/src/modules/appointments/components/calendar-month-content.tsx` | Reutiliza ese contexto y los conteos ya existentes; mantiene el contenido mensual. |
| `front/src/modules/appointments/components/appointments-toolbar.tsx` | Hoy compartido y separación entre fecha elegida y período visible. |
| `front/src/modules/appointments/pages/appointments-calendar-page.tsx` | Única función Hoy, conexión del contexto y la misma acción en la agenda compacta. |
| `front/src/modules/appointments/appointments-calendar.css` | Solo añade la presentación del texto contextual del período. |
| `front/tests/calendar-single-date-today.spec.ts` | Diez casos nuevos sobre ambos Hoy, selección, puntos, responsive y fecha local. |
| `front/tests/frontend-redesign.spec.ts` | Adapta las expectativas al título accesible y al período separado; conserva las verificaciones funcionales. |
| `front/tests/global-interactions.spec.ts` | Compara el texto visible de la etiqueta ahora compuesta por dos elementos. |
| `docs/calendar-single-date-today.md` | Este informe. |

Los siete archivos que ya tenían cambios locales al comenzar permanecen. La implementación anterior de densidad mensual, eventos y desbordamiento se conserva.

## Conservación y validación

La comparación de **235 archivos iniciales** no encuentra eliminaciones ni modificaciones fuera de seis archivos existentes de Citas y dos archivos de pruebas. Se añadieron el contexto local y las nuevas pruebas, además de este informe.

Las diez funciones anteriores de presentación/gestión de agenda, apertura de eventos, selección de intervalos, eliminación de bloqueos, nombres y conversiones de fecha/hora coinciden con la referencia. También coinciden el mapeo y filtrado de eventos, las props de datos y callbacks de RBC, el callback de selección individual, el conteo de citas y el contenido mensual de eventos.

El CSS de RBC coincide con la referencia al retirar la única regla nueva del texto de período. Las alturas de Mes, sus cuatro/cinco/seis semanas y el comportamiento anterior de desbordamiento no se modificaron. Las APIs, formularios, modelos, persistencia, tokens, dependencias y módulos protegidos conservan su código.

Login, Header y Sidebar coinciden en doce snapshots de geometría y estilos. Quince de las dieciséis imágenes de áreas protegidas son idénticas byte por byte. La restante, Historia clínica oscura, difiere en un único píxel por un nivel de un canal RGB; se conserva esa diferencia en la evidencia, sin atribuirle identidad byte por byte. No hay cambios de código ni de los snapshots protegidos de esa pantalla.

**62 casos distintos pertinentes aprobados:**

| Suite | Casos verificados |
| --- | --- |
| `calendar-single-date-today.spec.ts` | 10/10 |
| `appointments-calendar-redesign.spec.ts` | 14/14 |
| `frontend-redesign.spec.ts` | 18/18 |
| `content-ui.spec.ts` | 18/18 |
| `global-interactions.spec.ts`, casos de calendario | 2/2 |

La ejecución conjunta de 60 casos tuvo 50 aprobados y diez fallos de expectativas de pruebas. Se adaptaron las consultas a las presentaciones visibles, a los encabezados de Day Picker, a la ausencia del atributo de selección en días no seleccionados, al final de la animación del popover y al texto visible ahora separado en dos elementos. Una ejecución dirigida posterior aprobó los doce casos seleccionados, incluidos dos casos adicionales del calendario en la suite global. El total es 62 casos distintos; las repeticiones no se suman como casos nuevos.

Se verificaron ambos temas y **320, 360, 375, 390, 430, 600, 768, 1024, 1280, 1440 y 1920 px**, además de viewports de 844 × 390, 375 × 420 y 320 × 568 px. Las pruebas incluyen:

- Ambos Hoy en las tres vistas, en escritorio y en la presentación compacta; mismo resultado, vista conservada, cierre y foco del selector.
- Exploración de 2400 sin alterar la fecha elegida; selección del 29 de febrero de 2028; Hoy habilitado ante un año inválido; activación con Espacio y cierre con Escape.
- Fecha local cerca de medianoche UTC: a `2026-11-11T02:30Z` Hoy corresponde al 10 en Guayaquil; a `05:30Z`, al 11. No se utiliza una fecha UTC para elegir el día.
- Sustitución del 11 por el 15, una sola selección, ausencia de rangos con Shift y conservación de los datos al navegar.
- Puntos y nombres accesibles basados en los conteos filtrados; exclusión de días que solo tienen bloqueos.
- Pie y botón Hoy visibles, objetivos de 38/44 px tras finalizar la animación, siete columnas y ausencia de desbordamiento horizontal global.
- Regresiones anteriores: meses completos de cuatro/cinco/seis semanas, todos los eventos y su desbordamiento, filtros, entrada táctil, creación/edición/cancelación de citas, creación/eliminación de bloqueos e intervalos horarios para programar citas.

Build de producción y lint correctos. Se mantienen el aviso anterior de chunks grandes de Vite y los cinco avisos anteriores de lint. `git diff --check` correcto. No se instalaron dependencias.

Evidencias locales: [alcance](../front/test-results/calendar-single-date/scope-verification.json), [resultado combinado](../front/test-results/calendar-single-date/verification-summary.json), [ejecución conjunta](../front/test-results/calendar-single-date/regression-final.json), [comprobaciones dirigidas](../front/test-results/calendar-single-date/corrected-assertions.json), [medidas antes](../front/test-results/calendar-single-date/before/selector-measurements.json) y [medidas después](../front/test-results/calendar-single-date/after/selector-measurements.json).

Capturas: [selector oscuro](../front/test-results/calendar-single-date/after/selector-dark-1440.png), [selector claro móvil](../front/test-results/calendar-single-date/after/selector-light-390.png), [exploración de otro año](../front/test-results/calendar-single-date/after/browsing-dark-1440.png). Los artefactos se conservan en `front/test-results/calendar-single-date/`, ignorado por Git.

La comprobación se realizó con Chrome/Playwright y datos mock. No se afirma una certificación de accesibilidad, revisión manual con lectores de pantalla, pruebas físicas de dispositivos o validación del backend real. Se ejecutaron las suites pertinentes indicadas, no toda la suite del repositorio.

Resultado local: **http://localhost:5173/citas**. Sin commits automáticos.
