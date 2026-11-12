# Guía de presentación del contenido de ClinicApp

## Identidad y semántica

El tema claro conserva el violeta `#5350CC`, tarjetas blancas y fondos claros. El oscuro conserva Void `#08090A`, Carbon `#0F1011`, Obsidian `#161718`, Graphite `#23252A`, texto blanco/Mist y Acid Lime `#E4F222`. Los componentes consumen `--primary`, `--primary-foreground`, `--card`, `--muted`, `--accent`, `--border` y `--ring`; los hexadecimales de referencia no se copian en sus reglas.

El acento comunica una acción principal, selección o foco. No decora tarjetas, cifras o superficies completas. Las acciones secundarias usan superficies neutras. Las pestañas y vistas activas combinan superficie discreta, texto con más peso y una línea de 2 px con el primario del tema. Menús/selectores usan check y un indicador lateral discreto. Los estados clínicos, financieros y de error/advertencia conservan sus tokens y significados actuales.

En Fase 4, los iconos de resumen pueden usar información, éxito, advertencia o error según el concepto que identifican, con superficies suaves de 32 px. Ese tono no cambia las cifras, no añade estados de negocio y no colorea toda la tarjeta. Las cantidades, unidades y símbolos monetarios conservan su agrupación y formato original.

## Tipografía, espacio y dimensiones

Inter; títulos de página 24 px y 21 px en móvil, sección 17–18 px, cuerpo 14 px, labels/botones 13 px, metadatos 12–13 px y valores KPI 24 px o 21 px si son textos extensos. Se mantienen las excepciones de legibilidad y del editor clínico.

Espacios de 4/8/12/16/20/24 px según relación. Controles habituales de contenido de 38 px en escritorio y al menos 44 px en móvil/táctil; las celdas de fecha se ajustan al ancho real para conservar los siete días en 320 px. En Fase 4, los KPI pasan a altura natural, padding de 12–16 px e iconos en contenedores de 32–36 px. Label y valor quedan próximos; símbolo e importe conservan un único texto formateado. No se impone el mínimo anterior de 104 px ni una altura que corte texto.

## Tablas y acciones

Encabezados de 42–44 px con superficie neutra distinta del cuerpo. Celdas de 14 px, separadores discretos y filas naturales con mínimo orientativo de 46 px. Nombres y categorías conservan su jerarquía; importes, stock y cantidades usan cifras tabulares y alineación coherente. No se alteran valores ni moneda. El estado de stock conserva su badge actual.

Las acciones de tres puntos conservan callbacks y foco; las filas clicables mantienen teclado y cursor apropiados. Las tarjetas móviles conservan todos los campos y acciones. Se mantiene la paginación derivada del total real: cero sin barra; una página solo rango; varias con direcciones disponibles. No se aplica esta regla a fechas del calendario.

## Formularios y Notificaciones

Se conservan grids y anchos contextuales. Inputs breves no se convierten en párrafos ni textareas en campos de una línea. En móvil se mantiene texto de entrada de 16 px. Los diálogos conservan scroll interno y focus.

Notificaciones agrupa variables insertables y mensaje como área de edición, con vista previa adyacente cuando hay ancho y debajo en móvil. Guardar utiliza exclusivamente `isDirty` e `isSubmitting` existentes. No se inventan estados de guardado ni se cambia la plantilla o sustitución de variables.

## Calendario y selector de fecha

Toolbar con navegación temporal a la izquierda, título interactivo al centro y vistas a la derecha; se reorganiza cuando el contenedor se estrecha. La vista activa usa subrayado semántico, el resto superficies neutras. Se conservan líneas suaves, todos los horarios y estilos existentes de eventos/bloqueos.

El título abre un popover de aproximadamente 336 px, limitado por viewport y espacio disponible, con selección directa del mes en español, ingreso de año y cuadrícula de días. Se conserva también el avance/retroceso de un mes del selector anterior. El día elegido utiliza el primario; hoy y los días de otro mes tienen indicadores discretos. Explorar mes/año no cambia la vista de RBC. Seleccionar día actualiza su estado de fecha existente y cierra el popover con retorno de foco. No hay conversión a UTC ni cambios de zona horaria. La agenda compacta reutiliza el mismo selector.

## Aislamiento y accesibilidad

Los estilos generales de contenido parten de `.clinic-app-canvas`; los componentes específicos usan clase de feature o CSS Module. Fase 4 autoriza dos cambios puntuales del Sidebar: indicador activo del primario y Switch real de «Modo oscuro», ON en oscuro y OFF en claro. Se mantienen la selección existente de React Router, anchos, rutas, navegación, expansión, permisos y persistencia. Header, Login y documento interno del odontograma permanecen protegidos. Se reutilizan primitivas existentes para teclado, Escape, foco, nombres accesibles y scroll.

Verificar ambos temas en 320/360/375/390/430/600/768/1024/1280/1440/1920 px, orientaciones, viewport reducido, sidebar abierto/cerrado y zoom emulado. Las pruebas automatizadas no equivalen a una certificación WCAG ni a pruebas físicas en todos los dispositivos.
