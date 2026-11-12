# ClinicApp — Implementación de la auditoría y rediseño de contenido

Solicitud: 11 de noviembre de 2026. Esta fase continúa los cambios locales de estandarización anteriores y conserva ese trabajo. No se reconstruyeron páginas ni se añadieron dependencias.

## Auditoría y guía

Antes de modificar el producto se crearon:

- [Auditoría por módulo](frontend-ui-ux-audit.md): hallazgos, recomendaciones, prioridad, riesgo y límites de cada área.
- [Guía de diseño](frontend-redesign-guidelines.md): patrones semánticos, dimensiones, estados y comportamiento responsive adoptados.

Se inspeccionaron los componentes y rutas reales, la configuración de temas, React Big Calendar, React Day Picker, tablas, formularios administrativos, Inventario, Notificaciones, Finanzas, Reportes y las áreas protegidas. Se contrastaron las referencias `DESIGN.md`, `tokens.json`, `variables.css` y `theme.css` sin reemplazar la identidad clara por la referencia oscura.

## Cambios de esta fase

| Archivo relativo al repositorio | Propósito |
| --- | --- |
| `front/src/modules/appointments/components/calendar-date-navigator.tsx` | Nuevo selector de mes, año y día, compartido por RBC y la agenda compacta. |
| `front/src/modules/appointments/components/calendar-date-navigator.module.css` | Aislamiento y dimensiones del selector, cuadrícula, foco y selección. |
| `front/src/modules/appointments/components/appointments-toolbar.tsx` | Nueva toolbar local de RBC con los callbacks existentes y título interactivo. |
| `front/src/modules/appointments/pages/appointments-calendar-page.tsx` | Conecta la toolbar y sustituye el picker móvil por el selector compartido; rangos entre años explícitos. |
| `front/src/modules/appointments/appointments-calendar.css` | Título alineado, distribución compacta y toolbar contenida en la vista mensual estrecha. |
| `front/src/styles/content-ui.css` | Indicadores activos, foco semántico, secundarios neutros, cifras de Inventario y organización de Notificaciones. |
| `front/src/modules/notifications/components/notification-template-editor.tsx` | Agrupa edición y variables, añade región de vista previa y reorganiza el formulario sin alterar handlers. |
| `front/src/app/layout/app-layout.tsx` | Solo invierte la etiqueta de la acción de tema: claro → «Modo oscuro», oscuro → «Modo claro». |
| `front/tests/frontend-redesign.spec.ts` | 18 casos nuevos: navegación por fecha, teclado, años distantes, cambio de año, responsive, plantilla, Inventario y tema. |
| `front/tests/administrative-responsive.spec.ts`, `auth-ui.spec.ts`, `clinical-navigation-integration.spec.ts`, `dental-history.spec.ts`, `design-system.spec.ts`, `global-interactions.spec.ts`, `profile-integration.spec.ts` | Actualizan únicamente las interacciones con el texto autorizado de tema y el trigger accesible del picker. Se conservan las comprobaciones funcionales. |
| `front/scripts/capture-content-ui.mjs` | Permite una carpeta de evidencia separada y captura Inventario/Notificaciones además de los módulos previos. |
| `docs/frontend-ui-ux-audit.md`, `frontend-redesign-guidelines.md`, `frontend-redesign-implementation.md` | Auditoría, guía e informe final. |

Los archivos de UI/UX, navegación clínica, pruebas e informes anteriores que ya estaban modificados o sin seguimiento al inicio permanecen en el repositorio local. Este listado identifica el alcance adicional de la nueva solicitud.

## Selector directo de día, mes y año

Al pulsar el título/rango se abre «Ir a una fecha». Se puede escribir el año, elegir cualquiera de los doce meses en español y pulsar un día. El salto noviembre de 2026 → 15 de marzo de 2027 no recorre meses intermedios. No hay una lista limitada a pocos años: se admite ingreso directo de un año positivo representable como fecha local. La validación pertenece únicamente al selector; no altera validaciones clínicas ni reglas de disponibilidad.

El estado `date` de `AppointmentsCalendarPage` sigue siendo la única fecha visible de la aplicación. El cursor de mes y el texto de año son borradores locales del popover: explorarlos no navega hasta seleccionar un día. En escritorio se invoca `onNavigate("DATE", fecha)` de RBC; en la agenda se usa el mismo `setDate` existente. Mes conserva Mes, Semana conserva Semana y Día conserva Día.

