# Archivo clínico digital del paciente

> **Histórico.** Este documento describe la versión de demostración (IndexedDB en el navegador), que se conserva en la rama `jf/front-demo-mocks`. Desde el 2026-11-22 el archivo clínico vive en la API (plan 7): ver `documentacion/arquitectura-frontend.md` § "Historia clínica odontológica" y `back/docs/endpoints-api.md`.

Implementación sobre el frontend existente. No introduce un módulo en el sidebar ni un repositorio paralelo de documentos.

## Fuente de datos y alcance

La pestaña visible **Archivo clínico** conserva el identificador interno `documentos`. Comparte `ClinicalFileManager` con **Historia clínica → Fotos y documentos**. Ambas leen `record.attachments` y utilizan la misma clave de React Query por paciente y los mismos originales de IndexedDB.

`DentalAttachment.archive` añade metadatos opcionales. No se sustituyen el identificador, el nombre original, el tipo anterior ni los bytes. Los registros previos siguen siendo legibles sin fabricar autor, fecha de estudio o historial de cambios. Los consentimientos informados y de datos personales continúan siendo registros distintos.

La base `clinicapp-dental-v1` conserva su nombre. La actualización a versión 2 añade `archive-catalog` y mantiene los almacenes `records` y `files`. La normalización conserva los metadatos nuevos. Una transacción guarda cada original, su miniatura y su referencia clínica; un fallo revierte los tres. El archivado conserva el adjunto en el registro, por lo que no activa la eliminación de originales de la lógica anterior.

Las modificaciones confirmadas del archivo actualizan únicamente los arreglos de adjuntos y exámenes del formulario clínico mediante una combinación de tres versiones. No se reinician antecedentes, consentimiento, plan, datos del paciente ni estado del odontograma. Guardar la historia queda bloqueado mientras existe una escritura del archivo en curso. Las revisiones del registro y de cada archivo detectan conflictos.

## Funcionalidades

- Cabecera compacta, indicadores, buscador, filtros independientes y restablecimiento con el control compartido existente.
- Tipos clínicos anteriores y tipos adicionales; categorías institucionales de demostración, etiquetas reutilizables y sus ediciones. Los recuentos del catálogo corresponden exclusivamente al paciente abierto. Archivar categorías no elimina documentos ni cambia sus asociaciones.
- Búsqueda por nombre original o personalizado, tipo, categoría, etiquetas, profesional, zona y notas. Filtros por fecha real de estudio, profesional, etiqueta, tratamiento y estado. Rangos predefinidos y personalizado, cuatro órdenes y agrupación por fecha, mes, categoría o tratamiento.
- Lista y galería con preferencia visual persistida. Paginación de 24 registros; miniaturas de hasta 512 px solicitadas al aproximarse al área visible. Las miniaturas muestran las proporciones y colores originales, sin filtros; nunca sustituyen el original.
- Modal de carga múltiple con arrastre, eliminación previa, datos comunes y ajustes individuales. Acordeón exclusivo animado de archivos, clasificación e información adicional. Creación de categorías y etiquetas dentro del formulario, sin apilar modales.
- Límite de 20 MB por archivo; límite de interacción de la demostración de 20 archivos / 100 MB por lote. Cada archivo informa preparación, guardado o error real. Un reintento no vuelve a enviar los éxitos del mismo lote.
- Edición de metadatos, archivado con confirmación, restauración y descarga del original. Las acciones nuevas registran actor, fecha y campos modificados; no se fabrica auditoría de registros anteriores.
- Validación de las relaciones con atenciones, tratamientos y exámenes del paciente. Un resultado nuevo puede enlazarse a una solicitud pendiente. Archivar nunca revierte estados clínicos ni desvincula consentimientos o resultados.
- Visor de imágenes con zoom, ajuste, restablecimiento, rotaciones de 90°, desplazamiento, pantalla completa, información y navegación por los resultados filtrados. Las transformaciones no se guardan sobre el original.
- Comparación de dos imágenes del mismo paciente y tipo clínico: orden inicial cronológico, lado a lado, transformaciones independientes, zoom sincronizable, intercambio, ajuste, información y descargas. En móvil se apilan verticalmente. El deslizador requiere proporciones semejantes y conserva ambas proporciones. Se advierte expresamente que no existe alineación ni medición clínica validada.
- Las etiquetas «Antes» y «Después» se utilizan únicamente cuando el usuario las asignó; de lo contrario se muestran «Anterior» y «Posterior». Sin fecha de estudio, el orden utiliza la fecha de carga y la interfaz lo indica.
- PDF en el visor nativo del navegador, con descarga alternativa y sin servicios externos. No se implementan DICOM ni modelos tridimensionales.

