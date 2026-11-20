# Historia clínica: espacios e indicadores periodontales

Implementación local del 15 de noviembre de 2026. Se mantuvieron los cambios anteriores. No se hicieron commits, pushes, resets ni cambios de rama.

## Auditoría

Se revisaron el listado general, encabezado e identidad del paciente, aviso de demostración, indicadores, navegación, datos personales y contacto, antecedentes, alergias, medicación, hábitos, plan, consentimiento y declaración, documentos, atenciones, tratamientos, citas, evolución, exportaciones y los seis pasos de Registrar atención.

El envío actual contiene el TXT de especificaciones. La auditoría visual utilizó el frontend real y las referencias visibles de la conversación. Se guardaron 62 capturas iniciales y sus 62 equivalentes finales, además de dos vistas móviles adicionales.

Los problemas principales fueron alturas diferentes entre indicadores, un cero de bolsas mostrado sin sondaje, un formulario del plan dentro de un segundo contenedor, vacíos con padding de 32–40 px, exportaciones distribuidas en demasiadas filas, campos con anchos iguales pese a contenidos distintos, antecedentes médicos extendidos hasta los extremos y hábitos organizados como filas completas.

## Componentes y presentación

Se reutilizaron `KpiCard`, `Card`, los campos clínicos compartidos, `ClinicalNavigation`, `ClinicalFormActions`, las tablas, el formulario de propuestas, el editor dental y los exportadores existentes. El único archivo nuevo de estilos pertenece al módulo clínico. No se introdujeron dependencias ni otra arquitectura CSS.

| Área | Cambio |
| --- | --- |
| Indicadores superiores | Filas compartidas mediante subgrid para alinear títulos, iconos, valores y detalles. Dos columnas en móvil y cuatro cuando cabe el contenido; alturas naturales iguales dentro de cada fila. |
| Indicadores periodontales | Adaptador de presentación que distingue ausencia de sondaje, cero válido y conteos positivos, utilizando resultados existentes. |
| Encabezado y demostración | Se conserva la identidad, los avisos y todo el mensaje de almacenamiento local. Menor separación general y padding del aviso. |
| Navegación | Menor padding vertical y separación entre título y selector. Se mantienen nueve secciones principales, orden y sección adicional de evolución. No hay controles duplicados. |
| Identificación | Nombres y ocupación reciben más ancho; documento, fecha y edad ocupan espacios proporcionales. Fechas de apertura y actualización se presentan como metadatos. |
| Contacto y emergencia | Cuadrículas contextuales; teléfono más corto que dirección/correo. Ambas categorías conservan paneles separados y todos sus campos. |
| Antecedentes médicos | Tabla de lectura con ancho máximo de 800 px. En móvil, antecedente seguido por Personal/Familiar. Se conservan los nombres accesibles completos y la exclusión de «Niega antecedentes relevantes». |
| Alergias y medicamentos | Menos separación entre listas y acciones. Vacíos breves junto a sus botones. No cambia el alta, eliminación ni validación. |
| Hábitos | Dos columnas de grupos cuando hay espacio. Nombre y Sí/No próximos; detalles condicionales debajo. No se preselecciona No. |
| Antecedentes dentales y periodontales | Cuadrículas de lectura limitada y referencias compactas a datos ya registrados. Cada referencia conserva su destino y una superficie de interacción adecuada. |
| Plan por fases | Una sola superficie; formulario sin tarjeta anidada. Catálogo más ancho, fecha contextual y botón alineado. Vacío en una línea cuando cabe. Fases, fechas, importes y acciones originales. |
| Consentimiento y declaración | Campos proporcionales y separación de 12–16 px. Se conserva literalmente el texto legal, las decisiones explícitas, documentos y validaciones. |
| Documentos | Vacío sin gran marco. Vista previa más contenida para imágenes y compacto identificador para documentos. Se conservan originales, formatos, tamaños, descarga y eliminación confirmada. |
| Atenciones | Paneles compactos y borde neutro. La atención seleccionada usa una señal lateral discreta. Detalle, alertas, notas, acciones y registro inmutable permanecen. |
| Tratamientos y citas | Encabezados y celdas locales más compactos; importes alineados. Las tablas conservan toda la información y desplazamiento local cuando lo necesitan. |
| Evolución | Más indicadores por fila cuando cabe, títulos y lecturas alineados. Se conservan las tres gráficas y sus escalas. |
| Exportaciones | Título y tres acciones comparten fila en escritorio; explicación completa debajo. Botones adaptados en móvil. Los exportadores y sus referencias permanecen. |
| Registrar atención | Menor padding y separación en los seis pasos, exploraciones y revisión. Se conserva espacio narrativo, controles de 40/44 px, progreso real, advertencias y confirmación. |
| Acciones inferiores | Se conserva la variante en flujo normal implementada anteriormente. Navegación y guardado permanecen separados; no se restauraron barras decorativas ni paneles sobre campos. |