El año se muestra en el título. Una semana que cruza diciembre/enero indica ambos años, también en la agenda compacta. Las fechas se manejan como objetos locales, sin serialización UTC ni cambios de zona horaria. Se comprobó la selección del 15 de marzo de 2027 y el 29 de febrero de 2400. Seleccionar un intervalo de las 09:00 del 15 de marzo abre el formulario existente con `Fecha=2027-03-15` e `Inicio=09:00`; la comprobación cancela el formulario sin crear ese registro.

Se reutilizan Popover, Button, Input, Label, Select y Calendar/React Day Picker. Se conserva también el avance/retroceso de un mes mediante flechas neutrales, sincronizado con los campos de mes y año. El popover tiene ancho de 336 px, ajustado al viewport y al espacio disponible, scroll interno y cierre/retorno de foco mediante las primitivas existentes. Las celdas tienen 38 px de alto en escritorio y 44 px en móvil; a 320 px su ancho se ajusta para mantener los siete días sin desbordamiento.

Hoy, Ant., Sig., Mes/Semana/Día, la selección de horarios, formularios, eventos, bloqueos y filtros permanecen. La toolbar está declarada fuera de la página y su objeto de componentes es estable; no se recrea el calendario para cambiar el cursor del picker.

## Paleta, selección y foco

Los tokens originales no se modifican. Se conserva el primario claro violeta `#5350CC` y el oscuro Acid Lime `#E4F222`, con sus superficies, textos y estados semánticos actuales.

- Primarios: fondo del primario del tema y su texto contrastante.
- Secundarios: superficie neutra y borde discreto; hover de superficie, sin simular una acción principal.
- Pestañas y vistas: indicador de 2 px y superficie discreta solo para la opción activa. Semana utiliza subrayado Acid Lime en oscuro y violeta en claro.
- Menús/selectores: check existente, superficie de selección y un indicador lateral fino; se conservan los estados accesibles.
- Focus: `--ring` toma `--primary` solo dentro del contenido y sus portales, sin cambiar el anillo global del Login/Sidebar ni los tokens que recibe el iframe clínico.
- Picker: el día seleccionado utiliza el primario; hoy y los días de otro mes mantienen indicadores discretos. El resto de fechas permanece neutro.

Los colores de riesgo, errores, estados de cita, información y finanzas conservan su significado. Las tarjetas informativas no reciben acentos decorativos, cursor pointer ni acciones nuevas.

## Tablas, formularios y Notificaciones

Se mantiene el trabajo previo de encabezados de 42–44 px, filas naturales, separadores discretos, categorías secundarias, tarjetas móviles y tres puntos. Se extiende el patrón de cifras tabulares y alineación a `unitCost`, `stock`, `minStock`, `quantity` y `amount`; los valores, moneda, badges y operaciones no se cambian. Los triggers de acciones conservan al menos 34 px en escritorio y 44 px en móvil/táctil.

La paginación compartida permanece: cero registros sin barra, una página solo rango, y varias páginas con las direcciones disponibles. Los calendarios mantienen su navegación temporal independiente.

Notificaciones muestra variables y mensaje como un área de edición, con vista previa al lado cuando el contenedor alcanza 48 rem; pasa a una columna al reducirse. Se conservan los cinco tokens insertables, inserción en el cursor, vista previa real, contenido predeterminado, historial, búsquedas, filtros y guardado. Guardar sigue dependiendo de `isDirty`/`isSubmitting`, sin estados ficticios. Las pruebas verifican inserción en medio del texto, retorno de foco, preview, acción habilitada con primario y acción deshabilitada tras guardar.

La tipografía, densidad, grids de campos y alturas de controles adoptadas en la fase previa se conservan. Se aplican los nuevos indicadores a las pantallas que ya usan componentes compartidos, sin rehacer los formularios clínicos.

## Responsive y áreas protegidas

Las pruebas del selector recorren 11 anchos × 3 vistas × 2 temas: 320, 360, 375, 390, 430, 600, 768, 1024, 1280, 1440 y 1920 px. Incluyen agenda compacta, mes con scroll local, popover abierto, pantalla horizontal de 844 × 390 y navegación con teclado.

La suite existente revisa además 18 pantallas de contenido en los once anchos y ambos temas, sidebar abierto/cerrado, formularios, diálogos, popovers, perfiles, tabs, contraste de controles y zoom CSS del 200 %. No se introduce scroll horizontal global ni se eliminan datos para hacer caber las tablas.

