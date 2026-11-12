# Navegación clínica dinámica

Fecha: 2026-11-11. Base: `main`, commit `205fec7`.

## Resultado

La barra compacta se ubica después de las cuatro tarjetas de resumen y antes del contenido. Muestra «Sección X de N», el nombre completo y «Ver secciones» cuando existe más de una opción. Se mantienen las diez secciones originales, en el mismo orden, con los mismos componentes.

| Cantidad disponible | Primera sección | Intermedias | Última sección |
| --- | --- | --- | --- |
| 1 | Sin Anterior ni Siguiente | — | — |
| 2 | Solo Siguiente | — | Solo Anterior |
| 3 | Solo Siguiente | Anterior y Siguiente | Solo Anterior |
| N mayor que 3 | Solo Siguiente | Anterior y Siguiente | Solo Anterior |

Los destinos inexistentes no se renderizan. No hay botones deshabilitados de relleno, navegación circular, grupos vacíos ni espacios reservados para ellos. Solo existe un grupo de controles en el DOM. Con una sección también se omite el selector innecesario, manteniendo la identificación «Sección 1 de 1».

## Estado, disponibilidad y niveles de navegación

- `recordSections` contiene una sola configuración con los nombres, identificadores y orden actuales. `RecordTab` se deriva de ella y mantiene su exportación anterior para los consumidores existentes.
- `useSectionNavigation` recibe la lista disponible y el identificador/callback actuales. Deriva total, índice, anterior y siguiente sin cantidades ni nombres fijos.
- La selección continúa en `tab`/`setTab`, dentro de `RecordWorkspace`. El estado de distribución solo decide dónde colocar los botones; no guarda una segunda sección activa.
- Si la lista crece o cambia de orden, conserva el identificador activo si está disponible. Si desaparece, selecciona la primera opción disponible sin reiniciar el formulario. Una lista vacía no genera navegación ni destinos ficticios; al recuperar opciones se reutiliza el identificador que siga disponible.
- El selector y los botones consumen exactamente la misma lista. Solo permiten seleccionar destinos presentes en ella.

Los permisos reales permanecen en `ProtectedRoute`: administración y personal médico acceden a las diez secciones existentes; recepción conserva la restricción del módulo. No se inventan permisos nuevos por sección. El componente recibe opciones ya autorizadas; las pruebas aisladas ejercitan también listas filtradas y destinos retirados.

«Registrar atención» conserva su ruta, sus seis etapas, sus validaciones y su recorrido. Es un nivel independiente cuyo contador no se utiliza para calcular las secciones de la historia. Diagnósticos permanece dentro del editor odontológico.

## Guardado y protección de datos

«Guardar cambios» conserva ubicación, confirmación, validaciones, operaciones y mensajes existentes. Solo aparece bajo las condiciones actuales del formulario. La navegación utiliza botones `type="button"` y únicamente cambia el identificador activo; no guarda, valida ni crea registros clínicos.

Se verifica en la aplicación real el guardado de únicamente Datos del paciente, sin completar otros apartados. Después se comprueba la conservación de nuevas ediciones del paciente y del odontograma al navegar, cambiar de tamaño y volver, incluyendo la misma instancia de iframe y el mismo estado dental. IndexedDB permanece sin cambios hasta confirmar el guardado.

Las protecciones existentes al volver al paciente, cerrar/recargar la página o registrar una atención se conservan. Las ediciones del formulario compartido siguen en memoria al cambiar de sección; no se añade un aviso que descarte o reinicie esos valores.

Los paneles mantienen Base UI, sus componentes y su ciclo de montaje. Se identifican como regiones accesibles mediante el título activo. El odontograma continúa montado fuera de los paneles con su mecanismo actual de ocultación y captura para exportaciones.

## Responsive y temas

La barra conserva todo el ancho de contenido. Desde 896 px efectivos, el único grupo de navegación se renderiza en la cabecera de la barra; por debajo se renderiza al final del contenido, después de las acciones de guardado. Un `ResizeObserver` mide el contenido, de modo que responde al sidebar expandido o contraído sin modificarlo.

