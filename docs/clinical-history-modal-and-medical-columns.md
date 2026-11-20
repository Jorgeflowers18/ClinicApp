# Historia clínica: antecedentes y modal de atención

Implementación local del 15 de noviembre de 2026. Alcance: los dos últimos documentos y las indicaciones sobre acordeones exclusivos en los pasos 2–5.

## Auditoría y resultado

Registrar atención tenía una ruta propia, React Hook Form, un esquema de validación compartido y seis pasos. Se reutilizaron esos componentes, sus campos, sus opciones y su operación de guardado. La tabla médica anterior limitaba su ancho a 800 px y dejaba espacio libre a la derecha.

- Los 19 antecedentes se presentan en dos grupos de 10 y 9, con columnas Antecedente, Personal y Familiar. Se conserva el orden de lectura y tabulación: primero el grupo izquierdo y después el derecho. Una consulta al ancho del contenedor activa las dos columnas; en móvil se apilan. «Niega antecedentes relevantes», «Otro» y sus validaciones mantienen su funcionamiento.
- Las listas de antecedentes odontológicos, periodontales y alertas aprovechan el ancho con una cuadrícula adaptable. No se aplica una compactación general a todos los formularios.
- Registrar atención utiliza el Dialog existente, con un ancho máximo de 1344 px y una altura limitada al viewport. En móvil ocupa la pantalla. El encabezado y el selector permanecen accesibles; hay una sola región principal de scroll. Las acciones están en el flujo del contenido, sin barra decorativa que tape campos.
- Un único Select muestra los seis pasos, su posición y estados derivados de datos y validaciones reales. Anterior/Siguiente utilizan el mismo estado del paso. La navegación directa conserva el borrador y no evita las validaciones al guardar.
- Motivo sigue como formulario normal; Revisión conserva el resumen. Solo los pasos 2–5 tienen acordeones exclusivos: signos/ASA/riesgo; extraoral/intraoral/dolor/riesgos; diagnósticos/pronóstico/periodontal/modificadores; procedimientos/tratamientos/materiales/exámenes/evolución.

## Estado, animación y accesibilidad

Los pasos y paneles permanecen montados con `shouldUnregister: false`; los contenidos ocultos se excluyen del foco con `hidden` e `inert`. Los selectores pendientes de tratamientos y exámenes conservan también su estado local. El detalle de interconsulta, compartido entre dos pasos, registra un solo input activo para evitar que dos referencias de React Hook Form sobrescriban el mismo valor.

Se reutilizó Accordion de Base UI. Cada apertura espera el cierre del panel anterior. Las transiciones de altura, opacidad y chevron duran 200 ms y respetan `prefers-reduced-motion`. El modal mantiene su posición al cambiar grupos. Los errores abren el paso y grupo correspondientes y llevan el foco al campo, desplazando únicamente el contenido interno cuando hace falta.

Dialog conserva el foco dentro del modal. X, Escape, Cancelar y el exterior consultan el mismo cierre seguro; un borrador sucio requiere confirmación. Escape dentro del desplegable cierra primero ese desplegable. Al cancelar se vuelve a la sección anterior y al control que abrió el registro. La ruta original se conserva como hija de la historia: el contenedor del paciente sigue montado detrás del modal. Tras guardar se actualiza la historia con los datos guardados y se muestra la atención registrada.

Los colores proceden de los tokens existentes: violeta en claro y Acid Lime en oscuro. Los estados clínicos mantienen sus colores semánticos. No se cambian Header, Sidebar ni gestión del tema.

## Archivos de esta entrega

| Archivos | Cambio |
| --- | --- |
| `front/src/app/routes.tsx`, `pages/patient-clinical-history-page.tsx`, `pages/register-encounter-page.tsx` | Presentación del registro sobre la historia y actualización tras guardar. Las páginas pertenecen a `src/modules/clinical-history`. |
| `components/background-tab.tsx`, `components/clinical-density.css` | Dos columnas médicas y distribución de listas de antecedentes. |
| `components/register-encounter-form.tsx`, `components/encounter-review.tsx` | Dialog, selector compartido, cierre seguro y localización de errores. |
| `components/encounter-steps/step-{vitals,exam,diagnosis,treatments}.tsx` | Agrupación de los campos existentes. |
| Nuevos `components/encounter-accordion.tsx`, `.css`, `encounter-reveal-context.ts`, `encounter-dialog.css` | Acordeones exclusivos, animaciones y estilos locales del modal. |
| `tests/clinical-modal.spec.ts`, `tests/helpers/encounter-navigation.ts` | Pruebas nuevas y navegación de pruebas por el selector/grupos. |
| `tests/dental-history.spec.ts`, `tests/clinical-encounter-redesign.spec.ts` | Adaptación de las regresiones existentes a los controles nuevos. |

Salvo las rutas y pruebas, los componentes de la tabla están dentro de `front/src/modules/clinical-history`.

## Verificación

Los resultados finales y sus recuentos se registran en `front/test-results/clinical-modal/validation-summary.json`. Los informes JSON de Playwright conservan tanto la ejecución inicial como las repeticiones necesarias. Un fallo inicial detectó la interferencia del detalle compartido de interconsulta; se corrigió y se repitieron sus pruebas en ambos temas.

