# Auditoría y rediseño del Panel

## Auditoría previa — 14 de noviembre de 2026

Se revisaron `DashboardPage`, `KpiCard`, `PageHeader`, `Card`, los estilos de contenido, los tokens de ambos temas, los tipos de reportes, el cálculo del periodo mensual y las dos consultas del Panel. Se inspeccionaron también los consumidores de `KpiCard` en Finanzas, Reportes e Historia clínica y las pruebas relacionadas.

- El Panel utiliza `useReportsSummary(period)` y `useAgendaReport(period)`, con `getPresetPeriod("month")`. En demostración, ambas consultas derivan sus resultados de los datos existentes de los módulos; en modo API conservan sus endpoints de reportes.
- Las tarjetas usan `items-start`; el texto secundario queda debajo del valor. La medición previa muestra tres tarjetas de 80,98 px y «Citas este mes» de 101,78 px. Además, «1 completadas» no concuerda en singular.
- La clase `clinic-kpi-icon` fuerza el mismo turquesa sobre los tonos semánticos. `KpiCard` es compartido: cambiar su distribución por defecto afectaría a otros módulos.
- El gráfico ya recibe `agenda.byDay` con todos los días, sus etiquetas y totales; dispone de Tooltip y ejes. Su encabezado no contextualiza el mes ni muestra el total disponible.
- Las alertas globales ya tienen un centro propio. No se duplicarán ni se incorporarán indicadores nuevos sin fuente. El stock crítico existente se destacará con una señal ámbar discreta.
- Se guardaron capturas previas en ambos temas para 320, 375, 430, 768, 1024, 1280, 1440 y 1920 px, junto con valores y datos diarios. Valores observados: 5 pacientes, 6 citas, 1 completada, 2 tratamientos en curso y 2 insumos bajo mínimo.

## Alcance acordado con el documento

Reutilizar los componentes actuales. Añadir una variante optativa de presentación de KPI, activada exclusivamente en el Dashboard, y estilos encapsulados. Conservar consultas, cálculos, datos, rutas, permisos y comportamiento del resto de módulos. Mejorar la lectura del gráfico sin transformar su serie diaria.

La evidencia local anterior a la implementación está en `front/test-results/dashboard-redesign/before/`, y las copias y hashes de los archivos en `front/test-results/dashboard-redesign/`.

## Implementación y validación

### Archivos

- `front/src/app/pages/dashboard-page.tsx`: composición del Panel, tonos de los indicadores, concordancia dinámica, encabezado y presentación del gráfico, estados de carga, vacío y error.
- `front/src/app/pages/dashboard-page.module.css` (nuevo): estilos encapsulados y cuadrícula que responde al ancho real del contenido.
- `front/src/modules/reports/components/kpi-card.tsx`: variante optativa `layout="split"`. La variante por defecto conserva la estructura y clases anteriores para sus otros consumidores.
- `front/tests/dashboard-redesign.spec.ts` (nuevo): datos, disposición, colores, tooltip, teclado, concordancia, stock, carga y recuperación de errores.
- `front/tests/phase4-density.spec.ts`: adaptación de la medición geométrica a las dos filas del Panel; se mantienen las comprobaciones anteriores para los otros módulos.
- Este informe.

### Mejoras visuales y de experiencia de usuario

