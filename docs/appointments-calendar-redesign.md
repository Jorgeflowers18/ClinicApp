# Calendario de Citas: Mes compacto y selección de fecha individual

Implementación local del **12 de noviembre de 2026**. Referencia inicial: rama `main`, commit `faaef10`. El repositorio estaba limpio antes de empezar. No se hicieron commits ni publicaciones para esta intervención.

## Resultado

La vista Mes conserva la estructura real de React Big Calendar: siete columnas y las cuatro, cinco o seis semanas que corresponden al mes, con inicio en lunes. Se eliminó su dependencia de la altura de las vistas horarias. Cada semana utiliza una altura de referencia adaptable de 96–112 px en escritorio; en pantallas pequeñas o táctiles se reserva espacio para objetivos táctiles y eventos. No se reconstruyó el calendario.

Medidas en Chrome a 1440 × 1000 px, iguales en claro y oscuro:

| Mes | Semanas | Alto de cuadrícula antes | Alto después | Alto por semana después |
| --- | --- | --- | --- | --- |
| Febrero de 2027 | 4 | 668 px | 460 px | 105 px |
| Marzo de 2027 | 5 | 668 px | 565 px | 105 px |
| Noviembre de 2026 | 6 | 668 px | 670 px | 105 px |

Antes, las semanas de febrero ocupaban aproximadamente 157 px y las de marzo 126 px. Ahora, la altura total sigue al número de semanas, incluidos los bordes, sin estirar las celdas de los meses cortos. Se conserva el encabezado de días de 38 px.

### Una fecha exacta

«Ir a una fecha» mantiene React Day Picker en `mode="single"` y añade `required`. Solo hay una fecha seleccionada; pulsarla de nuevo confirma esa misma fecha y cierra el selector. Antes, esa pulsación entregaba `undefined` y dejaba el selector abierto.

Mes, año editable, flechas mensuales, años distantes y validación de fechas representables se conservan. El mes y el año del popup siguen siendo un cursor de exploración; la fecha controlada por la página cambia únicamente al elegir un día. El callback existente no cambia, la vista activa se conserva, el popup se cierra y el foco vuelve al botón.

El día seleccionado utiliza el primario sólido y su texto contrastante. Hoy tiene una señal distinta: contorno discreto e indicador pequeño en el selector; borde y subrayado en la cuadrícula mensual. Se conservan los estados accesibles de selección individual de Day Picker. No se añadieron selección múltiple, rangos, campos Desde/Hasta ni guardados.

### Conteo y consulta de citas

Cada día con citas muestra un contador neutro y discreto, con nombre accesible. Cuenta las citas visibles según los filtros actuales, incluidos sus distintos estados; los bloqueos no incrementan ese contador.

Los eventos mensuales muestran hora de inicio, paciente/estado o motivo del bloqueo. El texto se trunca dentro de la celda, conserva información completa en el título y abre el detalle existente. Los eventos también se pueden activar con teclado. Los colores de cita, cancelación, finalización, inasistencia y bloqueo conservan los tokens anteriores.

Cuando no caben todos los eventos, se reutiliza el desbordamiento de RBC, traducido como **«+N más»**. Su lista tiene scroll interno, encabezado de fecha visible durante el scroll y textos que pueden envolver líneas. Conserva el cierre nativo por clic fuera. El selector de fecha conserva su cierre con Escape; no se atribuye ese comportamiento al popup nativo de RBC.

Las pruebas detectaron que el popup de RBC podía exceder la pantalla al posicionarse respecto a la cuadrícula mensual con scroll. En pantallas de hasta 640 px o de hasta 600 px de alto se presenta dentro del viewport, fijado a 12 px de los bordes inferior y derecho. Se conservan los eventos, su orden y los callbacks. Los dos overrides locales de `top`/`left` con `!important` sustituyen únicamente las coordenadas inline que escribe RBC; no se alteran reglas globales de botones ni otros módulos.

El selector «Ir a una fecha» permanece en la toolbar y en las agendas compactas. Se comprobó que sigue accesible al desplazar horizontalmente la vista mensual. Semana conserva siete columnas horarias y Día una; la selección de intervalos para programar citas sigue activa.

## Archivos de esta intervención

| Archivo | Cambio |
| --- | --- |
| `front/src/modules/appointments/pages/appointments-calendar-page.tsx` | Altura independiente para Mes e integración de sus componentes de presentación estables. Traducción del desbordamiento. |
| `front/src/modules/appointments/components/calendar-month-content.tsx` | Contexto derivado de fecha/eventos existentes, encabezados diarios, contadores y contenido mensual de citas. |
| `front/src/modules/appointments/appointments-calendar.css` | Densidad mensual, estados de fecha, eventos y popup nativo, con alcance al calendario. |
| `front/src/modules/appointments/components/calendar-date-navigator.tsx` | `required` para confirmar una única fecha, incluida la ya seleccionada. |
| `front/src/modules/appointments/components/calendar-date-navigator.module.css` | Jerarquía del título, separación compacta y señal diferenciada para Hoy. |
| `front/tests/appointments-calendar-redesign.spec.ts` | Catorce casos nuevos en ambos temas, incluidos eventos desbordados y entrada táctil. |
| `docs/appointments-calendar-redesign.md` | Este informe. |

`appointments-toolbar.tsx` se revisó y conserva su implementación: Hoy, Ant., Sig., selector central y Mes/Semana/Día con indicador activo. No se modificaron componentes UI compartidos, tokens ni dependencias.

## Conservación del código y las áreas protegidas

Se compararon **233 archivos iniciales** por SHA-256. Solo cambiaron los cuatro archivos existentes de Citas indicados arriba; se añadieron el componente mensual y las pruebas. No se eliminó ningún archivo anterior.