## Formatos y validación

La carga nueva admite JPEG, PNG, WebP y PDF. Inspecciona la firma del contenido, comprueba el MIME declarado, rechaza archivos vacíos o mayores de 20 MB y decodifica las imágenes antes de guardarlas. Para PDF se comprueban cabecera y marcador final; esto no equivale a un análisis estructural completo o antimalware. La visualización de PDF depende del navegador.

Un resumen SHA-256 detecta originales repetidos del mismo paciente, incluidos los archivados. Si un original previo no tiene resumen, se lee para comprobar el posible duplicado. Una referencia anterior cuyo original no puede leerse produce un error explícito al comprobar un archivo del mismo tamaño. Los archivos que fallan permanecen en el lote para corregirlos o quitarlos.

Los flujos existentes de consentimiento firmado y subida directa de resultados mantienen su contrato y su confirmación con **Guardar cambios**. Después de confirmar aparecen en el mismo archivo compartido. Sus formularios no se han reconstruido.

Las exportaciones anteriores conservan su comportamiento. Como el archivado no elimina registros, los documentos archivados permanecen en la historia y pueden seguir incluidos en esas exportaciones.

## Permisos y limitaciones reales

Los servicios nuevos comprueban sesión, rol clínico (`admin` o `medico`), paciente y pertenencia del adjunto. Repiten la comprobación de sesión antes de escribir o entregar originales. Los componentes se remontan al cambiar de paciente o usuario; no utilizan datos provisionales del paciente anterior. El propietario y el contenido del archivo no son editables.

**Esta es una demostración local para datos de prueba.** La aplicación actual no contiene un identificador de institución ni autorización de servidor para aislar varias clínicas. El catálogo `local-institution` representa únicamente la institución local de demostración; no constituye una implementación multiinstitucional. IndexedDB y los permisos del frontend no son una barrera de seguridad de producción ni una copia de respaldo. Limpiar el navegador elimina sus datos. No se anuncia sincronización con servidor, cifrado institucional ni conservación legal garantizada.

Con `VITE_USE_MOCK_API=false` se conserva la consulta y descarga mediante los endpoints anteriores. No se inventan endpoints: carga avanzada, edición, catálogo y archivado se deshabilitan hasta disponer de contratos de servidor. La sincronización entre ambas pantallas usa la caché de la aplicación; otras pestañas del navegador requieren actualizar su consulta y pueden recibir un conflicto de versión.

Para producción quedan pendientes almacenamiento autorizado en servidor, aislamiento por institución, auditoría central, respaldo/retención, análisis de documentos, validación estructural de PDF y endpoints transaccionales del archivo. La integración de estas capacidades requiere trabajo de backend y no se simula aquí.

## Componentes y archivos

Feature principal en `front/src/modules/clinical-history/archive/`:

| Archivo | Responsabilidad |
| --- | --- |
| `api.ts`, `types.ts`, `hooks.ts` | Permisos, operaciones, metadatos, caché y recursos Blob |
| `lib/classification.ts`, `lib/filter.ts`, `lib/files.ts`, `lib/viewer.ts` | Presentación, selección, combinación de borradores, validación, miniaturas y transformaciones |
| `components/clinical-file-manager.tsx` | Estado acotado al paciente y coordinación |
| `components/toolbar.tsx`, `components/file-results.tsx`, `components/controls.tsx` | Filtros, lista/galería y controles |
| `components/upload-dialog.tsx`, `components/edit-dialog.tsx`, `components/metadata-fields.tsx`, `components/catalog-dialog.tsx` | Carga, edición, clasificación y catálogo |
| `components/file-viewer.tsx`, `components/image-surface.tsx`, `components/compare-viewer.tsx` | Consulta de originales y comparación |
| `archive.module.css` | Estilos exclusivamente locales, temas y responsive |