El nombre admite saltos de línea, los botones tienen al menos 44 px de alto y los controles restantes se redistribuyen sin huecos. Si no hay destinos, no se renderiza el pie. No se introducen barras flotantes ni sticky. El menú tiene desplazamiento interno y posicionamiento local que lo mantiene dentro del viewport al redimensionar con el selector abierto.

| Grupo | Resoluciones comprobadas en ambos temas |
| --- | --- |
| Celulares | 320, 360, 375, 390, 430 px |
| Tablets | 600, 768 px; 768 × 1024 y 1024 × 768 |
| Laptops | 1024, 1280 px; sidebar expandido y contraído a 1024 px |
| PCs | 1440, 1920 px |
| Vistas reducidas | Móvil horizontal 844 × 390; 375 × 420 |

Se recorren las diez secciones de una historia existente a 320 y 1024 px. Se comprueban el menú abierto durante cambios de tamaño, ausencia de desbordamiento horizontal global, controles dentro del viewport y un único grupo de navegación.

Se utilizan los tokens semánticos existentes: modo claro original con violeta `#5350CC`; modo oscuro Linear con primario `#E4F222`. No se modifican los tokens, el logo ni la paleta de otros módulos. El menú activo tiene marca y estado accesible, sin depender solo del color.

## Accesibilidad

Se comprueban nombres completos, `aria-checked`, foco visible, Enter, flechas, Home, End, Escape, cierre del menú, retorno de foco y controles táctiles. La posición y el título se anuncian mediante `aria-live="polite"`. Los controles que no tienen destino no existen en el DOM y no pueden recibir Tab.

Las comprobaciones de contraste evalúan título, posición, botones y opciones del menú con un mínimo de 4.5:1 en ambos temas. No se añaden porcentajes de completitud ni se marca una sección como terminada por visitarla. No hay desplazamientos automáticos al cambiar de sección o guardar.

## Archivos modificados o nuevos

Rutas relativas a la raíz del repositorio:

| Archivo | Función |
| --- | --- |
| `front/src/modules/clinical-history/components/record-workspace.tsx` | Integración localizada y reutilización del estado actual. Modificado. |
| `front/src/modules/clinical-history/components/clinical-navigation.tsx` | Barra, selector accesible y controles condicionales. Nuevo. |
| `front/src/modules/clinical-history/components/clinical-navigation.module.css` | Estilos locales. Nuevo. |
| `front/src/modules/clinical-history/hooks/use-section-navigation.ts` | Modelo dinámico y distribución del único grupo. Nuevo. |
| `front/src/modules/clinical-history/lib/record-sections.ts` | Configuración única y tipo de sección. Nuevo. |
| `front/tests/dental-history.spec.ts` | Sustituye las interacciones con las antiguas pestañas por el selector; mantiene las comprobaciones clínicas. Modificado. |
| `front/tests/diagnoses-modal.spec.ts` | Espera la señal real de carga del editor antes de abrir Diagnósticos tras cada carga; mantiene las comprobaciones de persistencia y solo lectura. Modificado. |
| `front/tests/helpers/clinical-navigation.ts` | Ayudantes de selección y comprobación accesible. Nuevo. |
| `front/tests/clinical-navigation-dynamic.spec.ts` | Casos 1/2/3/10, cambios de disponibilidad/orden y teclado. Nuevo. |
| `front/tests/clinical-navigation-integration.spec.ts` | Aplicación real, guardado, responsive, contraste y tacto. Nuevo. |
| `front/tests/fixtures/clinical-navigation.html` | Página aislada de pruebas. Nueva. |
| `front/tests/fixtures/clinical-navigation.tsx` | Monta el mismo componente con distintas listas y un formulario de prueba. Nuevo. |
| `front/CLINICAL_NAVIGATION_DYNAMIC_REPORT.md` | Este informe. Nuevo. |

Las fixtures no son rutas de ClinicApp ni entradas de producción de Vite. Permiten verificar cantidades distintas sin introducir parámetros, banderas ni operaciones de guardado ficticias en el producto. Sus comprobaciones de callback se complementan con el guardado real existente en las pruebas de integración. El build no contiene la página de pruebas.

## Protección del alcance