Se compararon 12 snapshots antes/después de estilos y geometría de Login, Header y Sidebar, en 390 y 1440 px y ambos temas. Resultado: **cero diferencias de estilos o geometría**, normalizando exclusivamente el texto autorizado de destino del tema. Las cuatro imágenes de Login son idénticas por SHA-256.

La auditoría de 225 archivos iniciales encontró 213 sin cambios, ninguna eliminación y ningún cambio protegido fuera de la excepción. El diff de AppLayout contiene exactamente la inversión de esa etiqueta; iconos, callbacks, persistencia y demás código permanecen iguales. Se compararon 26 funciones existentes del editor/guardado, calendario y plantilla: todas mantienen su contenido. No se modificaron APIs, tipos, stores, dependencias, datos de ejemplo, exportaciones ni el documento interno del odontograma.

## Validación y resultados reales

Build, lint y `git diff --check` correctos durante la implementación. Se mantienen cinco avisos previos de Fast Refresh/RHF y el aviso previo de chunks mayores a 500 kB; no se instalaron dependencias para resolverlos.

**Suite completa: 135/135 aprobados en 6,7 minutos, sin fallos ni reintentos.** Los dos casos adicionales de semana entre años aprobaron (2/2, 5,2 s). Los dos casos de vista Día con la comprobación de programación lejana aprobaron (2/2, 6,1 s).

Tras conservar también las flechas mensuales del picker anterior, se reejecutó el archivo completo de esta fase: **18/18 aprobados en 44,6 segundos**, incluyendo las flechas diciembre → enero → diciembre, años, las tres vistas, programación lejana, teclado, responsive y las demás comprobaciones nuevas. Resultado combinado: **137 casos distintos verificados**; las ejecuciones dirigidas que se solapan con la suite no se suman como casos diferentes.

La primera pasada dirigida de desarrollo tuvo 14/16 aprobados: dos expectativas pedían «marzo» completo, mientras el localizador existente de RBC muestra «mar» en Día. Se corrigió la expectativa para conservar el formato regional real; las selecciones de fecha ya eran correctas. Ese informe se conserva como `targeted.json`.

Comandos desde `front/`:

```powershell
npm.cmd run build
npm.cmd run lint
git diff --check
$env:CLINIC_TEST_URL='http://localhost:5173'
$env:PLAYWRIGHT_JSON_OUTPUT_FILE='test-results/frontend-redesign/full-suite.json'
npm.cmd run test:e2e -- --workers=2 --output=test-results/frontend-redesign/full-suite --reporter=line,json --max-failures=5
$env:PLAYWRIGHT_JSON_OUTPUT_FILE='test-results/frontend-redesign/cross-year.json'
npm.cmd run test:e2e -- tests/frontend-redesign.spec.ts --grep 'cross-year' --workers=2 --output=test-results/frontend-redesign/cross-year --reporter=line,json
$env:PLAYWRIGHT_JSON_OUTPUT_FILE='test-results/frontend-redesign/distant-scheduling.json'
npm.cmd run test:e2e -- tests/frontend-redesign.spec.ts --grep 'jump preserves Día' --workers=2 --output=test-results/frontend-redesign/distant-scheduling --reporter=line,json
$env:PLAYWRIGHT_JSON_OUTPUT_FILE='test-results/frontend-redesign/selector-final.json'
npm.cmd run test:e2e -- tests/frontend-redesign.spec.ts --workers=2 --output=test-results/frontend-redesign/selector-final --reporter=line,json --max-failures=3
```

Evidencias ignoradas por Git en `front/test-results/frontend-redesign/`: informes JSON, `source-verification.json`, `protected-comparison.json`, capturas `before/` y `after/`, trazas y capturas del picker dentro de los resultados de pruebas.

## Límites y Git

Las verificaciones usan Chrome/Playwright con los datos mock existentes y la zona America/Guayaquil. No se realizó certificación WCAG, revisión manual con lector de pantalla, prueba física en cada dispositivo, zoom nativo de todos los navegadores ni pruebas con backend real. La persistencia y las limitaciones de borradores originales se conservan.

Rama local `main`, HEAD `205fec7e5b4b1d4ab1b8a490fa6bc1ea06e8b3b0`. No se hicieron commits, pushes, resets ni cambios de rama. El resultado sigue disponible en **http://localhost:5173** para revisión local.
