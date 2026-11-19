# Historia clínica y Registrar atención

Implementación local del 15 de noviembre de 2026, sobre el frontend existente. Se conservaron los cambios locales anteriores del calendario. No se crearon commits, ramas ni publicaciones remotas.

## Auditoría y alcance

El formulario existente ya resolvía los seis pasos con React Hook Form, un esquema Zod compartido, citas vinculables, tratamientos del catálogo, exámenes solicitados y confirmación antes de registrar una atención inmutable. Se reutilizaron estos mecanismos.

Los defectos identificados fueron una barra de acciones `sticky` que podía cubrir campos, controles de selección demasiado pequeños, exploraciones excesivamente anchas, «No evaluado» con apariencia de acción primaria y checks del stepper basados en la posición visitada. La revisión omitía por completo las secciones vacías y no orientaba al usuario hacia los datos obligatorios pendientes.

También se revisaron la identidad del paciente, indicadores, navegación clínica, antecedentes, alertas, hábitos, plan, consentimientos, documentos, atenciones, tratamientos, citas, evolución periodontal y exportaciones. Se conservaron los componentes ya resueltos. La estandarización de sus controles externos se obtiene mediante los controles compartidos de Historia clínica; no se reconstruyeron páginas ni se aplicaron acordeones exclusivos a formularios clínicos.

## Cambios

- **Acciones:** `ClinicalFormActions` coloca las acciones después del contenido, sin fondo, tarjeta, borde, sombra ni posición fija. Se reutiliza en Registrar atención y en las acciones de cambios pendientes de Historia clínica. Cancelar queda al inicio; Anterior, Siguiente y Guardar al final. Los footers de modales conservan su implementación.
- **Stepper:** conserva los seis destinos y las reglas de avance. Las marcas de datos válidos se calculan leyendo el esquema y el resumen existentes. Visitar un paso vacío no lo completa. Los errores se señalan cuando la validación del formulario los ha mostrado y siguen siendo actuales. La franja tiene desplazamiento horizontal local cuando resulta necesario.
- **Motivo:** cita, fecha y profesional en una cuadrícula contextual. Los campos narrativos siguen ocupando el ancho disponible. Se conserva la precarga desde una cita.
- **Signos y riesgo:** cuadrícula de hasta cuatro columnas, ancho máximo de 900 px para medidas cortas, unidades asociadas, IMC calculado de solo lectura y eliminación del placeholder clínico de ejemplo. ASA utiliza controles de 40/44 px. Los cuatro indicadores de riesgo se agrupan en dos columnas cuando hay espacio; la interconsulta sigue siendo el examen solicitado existente.
- **Examen:** se conservan las 6 exploraciones extraorales y las 8 intraorales. Dos columnas de exploraciones en contenedores amplios y una en espacios reducidos. Normal tiene un acento positivo, Alterado uno de advertencia y No evaluado uno neutro. Los hallazgos escritos se conservan al alternar estados. «Marcar todo como normal» sigue siendo una acción explícita. Se conservan dolor y ambos riesgos.
- **Diagnóstico:** edición de diagnósticos con anchos adaptables, vacío compacto y acciones accesibles. Se conservan texto libre/CIE-10, prioridades, pronóstico, todos los componentes periodontales de 2017, factores modificadores y mantenimiento.
- **Tratamientos y evolución:** se reutilizan catálogo, zona, costos, propuestas y exámenes. La presentación compartida amplía los controles y mantiene las áreas narrativas redimensionables. No se añadieron límites de texto. Los límites existentes del esquema permanecen intactos.
- **Revisión:** muestra fecha, profesional y cita; agrupa los datos actuales por paso, indica exploraciones sin evaluar, incluye tratamientos y exámenes y permite volver a editar cada grupo. Las indicaciones de campos pendientes provienen del esquema existente. Se mantiene visible la advertencia de registro definitivo. No hay autoguardado ni diagnósticos generados automáticamente.
- **Accesibilidad:** etiquetas existentes, estados `aria-checked`/`aria-invalid`, navegación de radios con flechas, Inicio y Fin, foco visible y estados seleccionados diferenciados sin depender solo del color. Las transiciones duran 160 ms y respetan movimiento reducido.
- **Temas:** se utilizan los tokens actuales: violeta institucional claro y Acid Lime oscuro para interacción. Los resultados clínicos conservan sus colores semánticos.