Se compararon hashes de 201 archivos existentes de `src`, manifiestos y TXT de prueba: 200 permanecen idénticos. El único archivo fuente existente adaptado es `record-workspace.tsx`; sus trece funciones y handlers anteriores mantienen el mismo contenido, normalizando saltos de línea.

No se modificaron sidebar, Header, AppLayout, breadcrumbs, logo, formularios, componentes clínicos, APIs, esquemas de validación, cálculos, SVG, FDI, editor embebido, exportaciones, guardados especializados, temas, tokens ni CSS global. Los manifiestos y el lockfile permanecen iguales; no se instalaron dependencias.

Evidencia local: `test-results/clinical-navigation-dynamic/source-verification.json`.

## Comandos y resultados

Desde `front/`:

```powershell
npm.cmd run build
npm.cmd run lint
git diff --check
$env:CLINIC_TEST_URL='http://localhost:5173'
npm.cmd run test:e2e -- tests/clinical-navigation-dynamic.spec.ts --workers=2 --output=test-results/clinical-navigation-dynamic/component --reporter=line,json --max-failures=3
npm.cmd run test:e2e -- tests/clinical-navigation-integration.spec.ts --grep 'fits all widths' --workers=2 --output=test-results/clinical-navigation-dynamic/resize --reporter=line,json --max-failures=2
npm.cmd run test:e2e -- --workers=2 --output=test-results/clinical-navigation-dynamic/full-suite --reporter=line,json --max-failures=5
npm.cmd run test:e2e -- tests/diagnoses-modal.spec.ts --output=test-results/clinical-navigation-dynamic/diagnoses-ready --reporter=line,json
```

- Build correcto; se conserva el aviso previo de bundles de más de 500 kB.
- Lint sin errores ni advertencias nuevas: permanecen cinco advertencias preexistentes.
- `git diff --check` sin errores de espacios; Git informa de la normalización LF/CRLF de los archivos de pruebas existentes.
- Casos aislados: 12 aprobados.
- Regresión dirigida del menú abierto tras el ajuste local: 2 aprobadas en ambos temas.
- Suite completa: 100 aprobadas de 101 en la primera pasada; falló una comprobación de Diagnósticos tras recargar.
- Se reprodujo ese mismo fallo con `RecordWorkspace` original de `main`, servido por separado en localhost:5174 sin modificar archivos del producto. La prueba esperaba que existiera la cuadrícula, pero aún podía abrir el modal antes de importar los datos guardados.
- Se sincronizó únicamente la prueba con la señal de carga existente: el botón «Registrar atención» habilitado. La reejecución aprobó 1/1 tanto con la navegación nueva como con el componente original de `main`. No se cambió el editor ni el guardado clínico.
- Resultado final combinado: las 101 comprobaciones verificadas. La ejecución completa y las reejecuciones quedan conservadas por separado en los informes JSON; no se presenta la primera pasada como una ejecución sin fallos.

Los informes JSON, capturas a 390/1440 px y trazas se guardan en `test-results/clinical-navigation-dynamic/`, ignorado por Git. Las pruebas anteriores del historial siguen comprobando validaciones, consentimientos, datos del paciente, archivos, impresión, imágenes, atenciones, diagnósticos, periodontograma y permisos.

## Limitaciones y Git

Las comprobaciones usan Chrome con Playwright y emulación de resoluciones, orientación, tacto y vista reducida. No se realizó una revisión manual con lectores de pantalla ni en dispositivos físicos o teclados móviles nativos.

Los borradores internos que aún no se han incorporado al formulario compartido mantienen su comportamiento anterior. Por ejemplo, un tratamiento escrito pero no añadido con «Agregar» no participa en la detección de cambios de la historia y conserva el desmontaje previo al salir del panel. No se modifica ese formulario protegido ni se inventa una protección genérica.

La persistencia sigue siendo la del modo demostración existente: historias en IndexedDB y datos del paciente en memoria. No se altera esa arquitectura.

El estado inicial de Git estaba limpio. Los trece archivos enumerados constituyen este trabajo. No se realizan commits, pushes ni cambios de ramas automáticamente; el resultado queda local en `main` para revisión.
