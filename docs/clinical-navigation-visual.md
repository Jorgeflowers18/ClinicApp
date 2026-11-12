# Navegación clínica: menú compacto y jerarquía de acciones

Implementación local del 12 de noviembre de 2026. Alcance: «Ver secciones», su desplegable y los botones Anterior/Siguiente de Historia clínica.

## Resultado

- **Anterior:** superficie secundaria visible, borde discreto y texto neutro. En oscuro utiliza Graphite.
- **Siguiente:** superficie tonal construida con el primario existente; violeta en claro y Acid Lime en oscuro. Mezcla del 10 % para el fondo, 16 % en hover y 45 % para el borde.
- **Guardar cambios:** conserva su componente, color primario sólido, confirmación y funcionamiento anteriores. Navegar sigue sin guardar automáticamente.
- **Ver secciones:** icono de lista con el primario del tema, superficie neutra, chevron y borde de acento al abrir. Altura de 38 px en escritorio y al menos 44 px en pantallas pequeñas o con puntero táctil.
- **Desplegable:** alineación inicial al borde izquierdo del botón, separación de 8 px y margen de colisión de 8 px. Base UI gestiona el cambio de lado y los límites del viewport; no se añadieron cálculos de posición.
- **Opciones:** filas de 36 px en escritorio y al menos 44 px en móvil, con altura natural si el texto necesita más líneas. Numeración, etiqueta y check ocupan columnas estables. La selección tiene superficie diferenciada, texto semibold e indicador interior de 2 px con el primario; el hover tiene una superficie distinta.
- **Lista:** conserva las nueve secciones principales y «Evolución periodontal» dentro del grupo adicional, sin numerarla como una décima sección. Alto natural limitado al menor valor entre 320 px y el espacio disponible, con scroll interno.

No se cambiaron tokens globales, dependencias ni componentes UI compartidos. La ubicación de los controles en la barra o al final del contenido sigue dependiendo del espacio disponible, mediante el mecanismo existente.

## Archivos de esta intervención

| Archivo | Cambio |
| --- | --- |
| `front/src/modules/clinical-history/components/clinical-navigation.tsx` | Anclaje nativo del menú, icono del selector y clases locales para grupos y alineación. |
| `front/src/modules/clinical-history/components/clinical-navigation.module.css` | Superficies, estados, dimensiones, alineación y objetivos táctiles locales. |
| `front/tests/clinical-navigation-visual.spec.ts` | Cuatro pruebas sobre anclaje, selección, scroll interno, jerarquía visual y navegación independiente del guardado. |
| `docs/clinical-navigation-visual.md` | Este informe. |

Los cambios preexistentes de otras fases permanecen. No se hicieron commits ni publicaciones.

## Comparación medida

En Chrome, a 1440 × 1000 px, ambos temas produjeron la misma geometría:

| Medición | Antes | Después |
| --- | --- | --- |
| Borde izquierdo del botón | 523,81 px | 523,81 px |
| Borde izquierdo del menú | 312 px | 524 px |
| Ancho del menú | 352 px | 336 px |
| Alto de las filas principales | 38 px | 36 px |
| Separación entre botón y menú | ~4 px | ~8 px |

A 390 px, el menú queda en x = 29 px, alineado con el botón, con 336 px de ancho y filas de 44 px. Cuando falta espacio debajo, el componente lo abre arriba. El límite de 320 px no impone una altura fija a listas cortas.

Capturas locales: [oscuro, escritorio](../front/test-results/clinical-navigation-visual/after/clinical-menu-dark-1440.png), [claro, escritorio](../front/test-results/clinical-navigation-visual/after/clinical-menu-light-1440.png), [oscuro, móvil](../front/test-results/clinical-navigation-visual/after/clinical-menu-dark-390.png), [claro, móvil](../front/test-results/clinical-navigation-visual/after/clinical-menu-light-390.png).

## Verificación del alcance

Se guardó una referencia de 231 archivos antes de editar. La comparación SHA-256 posterior encuentra cambios únicamente en los dos archivos de producto indicados; no hay archivos anteriores eliminados. `NavigationButtons`, `ClinicalNavigationFooter` y los tres callbacks de navegación coinciden con la referencia.