## Archivos

Modificados:

1. `front/src/modules/clinical-history/components/register-encounter-form.tsx`
2. `front/src/modules/clinical-history/components/form-controls.tsx`
3. `front/src/modules/clinical-history/components/record-workspace.tsx` — únicamente importación y presentación de acciones externas.
4. `front/src/modules/clinical-history/components/encounter-steps/step-reason.tsx`
5. `front/src/modules/clinical-history/components/encounter-steps/step-vitals.tsx`
6. `front/src/modules/clinical-history/components/encounter-steps/step-exam.tsx`
7. `front/src/modules/clinical-history/components/encounter-steps/step-diagnosis.tsx`

Añadidos:

1. `front/src/modules/clinical-history/components/clinical-controls.css`
2. `front/src/modules/clinical-history/components/clinical-form-actions.tsx`
3. `front/src/modules/clinical-history/components/clinical-form-actions.css`
4. `front/src/modules/clinical-history/components/encounter-review.tsx`
5. `front/src/modules/clinical-history/components/register-encounter.css`
6. `front/tests/clinical-encounter-redesign.spec.ts`
7. Este informe.

## Verificación

**42 pruebas E2E aprobadas, sin fallos finales:**

| Suite | Pruebas |
| --- | ---: |
| Historia clínica existente (`dental-history.spec.ts`) | 8 |
| Navegación clínica existente: integración, visual y dinámica | 24 |
| Registrar atención: progreso, controles, borrador, guardado y responsive | 10 |

La suite existente comprueba guardado confirmado, precarga y finalización de citas, evaluaciones, tratamientos y costos, integración de exámenes/documentos, notas aclaratorias, copia de alertas, editor dental y exportaciones. Las pruebas nuevas comprueban que navegar o revisar no escribe registros, que las notas largas se conservan y que se guarda una sola atención al confirmar.

Se comprobaron los seis pasos en **320, 360, 375, 390, 430, 600, 768, 1024, 1280, 1440 y 1920 px**, ambos temas y ambos estados del sidebar desde 768 px: 192 combinaciones de ancho, tema, sidebar y paso. También se verificaron pantallas de 320×568, 768×400 y 1440×720. Los controles visibles caben, las acciones se alcanzan mediante scroll y no existe desbordamiento horizontal de la página. El stepper puede desplazarse dentro de su propia franja.

Se corrigió durante la verificación un desbordamiento causado por las etiquetas ocultas del stepper a 320 px; ahora permanecen dentro del contenedor de cada botón. Los campos ocultos internos de Base UI se excluyen de las mediciones de áreas táctiles.

- TypeScript y build Vite: aprobados.
- Lint: sin errores; permanecen las 5 advertencias anteriores de Fast Refresh y compatibilidad de React Compiler en componentes ajenos a este cambio.
- Vite conserva su advertencia anterior de chunks mayores de 500 kB.
- Pruebas ejecutadas en Chrome con datos de demostración aislados. No se crearon registros clínicos en un servidor real.

## Protección e integridad

La comparación SHA-256 contra el estado local previo confirma **351 archivos anteriores intactos** y solo los 7 archivos existentes listados como modificados. Los 30 archivos protegidos comprobados —biblioteca dental, integración, embed, tipos, APIs, almacenamiento, reglas, cálculos, hooks y manifiestos de dependencias— no cambiaron.

Las capturas del odontograma del paciente de prueba son idénticas byte a byte antes y después, tanto en claro como en oscuro. Las pruebas existentes siguen ejercitando su selección, datos, instantáneas y exportación. En `record-workspace.tsx` se conservó íntegramente el bloque de integración del editor.

No se modificaron backend, contratos, persistencia, permisos, fórmulas del IMC, categorías ASA/periodontales, validaciones, reglas de citas, precios, stock, inmutabilidad ni sistema de temas.

## Evidencias locales

- [Comparación visual antes/después y capturas adicionales](../front/test-results/clinical-encounter/review.html).
- [Integridad de archivos y resultados consolidados](../front/test-results/clinical-encounter/verification.json).
- Carpeta `front/test-results/clinical-encounter/`: 26 capturas iniciales, 36 finales, reportes E2E, matriz responsive adjunta, build y lint. Los artefactos de prueba permanecen en la carpeta ignorada por Git.

El localhost del usuario continúa disponible en `http://localhost:5173`.