- Cuatro tarjetas de **114 px** en los 16 estados capturados, con padding uniforme. Título e icono ocupan la primera fila; valor e información complementaria, la segunda. «1 completada» queda a la derecha y comparte la línea base del valor.
- Iconos con fondos discretos: turquesa para pacientes, primario del tema para citas, verde clínico para tratamientos y ámbar para stock crítico. Las tarjetas conservan sus superficies neutras y no simulan ser botones.
- El stock crítico muestra un borde ámbar sutil y «Reabastecer» únicamente cuando la fuente indica insumos bajo mínimo. El estado sin stock crítico vuelve a ser neutro.
- El gráfico identifica el mes consultado y muestra el total existente. Conserva todos los días y totales de `agenda.byDay`; utiliza barras violetas o Acid Lime, ejes enteros y etiquetas separadas. El tooltip muestra fecha completa, cantidad y concordancia; se elimina el desplazamiento animado que podía dejarlo temporalmente fuera de la pantalla al reducir el ancho. Se conserva la consulta mediante teclado.
- Cuadrícula de una columna en móvil, dos en tablet y cuatro cuando el contenido tiene espacio suficiente. Los controles existentes conservan sus áreas de interacción.
- La carga utiliza skeletons sin cambiar la altura de las tarjetas. Una consulta fallida muestra un aviso y permite reintentar esa misma consulta. Sin datos disponibles se muestra «—», evitando presentar ceros ficticios; si existe información en caché, se conserva y se indica que no pudo actualizarse. Un mes realmente vacío muestra un mensaje específico.
- Se mantiene el acceso «Ver reportes» exclusivamente para administradores. No se duplican las alertas del Header ni se incorporan nuevos indicadores.

### Funcionalidades conservadas y comparación de datos

La comprobación por hashes confirma que no cambiaron consultas, endpoints, modelos, cálculos, mocks, autenticación, rutas, permisos, Sidebar, Header ni otros módulos. Los únicos cambios de implementación son los tres archivos indicados arriba, incluido el CSS nuevo.

La comparación previa/posterior de los 16 estados confirma los mismos valores **5 / 6 / 2 / 2**, la misma cita completada y la igualdad completa del objeto de resumen y de la serie diaria. La aplicación continúa usando sus fuentes actuales; las comprobaciones se ejecutaron en modo demostración, con agregaciones reales de los datos de ejemplo existentes. No constituyen una validación de un backend de producción.

### Pruebas y resultados reales

- `npm run build`: aprobado.
- `npm run lint`: sin errores; cinco advertencias preexistentes.
- Chrome / Playwright: **22 aprobadas, 0 fallos, 0 omitidas, 0 reintentos** en la ejecución final: seis casos nuevos del Panel, seis de densidad y composición compartida, ocho de interacciones globales y dos del Panel dentro del sistema de diseño global.
- Capturas antes y después en ambos temas para 320, 375, 430, 768, 1024, 1280, 1440 y 1920 px. Se revisaron visualmente las composiciones de escritorio y móvil.
- Las pruebas existentes amplían la comprobación del Panel a 360, 390 y 600 px: **11 anchos en ambos temas**, sin scroll horizontal global. Los indicadores también se comprobaron en Finanzas, Reportes e Historia clínica.
- Comprobados tooltips dentro de la pantalla, fechas y cantidades, etiquetas de eje sin solapamiento, acceso por teclado, navegación a Reportes, tema, foco, formularios y tamaños de pantalla reducidos.
- Casos de datos: «0 completadas / 1 completada / 2 completadas», ausencia de stock crítico, mes vacío, carga retenida, errores independientes, reintento y conservación de datos en caché.

Evidencias locales:

- [Comparación visual interactiva antes/después](../front/test-results/dashboard-redesign/review.html).
- [Comparación de fuentes y geometría](../front/test-results/dashboard-redesign/verification.json).
- [Resultado final de Playwright](../front/test-results/dashboard-redesign/final-e2e.json).
- [Captura clara de escritorio](../front/test-results/dashboard-redesign/after/light-1440.png) y [captura oscura móvil](../front/test-results/dashboard-redesign/after/dark-375.png).
- Logs `build.log` y `lint.log` en el mismo directorio. Las evidencias de `test-results/` son locales y están excluidas de Git.

No se observaron regresiones en los casos comprobados. Permanecen el aviso existente de chunks de más de 500 kB y las cinco advertencias de lint de componentes compartidos ajenos al cambio. No se añadieron dependencias ni se crearon commits. El servidor habitual continúa disponible en http://localhost:5173.
