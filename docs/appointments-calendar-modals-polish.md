# Citas, calendario y modales: auditoría e implementación

Se conserva React Big Calendar, su distribución temporal nativa y los formularios con React Hook Form y Zod. Los cambios se limitan a la presentación del módulo Citas, la protección de sus borradores y sus pruebas.

## Auditoría y decisiones

La pantalla ya utilizaba un único estado de fecha y vista, un selector de día individual sobre Popover de Base UI, vistas nativas de Mes/Semana/Día y una agenda compacta. El selector ya estaba en un Portal; se conserva esa estructura y se explicita la preferencia de apertura inferior.

Los problemas encontrados fueron la altura mínima de 600 px del calendario, que añadía desplazamiento al contenedor principal; la repetición de fecha y periodo; los editores estrechos con todos los selectores apilados; la falta de mapas de nombres en varios selects; y el cierre de formularios modificados sin confirmación.

Se mantienen los esquemas, callbacks, servicios y reglas de disponibilidad existentes. El estado de la cita sigue administrándose desde su detalle: guardar una edición conserva ese estado, sin incorporar un control o una regla nueva al formulario.

## Resultado

- Encabezado compacto con Bloquear horario secundario y Nueva cita primario. Filtro profesional integrado en la superficie de herramientas del calendario.
- Barra temporal con navegación a la izquierda, periodo interactivo en el centro y control segmentado a la derecha cuando hay espacio. La selección utiliza superficie neutra e indicador de 2 px del primario del tema.
- Un único periodo visible en el selector: mes/año, rango semanal con sus años o fecha completa. La fecha seleccionada se conserva en su etiqueta accesible y en el pie del popover. Alternar vistas no la modifica.
- Selector flotante de 360 px, limitado al viewport, con el diseño aprobado de meses, año editable, días, puntos de citas reales y Hoy. Apertura inferior preferente, reposicionamiento según espacio y desplazamiento interno cuando hace falta. No ocupa espacio en el flujo de la página.
- Horas desplazables dentro de la cuadrícula nativa. La barra temporal y la leyenda permanecen fuera de ese desplazamiento. La agenda compacta también tiene su contenedor de desplazamiento.
- Mes conserva las semanas reales, las etiquetas compactas, el recuento de citas y el desbordamiento nativo «+N más». La selección y el día actual conservan señales diferentes.
- Se mantiene la proporción temporal: una cita de 30 minutos ocupa 36 px y una de una hora 72 px en la escala actual. Se conservan superposiciones y eventos que abarcan varios días.
- Programada, Confirmada, Completada, Cancelada, No asistió y Bloqueado aparecen en la leyenda. Confirmada añade un icono de verificación sin cambiar el significado de los colores existentes.
- Los editores Nueva cita, Editar cita y Bloquear horario comparten encabezado, X, estructura, superficies, errores y acciones. Escritorio de hasta 860 px; pantalla completa en móvil; cuerpo desplazable y pie integrado siempre accesible.
- Selectores en dos columnas en escritorio, fecha/inicio/fin en una fila y notas/motivo a todo el ancho. En móvil, una columna. Los nombres largos pueden ocupar varias líneas.
- Los identificadores se conservan internamente; los selects muestran los nombres de los datos disponibles. La carga inicial espera los nombres de pacientes para evitar etiquetas genéricas transitorias.
- Cancelar, Escape, X y pulsación exterior piden confirmación si el formulario tiene cambios. Continuar editando conserva los valores. Un guardado fallido deja el formulario abierto; durante el guardado se bloquea el cierre accidental.

## Archivos del frontend

| Archivo dentro de `front/src/modules/appointments/` | Cambio |
| --- | --- |
| `pages/appointments-calendar-page.tsx` | Composición compacta, contenedor de calendario, agenda local, carga de etiquetas |
| `appointments-calendar.css` | Espacio disponible, desplazamiento, barra, leyenda y responsive |
| `components/appointments-toolbar.tsx` | Periodo integrado en el botón de fecha |
| `components/calendar-period.ts` — nuevo | Formato compartido del periodo visible, incluidos cruces de año |
| `components/calendar-date-navigator.tsx` | Etiqueta del periodo y apertura inferior explícita |
| `components/calendar-date-navigator.module.css` | Ancho compacto del popover |
| `components/calendar-time-content.tsx` | Señal de confirmación y leyenda de seis estados |
| `components/appointment-form-dialog.tsx` | Nueva/Editar cita: estructura común y nombres legibles |
| `components/schedule-block-form-dialog.tsx` | Bloqueo: misma estructura y nombres legibles |
| `components/schedule-form-dialog.tsx` — nuevo | Estructura accesible común y confirmación de descarte |
| `appointment-dialogs.css` — nuevo | Estilos exclusivos de los editores de citas y bloqueos |