Login, Header y Sidebar coinciden en 12 capturas de geometría y estilos, combinando ambos temas y anchos de 390/1440 px. Las cuatro imágenes de Login coinciden byte por byte. Se mantienen el Sidebar, su indicador activo y su Switch, así como la reversión del rediseño de tablas solicitada previamente.

Los hooks de navegación, las secciones disponibles, `RecordWorkspace`, los formularios, el guardado, los editores clínicos, el calendario, las tablas, las APIs y los tokens permanecen sin cambios respecto al inicio de esta intervención.

Evidencia local: [comparación de alcance](../front/test-results/clinical-navigation-visual/scope-verification.json).

## Pruebas y resultados

Build de producción correcto. Lint correcto, con los cinco avisos anteriores en componentes ajenos a esta intervención: dos por bibliotecas incompatibles con memoización y tres por exportaciones de Fast Refresh. `git diff --check` no detecta errores de espacios. Vite mantiene su aviso anterior de tamaño de chunk.

Se ejecutaron las pruebas pertinentes con Chrome y datos de demostración en `http://localhost:5173`:

| Suite | Resultado |
| --- | --- |
| `clinical-navigation-dynamic.spec.ts` | 12/12 |
| `clinical-navigation-integration.spec.ts` | 8/8 |
| `clinical-navigation-visual.spec.ts` | 4/4 |
| `dental-history.spec.ts` | 8/8 |
| `periodontal-matrix.spec.ts` | 1/1 |
| `diagnoses-modal.spec.ts` | 0/1; fallo también reproducido con la navegación anterior. |

**Total inicial: 33 pruebas aprobadas y un fallo.** No se ocultó ni se modificó la prueba fallida.

Las pruebas de navegación verifican ambos temas y los anchos **320, 360, 375, 390, 430, 600, 768, 1024, 1280, 1440 y 1920 px**. También cubren cambios de viewport con el menú abierto, navegación dinámica con diferente número de secciones, ausencia de controles innecesarios, acceso directo a las nueve secciones y a la adicional, Escape y retorno del foco, navegación por teclado, contraste del texto medido de al menos 4,5:1 y ausencia de desbordamiento horizontal.

Se comprobó que End permite llegar a la última opción mediante scroll interno sin desplazar el contenedor principal. La selección cierra el menú y devuelve el foco al selector. Las pruebas de integración conservan borradores del paciente y del odontograma durante la navegación, mantienen el mismo iframe y verifican que navegar no escribe el historial persistido. Las pruebas de guardado independientes de navegación también aprobaron.

### Incidencia anterior al ajuste visual

`diagnoses-modal.spec.ts:78` no encuentra el diagnóstico del caso después de guardar y recargar. Falló en la ejecución conjunta y al repetirla de forma aislada. Para contrastarlo, se ejecutó la misma prueba en un servidor temporal que sirvió **las versiones anteriores exactas de los dos archivos modificados**, sin sobrescribir el código de trabajo. Falló nuevamente en el mismo punto. El servidor temporal se cerró; localhost:5173 permaneció activo.

Esta comprobación sitúa el fallo fuera del cambio visual de navegación. No determina por sí sola la causa de la persistencia ni garantiza el guardado de ese diagnóstico concreto. Conforme al alcance solicitado, no se modificaron guardado, formularios ni editor clínico para resolverlo.

Evidencias: [ejecución completa](../front/test-results/clinical-navigation-visual/regression.json), [repetición aislada](../front/test-results/clinical-navigation-visual/diagnoses-recheck.json), [resultado con la navegación anterior](../front/test-results/clinical-navigation-visual/diagnoses-baseline.json), [confirmación de archivos anteriores servidos](../front/test-results/clinical-navigation-visual/diagnoses-baseline-overlay.json).

La comprobación responsive se realizó con viewports automatizados de Chrome. No se afirma una revisión manual en dispositivos físicos, con teclado virtual real ni con lectores de pantalla. Se conserva la semántica del componente Base UI existente; no se añadió lógica propia para forzar el scroll al abrir.

Las capturas y los JSON de evidencia están en `front/test-results/clinical-navigation-visual/`, directorio local ignorado por Git.
