# ClinicApp — Estandarización de UI/UX del contenido

Fecha de solicitud: 11 de noviembre de 2026. Frontend real: `ClinicApp-main/front`. Los tres adjuntos de esta solicitud son idénticos. Este informe describe la implementación vigente: nueve secciones clínicas principales y Evolución periodontal adicional. El informe anterior de navegación documenta una etapa previa.

## 1. Mejoras realizadas

Se compactaron tarjetas, controles, tablas y menús mediante componentes existentes y estilos delimitados al contenido. Se corrigió la paginación compartida y se mejoró la presentación de React Big Calendar. No se reconstruyeron páginas ni se añadieron dependencias. Se conservaron datos, acciones, rutas, permisos, validaciones y persistencia existentes.

## 2. Archivos modificados

Rutas relativas a `front/`:

| Archivo | Cambio |
| --- | --- |
| `src/styles/content-ui.css` | Nuevo módulo de densidad y jerarquía, limitado al contenido y sus diálogos. |
| `src/styles/app.css` | Importación del módulo, conservando el orden de las importaciones anteriores. |
| `src/modules/reports/components/kpi-card.tsx` | Clases reutilizables para tarjetas informativas compactas. |
| `src/shared/components/data-table.tsx` | Estilos específicos, identificación de columnas y eliminación de un borde duplicado. |
| `src/shared/components/pagination-bar.tsx` | Conteo real de páginas, límites válidos y controles condicionales. |
| `src/modules/clinical-history/lib/record-sections.ts` | Nueve destinos principales y un destino adicional. |
| `src/modules/clinical-history/hooks/use-section-navigation.ts` | Separación de destinos adicionales respecto a la secuencia. |
| `src/modules/clinical-history/components/clinical-navigation.tsx` | Agrupación del selector y posición de identificación y navegación. |
| `src/modules/clinical-history/components/clinical-navigation.module.css` | Menú compacto y adaptación al espacio disponible. |
| `src/modules/clinical-history/components/record-workspace.tsx` | Conexión del destino adicional y presentación del aviso de demostración. |
| `src/modules/appointments/appointments-calendar.css` | Estilos acotados al calendario, cuadrícula y controles. |
| `src/modules/appointments/pages/appointments-calendar-page.tsx` | Contenedor, texto del filtro profesional, altura y desplazamiento inicial. |

Pruebas y evidencias: se actualizaron `tests/clinical-navigation-dynamic.spec.ts`, `tests/clinical-navigation-integration.spec.ts`, `tests/helpers/clinical-navigation.ts`, `tests/fixtures/clinical-navigation.tsx` y la tolerancia geométrica de `tests/diagnoses-modal.spec.ts`. Se añadieron `tests/content-ui.spec.ts`, `tests/fixtures/pagination.html`, `tests/fixtures/pagination.tsx` y `scripts/capture-content-ui.mjs`, además de este informe.

Los cambios anteriores en `tests/dental-history.spec.ts` y `CLINICAL_NAVIGATION_DYNAMIC_REPORT.md` se conservaron íntegros. En Diagnósticos se mantienen las tres esperas de carga que ya existían y se admite únicamente el redondeo geométrico documentado abajo. La navegación, su hook y sus pruebas ya existían como trabajo local al comenzar esta solicitud; se evolucionaron sin descartarlos.

## 3. Componentes reutilizados

`Card`, `KpiCard`, `Button`, `Input`, `Select`, `Label`, `Badge`, `Table`, `DataTable`, `PaginationBar`, `DropdownMenu`, `Popover`, `Dialog`, `AlertDialog`, `SearchInput`, `ResponsiveFilterBar`, `PageHeader`, el calendario existente y la navegación clínica previa. Sus controles de teclado, focus y eventos siguen perteneciendo a las implementaciones existentes.

## 4. Componentes nuevos

No se crearon componentes nuevos de producto en esta etapa. Los fixtures nuevos sirven exclusivamente para probar la paginación real; no añaden rutas de producto ni estado de prueba a la aplicación.

## 5. Medidas y patrones

| Elemento | Patrón aplicado |
| --- | --- |
| Controles del contenido | Mínimo 38 px en escritorio; 44 px hasta 1023 px o con puntero táctil. |
| Inputs móviles | Texto de 16 px para mantener legibilidad y evitar el zoom de foco habitual en iOS. |
| Tarjeta KPI | Contenido mínimo 104 px; padding 16 px; separación 12 px; icono 36 px. |
| Tabla compartida | Encabezado 42 px; fila mínima 46 px; celdas 8 × 12 px. El contenido puede aumentar la altura. |
| Selector clínico | Ancho máximo 352 px y límite según viewport; altura máxima 320 px y límite según espacio disponible. |
| Opciones del selector | Mínimo 38 px en escritorio y 44 px en móvil/táctil; texto largo puede ocupar varias líneas. |
| Formularios administrativos y diálogos | Separación entre campos de 16 px y entre label/control de 6 px, conservando sus grids. |
| Calendario | Altura entre 600 y 760 px, dependiente del viewport; grupo horario mínimo 72 px. |