## Cero frente a ausencia de sondaje

El adaptador lee `sitesProbed`, `sitesWithPocket` y `maxProbingDepth` del cálculo existente. No cuenta piezas nuevamente, no modifica umbrales ni escribe datos.

- Sin sondaje registrado válido: **Bolsas ≥ 4 mm: Sin evaluar**.
- Con sondaje registrado y sin bolsas: **Bolsas ≥ 4 mm: 0 sitios**.
- Con bolsas registradas: se muestra el conteo existente, por ejemplo **3 sitios**.

Sangrado conserva su porcentaje independiente. Las pruebas incluyen un resultado de **0 bolsas con 33 % de sangrado** y otro de **3 bolsas con 33 %**, para impedir que ambos indicadores se confundan.

La misma distinción se aplica a las tarjetas de evolución y a la lectura de bolsas de su gráfica externa de Recharts: un punto sin sondaje no se representa como un cero. Solo cambió el lector visual de esa serie; la serie calculada, el modelo `EvolutionPoint`, las otras medidas y los datos almacenados permanecen iguales. Se añadió una explicación visible cuando faltan mediciones.

Un cero válido se refiere a los sitios registrados; no establece por sí mismo un diagnóstico ni una evaluación de toda la boca.

## Comparación de espacio

Mediciones reales en 1440 px, tema oscuro y paciente de demostración sin atenciones. Las cifras son alturas del componente, no del viewport.

| Área | Antes | Después |
| --- | ---: | ---: |
| Fila superior de indicadores | 98 px, tarjetas desiguales | 93 px, tarjetas alineadas |
| Identificación, contacto y emergencia | 877 px | 737 px |
| Antecedentes | 3263 px | 2962 px |
| Plan vacío, incluido formulario | 318 px | 232 px |
| Consentimiento y declaración | 1033 px | 981 px |
| Documentos vacíos | 433 px | 357 px |
| Atenciones vacías | 203 px | 151 px |
| Tratamientos vacíos | 183 px | 131 px |
| Citas | 225 px | 218 px |
| Evolución, con explicación de ausencia de sondaje | 563 px | 529 px |
| Formulario de examen clínico | 1188 px | 1122 px |

Las advertencias, campos narrativos y textos legales no se eliminaron para obtener estas reducciones. Las 56 mediciones completas y las capturas están en los artefactos.

## Archivos de esta intervención

Modificados, respecto al estado local inmediatamente anterior:

1. `front/src/modules/clinical-history/components/record-workspace.tsx`
2. `front/src/modules/clinical-history/components/clinical-navigation.module.css`
3. `front/src/modules/clinical-history/components/patient-data-tab.tsx`
4. `front/src/modules/clinical-history/components/background-tab.tsx`
5. `front/src/modules/clinical-history/components/plan-item-form.tsx`
6. `front/src/modules/clinical-history/components/treatment-plan-tab.tsx`
7. `front/src/modules/clinical-history/components/data-consent-tab.tsx`
8. `front/src/modules/clinical-history/components/truth-declaration-card.tsx`
9. `front/src/modules/clinical-history/components/attachments-tab.tsx`
10. `front/src/modules/clinical-history/components/encounters-tab.tsx`
11. `front/src/modules/clinical-history/components/performed-treatments-tab.tsx`
12. `front/src/modules/clinical-history/components/patient-appointments-tab.tsx`
13. `front/src/modules/clinical-history/components/periodontal-evolution-tab.tsx`
14. `front/src/modules/clinical-history/components/periodontal-evolution-chart.tsx` — lector visual de bolsas sin evaluación; no pertenece a la biblioteca dental.
15. `front/src/modules/clinical-history/components/export-card.tsx` — presentación; funciones de exportación intactas.
16. `front/src/modules/clinical-history/components/register-encounter.css`
17. `front/src/modules/clinical-history/pages/clinical-history-list-page.tsx`