Resultado consolidado: **69 casos únicos aprobados, sin pendientes ni omitidos**. Las repeticiones sustituyen el resultado anterior del mismo caso; no se suman como pruebas nuevas.

| Comprobación | Resultado |
| --- | --- |
| Modal y antecedentes: `clinical-modal.spec.ts` | 18 aprobados |
| Densidad e indicadores: `clinical-density.spec.ts` | 9 aprobados |
| Formulario y revisión: `clinical-encounter-redesign.spec.ts` | 10 aprobados |
| Navegación dinámica, integración y visual | 24 aprobados |
| Historia, citas, archivos, exportación y permisos: `dental-history.spec.ts` | 8 aprobados |
| TypeScript y build | Aprobados |
| Lint | Sin errores; conserva cinco advertencias preexistentes fuera de este alcance |

El build conserva el aviso existente sobre paquetes de más de 500 kB. Los fallos de la primera regresión por el estado del selector y por pulsar un acordeón mientras la validación lo abría se corrigieron en las pruebas, manteniendo sus verificaciones clínicas. Se repitieron y aprobaron esos casos.

Se verifican apertura/cierre, confirmaciones, foco, teclado, selector, Anterior/Siguiente, valores conservados, grupos exclusivos, animación secuencial, errores visibles, doble confirmación, citas vinculadas, tratamientos/costos, copia del odontograma, documentos, notas aclaratorias, exportaciones, permisos y navegación clínica.

Se comprueban 320, 360, 375, 390, 430, 600, 768, 1024, 1280, 1440 y 1920 px en ambos temas y con ambos estados del Sidebar cuando corresponde. El registro incluye 32 distribuciones de antecedentes. Se revisan los seis pasos, controles táctiles, ventanas cortas y un espacio CSS equivalente a 1280×720 con zoom al 200 %.

Evidencias en `front/test-results/clinical-modal`:

- `before/` y `after/`: capturas anteriores y nuevas; escritorio/móvil, seis pasos, desplegable y antecedentes, en ambos temas.
- `background-responsive.json`: medidas de las 32 distribuciones de antecedentes.
- Informes `*-e2e.json`: resultados y matrices adjuntas de Playwright.
- `typescript.txt`, `build.txt`, `lint.txt`: comprobaciones de TypeScript, build y lint.
- `source-before.json` e `integrity.json`: comprobación de cambios por SHA-256.

La comparación completa de Registrar atención usa las capturas anteriores reales. Las capturas antiguas de Antecedentes tenían recortes del contenedor desplazable; por eso se añade una referencia médica **reconstruida**, identificada como `*-medical-layout-reference-reconstructed.png`. Reproduce la tabla única con el límite auditado de 800 px dentro de un navegador desechable, sin guardar ni modificar el código. Se compara con `after/*-medical-card.png`, que muestra la implementación actual. `medical-comparison.txt` confirma también el salto de teclado entre «Anemia: familiar» y «Osteoporosis: personal».

| Comparación | Referencia anterior | Implementación actual |
| --- | --- | --- |
| Examen clínico oscuro | [Página anterior](../front/test-results/clinical-modal/before/dark-encounter-3.png) | [Modal y acordeones](../front/test-results/clinical-modal/after/dark-1440-encounter-3.png) |
| Antecedentes oscuros | [Referencia reconstruida](../front/test-results/clinical-modal/before/dark-medical-layout-reference-reconstructed.png) | [Dos columnas](../front/test-results/clinical-modal/after/dark-medical-card.png) |
| Antecedentes claros | [Referencia reconstruida](../front/test-results/clinical-modal/before/light-medical-layout-reference-reconstructed.png) | [Dos columnas](../front/test-results/clinical-modal/after/light-medical-card.png) |
| Móvil oscuro | [Paso 2](../front/test-results/clinical-modal/after/dark-375-encounter-2.png) | [Selector de pasos](../front/test-results/clinical-modal/after/dark-375-step-selector.png) |

## Protección del odontograma y límites

Se compararon 369 archivos existentes: 356 permanecen iguales y 13 cambian en este alcance, incluidos dos archivos de pruebas. No se eliminó ninguno. Los 29 archivos protegidos —API, almacenamiento, validaciones, tipos, cálculos, hooks, exportación, iframe, embed, dependencias y paquete de la librería— conservan sus hashes. `record-workspace.tsx` también permanece igual respecto al inicio de esta entrega. Las dos capturas del odontograma son idénticas byte por byte a las anteriores.

No se cambiaron reglas clínicas, persistencia, backend, contratos ni dependencias. Las pruebas usan contextos de navegador aislados y datos de demostración. El teclado móvil se comprueba reduciendo el viewport, no abriendo un teclado físico de Android/iOS. El zoom se comprueba mediante el espacio CSS equivalente, no mediante el zoom nativo de todos los navegadores. La ejecución visual se realiza en Chrome; no se afirma validación física en todos los dispositivos.

No se realizan commits, pushes, resets ni cambios de rama. El servidor del usuario en `localhost:5173` se conserva.