Integraciones existentes modificadas: `clinical-history.mock-storage.ts`, `clinical-history.mock-migration.ts`, `clinical-history.types.ts`, `attachments-tab.tsx`, `record-workspace.tsx`, `patient-clinical-history-page.tsx`, `patient-related-tabs.tsx` y `patient-detail-page.tsx`.

Se reutilizan Dialog y su cuerpo/pie estándar, Select, Input, Textarea, Button, Tooltip, DropdownMenu, ConfirmDialog, ResponsiveFilterBar, SearchInput, ResetFiltersButton, Skeleton, Lucide, React Query, la sesión y los catálogos de pacientes/profesionales/tratamientos existentes. No se añaden dependencias.

## Verificación

Pruebas del archivo en `front/tests/clinical-archive*.spec.ts`, con imágenes geométricas generadas y PDF sintético. Cubren persistencia, migración v1 → v2, originales intactos, vínculos de consentimiento/examen, conflictos, permisos, separación entre pacientes, fallos de almacenamiento, lotes parciales, categorías/etiquetas, filtros, paginación, visor y comparador.

La matriz visual recorre 320, 360, 375, 390, 430, 600, 768, 1024, 1280, 1440, 1920 y 2560 px en ambos temas. Incluye baja altura, navegación contraída y un viewport de 720 × 450 equivalente en distribución a 200 % sobre 1440 × 900; no se presenta esa equivalencia como una prueba física del zoom del navegador. Las capturas y trazas se generan dentro de `front/test-results/clinical-archive*`.

Resultados finales ejecutados en Chrome:

| Comprobación | Resultado |
| --- | --- |
| `npm.cmd run build` (TypeScript + Vite) | Correcto. Permanece el aviso de tamaño de chunks del proyecto. |
| `npm.cmd run lint` | Sin errores ni advertencias nuevas; permanecen tres advertencias Fast Refresh en Button, Badge y Tabs. |
| Archivo nuevo: integridad, gestión, filtros, carga, visor, comparador y responsive | 13 casos aprobados. El caso de pantalla completa se repitió después de comprobar también apertura desde el menú y navegación sin salir de pantalla completa. |
| Historia clínica: densidad, modales y navegación existentes | 35 casos distintos aprobados. Se repitieron los casos afectados tras conservar el texto vacío y corregir el tamaño de los controles de vista. |
| Integración anterior: edición clínica/exportaciones, generación de identificadores, roles del perfil y documentos | 6 casos aprobados. |
| Integridad SHA-256 | 309 archivos originales comparados; solo cambiaron los ocho archivos de integración enumerados. Los 23 archivos protegidos seleccionados —editor, evolución, exportaciones, librería y manifiestos de dependencias— no cambiaron. |
| Servidor de desarrollo | `http://localhost:5173/login` responde HTTP 200. |

Son **54 casos distintos aprobados por grupos**, con reejecuciones de los casos afectados por correcciones. No se afirma haber ejecutado la totalidad del conjunto de pruebas del repositorio. Los casos de funciones puras se ejecutan dentro de las pruebas del navegador, sin instalar otro framework de pruebas.

Se actualizaron las referencias de pruebas al nuevo nombre de pestaña, al flujo de carga y a las acciones del archivo. Los lectores de IndexedDB de las pruebas usan la versión existente, conservando una prueba específica de migración desde v1. Una imagen PNG histórica de prueba con datos que el decodificador rechazaba se sustituyó por un píxel sintético con CRC válidos; no se relajó la validación de archivos para aceptarla.

Pruebas existentes adaptadas: `clinical-density.spec.ts`, `clinical-modal.spec.ts`, `clinical-navigation-integration.spec.ts`, `dental-history.spec.ts`, `patients-redesign.spec.ts` y `patients-ui-refinement.spec.ts`. Publicación en `main` autorizada posteriormente por el usuario.

**El código, estilos, integración, cálculos y dependencias del odontograma y periodontograma existentes permanecen intactos.** Las modificaciones de la página clínica son externas al editor y no cambian sus propiedades, eventos ni funciones de manejo.