Añadidos:

1. `front/src/modules/clinical-history/components/clinical-density.css`
2. `front/src/modules/clinical-history/components/periodontal-indicator-presentation.ts`
3. `front/tests/clinical-density.spec.ts`
4. Este informe.

## Pruebas y responsive

**51 pruebas automatizadas en Chrome aprobadas, sin fallos finales**, consolidadas por archivo y nombre para no contar dos veces las reejecuciones:

| Suite | Pruebas |
| --- | ---: |
| Historia clínica existente | 8 |
| Navegación clínica: integración, visual y dinámica | 24 |
| Registrar atención | 10 |
| Densidad, estados periodontales, plan, antecedentes y responsive | 9 |

Se comprobaron los **11 anchos solicitados**: 320, 360, 375, 390, 430, 600, 768, 1024, 1280, 1440 y 1920 px, ambos temas y sidebar expandido/contraído desde 768 px.

- 288 combinaciones de sección, tema, ancho y sidebar para las nueve áreas externas.
- 192 combinaciones equivalentes para los seis pasos de Registrar atención.
- Comprobación final adicional de 32 combinaciones para alineación de tarjetas, textos completos y ausencia de desbordamiento después del ajuste de dos columnas móvil.
- Teclado, controles seleccionados, campos condicionales, errores, persistencia explícita, notas largas, consentimientos, documentos, tratamientos, copia de alertas, citas vinculadas y exportaciones cubiertos por las suites ejecutadas.
- Datos de demostración en contextos aislados. Las pruebas periodontales introducen medidas por los controles existentes del editor y comprueban que no se guardan automáticamente.
- TypeScript y build Vite aprobados. Lint sin errores; conserva las cinco advertencias anteriores de Fast Refresh y React Compiler. Vite mantiene el aviso anterior de chunks mayores de 500 kB.

Durante la verificación se corrigió la pérdida del nombre accesible completo de Personal/Familiar al añadir sus etiquetas móviles. También se ajustaron los enlaces a antecedentes relacionados para conservar áreas de interacción suficientes y la alineación de títulos al envolver en dos columnas.

## Protección del odontograma y de los datos

La comparación SHA-256 contra 365 archivos del estado local anterior identifica únicamente los 17 archivos existentes listados como modificados; **348 permanecen intactos**.

Los **29 archivos protegidos** comprobados —biblioteca dental, embed, integración, APIs, almacenamiento, tipos, reglas, cálculos, hooks y manifiestos— no cambiaron. Las capturas del odontograma son idénticas byte a byte antes y después en ambos temas. El bloque de integración `OdontogramFrame` permanece idéntico al de Git.

No se alteraron la biblioteca, SVG, hitboxes, selección, mediciones, estilos internos, versión ni exportación del editor. La gráfica externa de evolución utiliza los resultados originales mediante un adaptador de presentación; no modifica fórmulas.

Las pruebas existentes verifican guardado, conservación de archivos y datos, inmutabilidad, notas aclaratorias, precios, tratamientos, citas y documentos exportados. Las pruebas nuevas verifican además que navegar y modificar un borrador no cambia los registros almacenados.

No se modificaron backend, modelos, contratos, permisos, persistencia, fórmulas del IMC, clasificación ASA/periodontal, tarifas ni inventario. Los tokens y la identidad de los temas permanecen intactos.

## Evidencias y límites

- [Capturas comparativas y tabla de alturas](../front/test-results/clinical-density/review.html).
- [Resultados consolidados, integridad y mediciones](../front/test-results/clinical-density/verification.json).
- [Matriz final de tarjetas](../front/test-results/clinical-density/kpi-final-matrix.json).
- Reportes originales, build, lint y capturas: `front/test-results/clinical-density/`, carpeta de artefactos ignorada por Git.

La verificación utiliza la API de demostración; no incluye un servidor clínico real. Las tablas de muchas columnas conservan desplazamiento horizontal dentro de su propio contenedor en móvil para mantener los datos y controles; la página no presenta desbordamiento global.

Localhost del usuario conservado en `http://localhost:5173`.