Son mínimos o límites adaptativos, no alturas rígidas para todos los contenidos. Se conservan las dimensiones funcionales del odontograma y periodontograma.

## 6. Tarjetas

Los resúmenes clínicos dejan de sumar padding exterior e interior innecesariamente. Mantienen exactamente sus valores, ayudas y cálculos. Números de 24 px y textos como «Por definir» o «Sin registro» de 21 px. Los iconos informativos usan una superficie neutra. No se añaden acciones, cursor de enlace ni apariencia de botón a las tarjetas informativas.

El aviso de demostración conserva su texto y significado; utiliza icono y superficie informativa compacta.

## 7. Tipografía

Se mantiene Inter. Títulos de página de 24 px en escritorio y 21 px en móvil; títulos de tarjeta de 17 px donde corresponde; cuerpo de 14 px; labels, botones y encabezados de tabla de 13 px; ayudas de 12 px. Se mantienen los títulos pequeños que ya responden a una función específica y las excepciones de legibilidad móvil. Los valores numéricos usan cifras tabulares.

## 8. Colores semánticos

Los tokens originales no se modificaron. Se conserva el violeta claro `#5350CC` y el primario oscuro Acid Lime `#E4F222`, con sus textos y superficies actuales. Fondo oscuro `#08090A`, superficies `#0F1011`/`#161718` y bordes `#23252A` permanecen en sus tokens existentes.

Las acciones primarias conservan el primario del tema. Navegación y acciones secundarias mantienen superficies discretas. La selección clínica usa acento sutil, peso de texto y check; la vista activa del calendario usa superficie discreta y línea de acento. Los colores de errores, advertencias, estados clínicos, financieros y eventos existentes no se reasignaron.

## 9. Menús e Historia clínica

El selector muestra «Secciones clínicas», nueve opciones numeradas, un separador y «Adicional» con Evolución periodontal sin número. La sección adicional no participa en el denominador ni en Anterior/Siguiente; muestra «Sección adicional». Las principales muestran «Sección X de 9».

Título y selector permanecen próximos. Anterior ocupa la izquierda y Siguiente la derecha; cada botón se omite si no existe un destino. Según el ancho efectivo del contenido, el único grupo de controles se coloca en la barra o al pie. No hay controles duplicados ni un segundo sidebar.

Guardar sigue siendo una acción independiente. Se conservaron la confirmación, la detección de cambios, el acceso directo y el iframe único del editor. Cambiar de sección no introduce autoguardado ni nuevas reglas de completitud.

## 10. Paginación

Las cinco pantallas que utilizan `PaginationBar` reciben el mismo comportamiento: Pacientes, Tratamientos, Insumos, Notificaciones e Historial clínico.

| Resultados/página | Presentación |
| --- | --- |
| Cero resultados | Sin barra de paginación. |
| Una página | Solo «Mostrando X–Y de Z». Sin botones ni «Página 1 de 1». |
| Primera de varias | Siguiente. |
| Intermedia | Anterior y Siguiente. |
| Última | Anterior. |

Las páginas se calculan desde `totalItems / pageSize`. Se normaliza una página fuera de rango mediante el callback existente al cambiar filtros, cantidad o tamaño. Los botones son `type="button"`. No se aplica esta regla a la navegación temporal de calendarios.

## 11. Calendario

Todos los selectores `.rbc-*` modificados están dentro de `.clinic-appointments-calendar`. La barra conserva Hoy, Ant., Sig., Mes, Semana y Día. Los bordes y subdivisiones tienen menos contraste; el día actual tiene un acento de baja intensidad. Los eventos conservan horario, paciente, estado y acceso a su detalle; bloqueos y cancelaciones mantienen sus estilos semánticos.

Se conservan las 24 horas, selección de intervalos, filtros, formularios, edición, cancelación y bloqueos. El desplazamiento inicial favorece la hora anterior al primer evento real del día/semana visible; si no hay eventos, usa la hora actual. No se inventó un horario laboral ni se establecieron límites horarios nuevos.

El filtro muestra «Todos los profesionales» en lugar del identificador interno `all`. En anchos compactos se mantiene la agenda existente de semana/día y el mes con desplazamiento local. La vista elegida se conserva al redimensionar.

## 12. Responsive

La matriz automatizada recorre 320, 360, 375, 390, 430, 600, 768, 1024, 1280, 1440 y 1920 px en ambos temas. Incluye 18 pantallas de contenido, formularios, perfiles, controles, etiquetas, primarios y ausencia de desbordamiento global. Las tarjetas móviles de tablas conservan columnas y acciones.

Se verifican sidebar expandido/contraído sin cambiar su implementación, orientación horizontal/vertical, menú clínico abierto al redimensionar, contextos táctiles, diálogos y popovers dentro del viewport, y zoom CSS de 200 %. Esta última prueba es emulación CSS, no una prueba manual del zoom nativo de cada navegador.

## 13. Sidebar, Header, Login y áreas protegidas