Las diez funciones existentes comparadas permanecen iguales, incluyendo selección de horarios, apertura de eventos, eliminación de bloqueos, agenda compacta, nombres y conversiones de fecha/hora. También coinciden el mapeo y filtrado de eventos, los callbacks y props de datos de RBC y el callback de selección del selector. El contexto nuevo deriva los contadores de los eventos ya filtrados y consume la fecha controlada existente; no introduce otra fecha de navegación en estado.

Login, Header y Sidebar coinciden en doce snapshots de geometría y estilos. Las dieciséis imágenes comparadas de Login, Panel, Historia clínica, Tratamientos, Finanzas, Inventario y Notificaciones son idénticas byte por byte. Las APIs, formularios de citas y bloqueos, datos de ejemplo, validaciones, zona horaria, navegación clínica y demás módulos conservan su código.

Evidencia local: [comparación de alcance](../front/test-results/calendar-redesign/scope-verification.json).

## Validación ejecutada

**50 casos distintos pertinentes aprobados**, contando cada caso una sola vez:

| Suite | Casos verificados |
| --- | --- |
| `appointments-calendar-redesign.spec.ts` | 14/14 |
| `frontend-redesign.spec.ts` | 18/18 |
| `content-ui.spec.ts` | 18/18 |

La ejecución conjunta de 48 casos tuvo 46 aprobados y dos fallos de desbordamiento móvil. Se corrigió el posicionamiento y se ejecutaron seis casos dirigidos, todos aprobados, incluyendo dos casos táctiles nuevos. Se ampliaron esos dos casos táctiles para comprobar también la eliminación real de un bloqueo y volvieron a aprobar, 2/2. La combinación da 50 casos distintos; no se suman las repeticiones como casos nuevos. La primera pasada de desarrollo había asumido Escape para el popup nativo: se corrigió la prueba para usar su interacción existente por clic fuera.

Se verificaron ambos temas y **320, 360, 375, 390, 430, 600, 768, 1024, 1280, 1440 y 1920 px**. Las comprobaciones cubren:

- Meses de cuatro, cinco y seis semanas, siete columnas, continuidad de fechas y ausencia de cuadrícula horaria en Mes.
- 11 y 15 de noviembre de 2026, 15 de marzo de 2027, 29 de febrero de 2028 y exploración del año 2400 mediante las pruebas existentes.
- Una sola fecha seleccionada en Mes/Semana/Día, también con Shift y entrada táctil; ninguna creación o escritura al navegar por fechas.
- Cierre al confirmar la fecha actual o una nueva, retorno del foco y Escape del selector. Hoy, anterior/siguiente, salto entre años y conservación de la vista.
- Todos los eventos originales accesibles entre celdas y desbordamiento; contador separado de los bloqueos y correcto al filtrar profesionales.
- Quince eventos en un mismo día dentro de un contexto de pruebas aislado: todos accesibles por sus identificadores, scroll interno, lectura del último evento y apertura con teclado. Se comprobó a 1440, 390 y 320 px, además de 844 × 390 px.
- Creación, edición y cancelación de citas y creación de bloqueos mediante las pruebas existentes. Apertura, cancelación de la confirmación y eliminación real de un bloqueo desde Mes mediante entrada táctil; las demás citas y bloqueos conservan sus datos.
- Arrastre de un intervalo de 09:00 a 10:30 después de un salto al 15 de marzo de 2027: abre el formulario existente con esa fecha y horas, sin guardar al cancelar.
- Toolbar y selector accesibles con el scroll mensual desplazado, campos Mes/Año de altura consistente y ausencia de scroll horizontal global.

Los datos adicionales del caso de desbordamiento se introducen solo en la memoria del navegador de pruebas. No se cambiaron las semillas del proyecto ni los datos del navegador del usuario.

`npm.cmd run build` y `npm.cmd run lint` correctos. Se mantienen el aviso anterior de chunks grandes de Vite y los cinco avisos anteriores de lint en componentes ajenos a este cambio. `git diff --check` correcto.

Evidencias locales: [resultado combinado](../front/test-results/calendar-redesign/verification-summary.json), [ejecución conjunta](../front/test-results/calendar-redesign/regression-final.json), [desbordamiento y tacto corregidos](../front/test-results/calendar-redesign/overflow-touch-final.json), [eliminación de bloqueo con tacto](../front/test-results/calendar-redesign/touch-deletion.json), [medidas anteriores](../front/test-results/calendar-redesign/before/calendar-measurements.json) y [medidas posteriores](../front/test-results/calendar-redesign/after/calendar-measurements.json).

Capturas: [febrero antes](../front/test-results/calendar-redesign/before/four-weeks-dark.png), [febrero después](../front/test-results/calendar-redesign/after/four-weeks-dark.png), [Mes claro](../front/test-results/calendar-redesign/after/calendar-light-Mes.png), [Mes oscuro](../front/test-results/calendar-redesign/after/calendar-dark-Mes.png), [selector](../front/test-results/calendar-redesign/after/date-picker-dark-390.png). Las capturas de desbordamiento se conservan dentro de los resultados de pruebas.

La validación utiliza Chrome/Playwright, zona `America/Guayaquil` y datos mock; no constituye una revisión manual en dispositivos físicos o lectores de pantalla, ni una prueba del backend real. Se ejecutaron las suites pertinentes indicadas, no toda la suite del repositorio. Las evidencias están en `front/test-results/calendar-redesign/`, ignorado por Git.

Resultado disponible en **http://localhost:5173/citas**, sin commits automáticos.
