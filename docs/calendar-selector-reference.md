# Selector de fecha: composición de la imagen de referencia

Implementación local del **12 de noviembre de 2026**, conservando los cambios anteriores del calendario. La rama sigue en `main`, commit `faaef10`; no se hicieron commits ni publicaciones.

## Diseño aplicado

Se reprodujo la composición del selector interno de la imagen en el popover real de Citas. No se copiaron el marco de demostración, sus textos externos, el día seleccionado ni los puntos ilustrativos.

| Elemento de la referencia | Implementación |
| --- | --- |
| Panel oscuro elevado, borde fino y esquinas amplias | Carbon, borde Smoke y radio de 20 px; superficie blanca y borde semántico en claro. |
| Mes y año como encabezado principal | Título de 18 px semibold, con la descripción debajo y datos del cursor actual. |
| Flechas circulares a la derecha | Controles de 36 × 36 px con borde, ampliados a 44 × 44 px en móvil/táctil. |
| Mes y Año alineados | Columnas iguales, misma altura y campos redondeados en forma de píldora. |
| Días dentro de superficies propias | Celdas Obsidian en oscuro y superficies secundarias claras en claro, radio de 10 px y separación uniforme de 4 px. |
| Selección única destacada | Acid Lime con texto Void en oscuro; violeta con texto blanco en claro. Hover y focus se conservan. |
| Días fuera del mes con menor protagonismo | Fondo transparente y texto secundario; Fog en oscuro para mantener legibilidad. Siguen siendo seleccionables. |
| Puntos discretos debajo del número | Puntos de 4 px con el primario del tema; usan foreground contrastante sobre una celda seleccionada. |
| Separador y fecha seleccionada al pie | Línea semántica, etiqueta secundaria y fecha dinámica semibold a la izquierda. |
| Hoy como píldora clara | Variante secundaria local: Bone con texto Void en oscuro; superficie secundaria con texto oscuro en claro. Conserva icono, hover, focus y acción. |

El popover tiene **400 px de ancho en escritorio**, dentro de la orientación de 360–420 px indicada. No se extendió al ancho de la demostración. A 390 px de pantalla mide 374 px, con márgenes de 8 px. Las capturas de noviembre con seis semanas miden 400 × 539 px en escritorio y 374 × 571 px en móvil, en ambos temas.

Se conserva el cuerpo con scroll interno y el encabezado/pie accesibles cuando falta altura. El límite de alto depende del espacio disponible, con un máximo de 620 px; no se impone un alto fijo ni se dejan áreas vacías obligatorias. Todos los colores proceden de los tokens existentes mediante variables locales del selector.

## Funcionalidad conservada

La modificación del TSX consiste únicamente en utilizar la variante visual `secondary` del botón Hoy del pie. Al retirar ese atributo, el archivo coincide con la referencia inicial. **Los ocho callbacks del selector permanecen iguales.**

Se conservan selección individual con `mode="single"` y `required`, cursor temporal de mes/año, años distantes, fechas locales, Escape, navegación por teclado, cierre y retorno del foco. Los dos controles Hoy siguen utilizando la misma acción y conservan Mes/Semana/Día.

Los puntos se obtienen del conteo filtrado existente. No se copiaron las posiciones de la imagen, no se generaron citas ni consultas adicionales y los bloqueos no cuentan como citas. Mes, Semana, Día, eventos, intervalos horarios, formularios, filtros, estados, persistencia y conversiones de fecha del calendario principal conservan su código.

Esta petición sustituye la apariencia primaria anterior de Hoy en el selector por la píldora neutra de la referencia. El control Hoy de la barra principal mantiene su presentación anterior.

## Archivos de esta intervención

| Archivo | Cambio |
| --- | --- |
| `front/src/modules/appointments/components/calendar-date-navigator.module.css` | Superficies, radios, tipografía, dimensiones, campos iguales, flechas circulares, puntos y pie. |
| `front/src/modules/appointments/components/calendar-date-navigator.tsx` | Solo la variante visual del botón Hoy. |
| `front/tests/calendar-single-date-today.spec.ts` | Actualiza la expectativa visual de Hoy a la superficie neutra solicitada, conservando las verificaciones funcionales. |
| `front/tests/calendar-selector-reference.spec.ts` | Cuatro casos nuevos de composición, materiales, interacción y responsive en ambos temas. |
| `docs/calendar-selector-reference.md` | Este informe. |