Se reutilizan Dialog, DialogFooter/FormActions, ConfirmDialog, Field, FieldGroup, Input, Textarea, Select, Popover, Calendar y la biblioteca de iconos instalada. No se modifican sus implementaciones globales ni se agregan dependencias.

## Pruebas ejecutadas

Resultado final consolidado: **61 casos E2E únicos aprobados, sin fallos pendientes**. Chrome con los servicios de demostración existentes. Las comprobaciones no sustituyen una integración con un backend externo.

| Suite | Casos |
| --- | ---: |
| `appointments-polish.spec.ts` — nueva | 12 |
| `appointments-calendar-redesign.spec.ts` | 14 |
| `calendar-views-visual.spec.ts` | 6 |
| `calendar-single-date-today.spec.ts` | 10 |
| `calendar-selector-reference.spec.ts` | 4 |
| Casos de calendario de `frontend-redesign.spec.ts` | 12 |
| Pie de modal y viewport reducido de `form-actions.spec.ts` | 2 |
| Agendar desde la ficha de paciente, de `patients-redesign.spec.ts` | 1 |

Se comprobaron 320, 360, 375, 390, 430, 600, 768, 1024, 1280, 1440 y 1920 px en ambos temas. También selectores a 844×390 y 320×568, y acciones del modal a 375×360. Las pruebas cubren los tres editores, nombres precargados y largos, conservación de identificadores y estados, creación/edición, conflictos, bloqueos de profesional o consultorio, descarte de borradores y guardados desde Pacientes.

Las pruebas del calendario verifican que abrir el popover no cambia la geometría ni el desplazamiento de la página, su posición inferior cuando cabe, Escape y pulsación exterior, restauración del foco, una sola fecha y ausencia de rangos, ambos Hoy, años distantes y bisiestos, cruce de año, periodos, selección de intervalos horarios, geometría nativa de eventos, desbordamiento real y filtros.

Las pruebas existentes se ajustaron al nuevo periodo visible, conservando las comprobaciones de la fecha seleccionada en su etiqueta accesible y en el selector. `tests/helpers/calendar-layout.ts` espera la adaptación responsive antes de pulsar un control, evitando capturar la presentación que acaba de ocultarse durante una transición. Las pruebas con eventos adicionales invalidan explícitamente su caché de consultas tras preparar esas fixtures, sin cambiar servicios o datos de producción. Se conserva el resto de sus aserciones.

Build TypeScript/Vite: aprobado. Lint: aprobado, con las cinco advertencias previas. Vite mantiene el aviso previo de tamaño de chunks.

## Evidencias y límites

`front/test-results/appointments-polish/final-results.json` identifica el informe de ejecución que respalda cada caso. Las repeticiones sustituyen el resultado anterior del mismo caso; no se suman como pruebas nuevas.

`front/test-results/appointments-polish/review.html` ofrece un comparador de **30 capturas anteriores y 30 finales**, con Mes/Semana/Día, selector y tres editores, en claro/oscuro y escritorio/móvil. Se revisaron la composición, nombres, campos, acciones y ausencia de recortes en las capturas finales.

`scope-verification.json` compara los 346 archivos versionados iniciales: 332 permanecen idénticos y los 14 modificados pertenecen exclusivamente a Citas y sus pruebas. No hay archivos eliminados ni cambios en servicios, esquemas, modelos, autenticación, permisos, navegación principal, temas, pacientes, historia clínica, dependencias o biblioteca del odontograma. Las capturas del odontograma son idénticas byte por byte en ambos temas.

En viewports de hasta 600 px de altura se conserva un panel de 440 px para que las herramientas y la cuadrícula sigan siendo utilizables. El contenedor principal puede desplazarse para acceder al panel completo; las horas mantienen su desplazamiento interno. Abrir el selector no amplía el documento.

No se realizaron commits, pushes, resets ni cambios de rama. Los cambios permanecen locales para su revisión.