`AppLayout`, sus estilos, configuración de navegación, Login, estilos de acceso, primitives globales y tokens conservan sus hashes respecto al inicio de la tarea. La nueva densidad parte de `.clinic-app-canvas`, que corresponde al área `main`; el sidebar y el header son sus hermanos y quedan fuera. Los portales de contenido excluyen las hojas del sidebar y las pantallas de acceso.

Se compararon 12 capturas de estilos computados de Login/Header/Sidebar: dos temas, 390 y 1440 px. No hay diferencias de estilo o texto. Las cuatro imágenes de Login antes/después son idénticas por SHA-256. La captura inicial de geometría de escritorio coincidía con una transición de ancho del sidebar; por ello no se presenta como igualdad geométrica o de píxeles del header/sidebar. Su geometría se comprueba en las pruebas responsive e interacciones.

La auditoría de 220 archivos iniciales encontró 204 sin cambios y ninguna eliminación. También comparó el texto de 23 funciones existentes de guardado, navegación de salida, editor y calendario: todas permanecen iguales. Los cambios de la interfaz no alcanzan el SVG ni los estilos internos del iframe clínico.

## 14. Build y comprobaciones estáticas

`npm.cmd run build`: correcto, incluyendo TypeScript y Vite. Persiste el aviso conocido de chunks superiores a 500 kB. `npm.cmd run lint`: correcto, sin errores; cinco avisos en archivos anteriores que no se modificaron en esta tarea. `git diff --check`: correcto.

## 15. Pruebas ejecutadas

La suite completa se ejecutó contra `http://localhost:5173` con Chrome/Playwright y dos workers: **118 de 119 pruebas aprobadas en la primera ejecución (5,9 minutos)**. La restante comprobaba el borde inferior del modal de Diagnósticos con tolerancia cero. La medición real estable fue 844,25 px en un viewport de 844 px: el scroll nativo redondea su desplazamiento a píxeles enteros.

Se ajustó solo esa comprobación a una tolerancia de medio píxel, conservando las aserciones de límites, persistencia y solo lectura. La reejecución dirigida aprobó **1 de 1 en 17,4 segundos**. Resultado combinado: **119 comprobaciones verificadas**. Se conservan ambos informes; no se presenta la primera pasada como una ejecución sin fallos. Evidencia geométrica: `diagnoses-geometry.json`.

Cobertura ejecutada: navegación clínica genérica con listas de 1/2/3/10 destinos; integración con nueve principales y una adicional; borradores y guardado independiente; pruebas clínicas, exportaciones y diagnóstico; paginación con 0/1/4/20/30 registros y cambios de filtros/tamaño; búsqueda y precio de tratamientos; dimensiones de KPI y menú; calendario con creación, edición, cancelación, bloqueos y selección real de un intervalo; autenticación, perfiles y la matriz responsive.

Las pruebas nuevas se ajustaron durante su desarrollo al texto real del estado vacío, a la coexistencia de tablas/tarjetas responsive y al cierre explícito del detalle de cita que ya mantiene la aplicación. La selección de intervalos usa el puntero sobre el overlay nativo de React Big Calendar.

Comandos ejecutados desde `front/`:

```powershell
$env:CLINIC_TEST_URL='http://localhost:5173'
$env:PLAYWRIGHT_JSON_OUTPUT_FILE='test-results/ui-standardization/full-suite.json'
npm.cmd run test:e2e -- --workers=2 --output=test-results/ui-standardization/full-suite --reporter=line,json --max-failures=5
$env:PLAYWRIGHT_JSON_OUTPUT_FILE='test-results/ui-standardization/diagnoses-recheck.json'
npm.cmd run test:e2e -- tests/diagnoses-modal.spec.ts --output=test-results/ui-standardization/diagnoses-recheck --reporter=line,json
```

También se ejecutaron 20 pruebas dirigidas de navegación, pasadas de desarrollo de las 18 pruebas nuevas y la captura comparativa antes/después. Estas ejecuciones adicionales no se suman como casos distintos a los 119.

Evidencias locales en `test-results/ui-standardization/`: `full-suite.json`, `diagnoses-recheck.json`, `source-verification.json`, `protected-comparison.json` y directorios `before/`, `after/` y `full-suite/`. Son artefactos ignorados por Git. Las capturas de comparación usan una fecha fija y datos de demostración.

## 16. Límites

Las comprobaciones se ejecutan con Chrome automatizado y los datos mock existentes. No sustituyen pruebas manuales en dispositivos físicos, Safari/Firefox, lector de pantalla o backend real. No se añadieron persistencia, autoguardado ni garantías nuevas para borradores internos de subformularios que antes dependían de su montaje. La confirmación y protección de cambios existentes siguen siendo las originales.

## 17. Git y ejecución local

Rama local `main`, HEAD `205fec7e5b4b1d4ab1b8a490fa6bc1ea06e8b3b0`, coincidente con la referencia local `origin/main` al verificar. No se realizaron commits, pushes, resets ni cambios de rama durante esta tarea. Se conservaron los cambios locales anteriores.

La aplicación continúa disponible en **http://localhost:5173**. Las modificaciones de esta solicitud permanecen locales para revisión.