No se modificaron componentes UI compartidos, tokens globales, dependencias, integración con RBC ni otros módulos. Los cambios locales preexistentes se conservaron.

## Resultados reales

**64 casos distintos pertinentes aprobados:**

| Suite | Casos verificados |
| --- | --- |
| `calendar-selector-reference.spec.ts` | 4/4 |
| `calendar-single-date-today.spec.ts` | 10/10 |
| `appointments-calendar-redesign.spec.ts` | 14/14 |
| `frontend-redesign.spec.ts` | 18/18 |
| `content-ui.spec.ts` | 18/18 |

La ejecución conjunta aprobó las 60 regresiones anteriores. Las cuatro comprobaciones nuevas inicialmente incluían el campo interno oculto de Base UI al medir los controles: se corrigieron para consultar Mes y Año por sus labels. Aprobaron tres de cuatro en la siguiente pasada; se ajustó la medición del hover para esperar la transición CSS y el caso restante aprobó. El resultado combinado contiene 64 casos únicos; no se suman las repeticiones como casos adicionales.

Se verificaron ambos temas y **320, 360, 375, 390, 430, 600, 768, 1024, 1280, 1440 y 1920 px**, además de 844 × 390 y 320 × 568 px. Las comprobaciones incluyen campos iguales, formas circulares y redondeadas, colores de celdas normales/seleccionadas, neutralidad de Hoy, puntos respaldados por citas, hover distinto de selección, selección de días externos al mes, teclado, pie visible y ausencia de scroll horizontal global.

Las regresiones conservan ambos Hoy, tres vistas, años distantes, bisiestos, fecha local cerca de medianoche UTC, selección sin rangos con Shift, filtros, eventos desbordados, creación/edición/cancelación de citas, creación/eliminación de bloqueos y selección de intervalos horarios.

Build de producción y lint correctos. Permanecen el aviso anterior de chunks grandes de Vite y los cinco avisos anteriores de lint; no se añadieron advertencias. `git diff --check` correcto.

Se compararon **237 archivos iniciales**: solo cambiaron los dos archivos del selector y la expectativa visual de su prueba existente; se añadió la nueva prueba y no hubo eliminaciones. Los doce snapshots de geometría/estilos de Login, Header y Sidebar coinciden. Las dieciséis imágenes comparadas de Login, Panel, Historia clínica, Tratamientos, Finanzas, Inventario y Notificaciones son idénticas byte por byte.

Evidencias locales: [alcance y callbacks](../front/test-results/calendar-selector-reference/scope-verification.json), [resultado combinado](../front/test-results/calendar-selector-reference/verification-summary.json), [regresión](../front/test-results/calendar-selector-reference/regression.json), [verificación visual](../front/test-results/calendar-selector-reference/visual-verification.json), [hover](../front/test-results/calendar-selector-reference/hover-verification.json), [medidas anteriores](../front/test-results/calendar-selector-reference/before/selector-measurements.json) y [medidas posteriores](../front/test-results/calendar-selector-reference/after/selector-measurements.json).

Comparación visual: [antes, oscuro](../front/test-results/calendar-selector-reference/before/selector-dark-1440.png), [después, selector oscuro](../front/test-results/calendar-selector-reference/after/widget-dark-1440.png), [selector claro móvil](../front/test-results/calendar-selector-reference/after/widget-light-390.png). Se inspeccionaron las capturas frente a la imagen proporcionada y se verificaron las propiedades indicadas arriba.

Las pruebas utilizan Chrome/Playwright y el modo mock existente. No constituyen una certificación de accesibilidad, revisión manual con lectores de pantalla, prueba física de todos los dispositivos ni validación del backend real. Se ejecutaron las suites pertinentes indicadas, no toda la suite del repositorio. Las evidencias permanecen en `front/test-results/calendar-selector-reference/`, ignorado por Git.

Resultado disponible en **http://localhost:5173/citas**, sin commits automáticos.
