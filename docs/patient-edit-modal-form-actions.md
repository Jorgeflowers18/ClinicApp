# Modal de edición de pacientes y acciones de formularios

Fecha: 14 de noviembre de 2026.

## Auditoría y protección

Se revisaron las rutas de pacientes, el formulario compartido, sus consultas y mutaciones, validaciones, accesos de edición del perfil y listado, y las primitivas Dialog, AlertDialog y Sheet existentes. También se inventariaron las acciones de perfiles, sedes, citas, tratamientos, inventario, notificaciones, reportes y finanzas.

Problemas encontrados:

- El perfil navegaba a la página de edición y perdía el contexto de la pestaña consultada.
- El formulario de pacientes tenía un pie sticky con borde completo, radio y superficie propios.
- Los pies compartidos de diálogos agregaban márgenes negativos, fondo distinto y esquinas adicionales.
- Las acciones de páginas usaban agrupaciones y alturas diferentes. El perfil institucional guardaba desde el encabezado.
- No existía una confirmación de cambios pendientes para una edición modal.
- El lanzador de React Query Devtools, disponible solo en desarrollo, se superponía al guardado del modal en móvil.

Antes de editar se registraron el estado Git y los hashes de 283 archivos en `front/test-results/patient-edit-modal/`. Se conservaron todos los cambios locales anteriores. No se cambiaron ramas, ni se ejecutaron commits, pushes, resets o instalaciones.

## Implementación

`PatientForm` contiene el formulario existente, sus mismos campos, resolución de errores, cálculo de edad, consulta de última visita y servicios de creación/actualización. Se reutiliza en la página y en el modal; no hay dos formularios independientes.

Desde la ficha, «Editar», la opción de tres puntos y los accesos de las tarjetas abren `PatientEditDialog`. El perfil y la pestaña activa permanecen montados. El modal tiene hasta 1088 px, altura máxima de 88dvh, encabezado y pie integrados y una sola zona central desplazable. En pantallas menores de 768 px ocupa el viewport completo. Los campos se distribuyen según el espacio real disponible, sin imponer cuatro columnas en tablet.

Cancelar, X, Escape y clic fuera cierran directamente sin modificaciones. Con cambios, abren «¿Descartar cambios?» con «Continuar editando» y «Descartar cambios». Base UI mantiene el foco y lo devuelve al control que abrió el modal. Durante el guardado se bloquean cierre y envíos duplicados. El estado de procesamiento también considera la mutación real, evitando que una segunda solicitud de envío libere visualmente el botón mientras la primera sigue pendiente.

Un error conserva el borrador y abre/enfoca la sección correspondiente. Un éxito usa la actualización de caché que ya realiza `useUpdatePatient`, cierra el modal y muestra los datos actualizados sin recarga manual.

La ruta `/pacientes/:id/editar`, su parámetro `seccion` y la navegación desde el listado siguen funcionando como página. Nuevo paciente permanece como página completa.

## Sistema de acciones

`FormActions` define exclusivamente presentación; recibe los botones existentes con sus mismos callbacks, tipos, variantes y estados. Reutiliza tokens y diferencia tres contextos:

- **Página:** acciones al final, sin tarjeta, fondo independiente, borde completo ni sticky.
- **Diálogo:** pie integrado con la misma superficie y un separador superior; el modal de pacientes tiene un cuerpo central desplazable independiente del pie.
- **Panel lateral:** pie integrado y espacio de seguridad inferior.

Las acciones usan 40 px en escritorio, al menos 44 px en móvil y separaciones de 8 px. Se conservan los colores primarios violeta y Acid Lime, así como las variantes destructivas y los estados disabled/loading.

Se aplicó directamente a Pacientes, Mi perfil, Perfil institucional, Tratamientos, Inventario y Plantillas. DialogFooter, AlertDialogFooter y SheetFooter reutilizan el patrón para citas, proveedores, compras, movimientos, esterilización, fotografías, confirmaciones, sedes y filtros de reportes. Los módulos de Finanzas y Reportes no tenían formularios de guardado adicionales que requirieran reconstrucción; se conservaron sus acciones y filtros. La campana, el selector de tema y la navegación principal no se modificaron.

El lanzador de desarrollo se oculta mientras existe un modal accesible abierto, para no cubrir botones. El componente de desarrollo y los proveedores de React Query permanecen intactos; esta corrección no añade elementos a producción.

## Archivos

Nuevos:

- `front/src/components/ui/form-actions.tsx`
- `front/src/styles/form-actions.css`
- `front/src/modules/patients/components/patient-form.tsx`
- `front/src/modules/patients/components/patient-edit-dialog.tsx`
- `front/tests/patient-edit-modal.spec.ts`
- `front/tests/form-actions.spec.ts`

Actualizados:

- `front/src/components/ui/dialog.tsx`, `alert-dialog.tsx`, `sheet.tsx`.
- `front/src/styles/app.css`, `components.css`, `content-ui.css`.
- `front/src/modules/patients/pages/patient-form-page.tsx`, `patient-detail-page.tsx`, `components/patient-actions.tsx`, `patients.css`.
- `front/src/modules/auth/pages/user-profile-page.tsx` y su CSS modular.
- `front/src/modules/institution/pages/institution-profile-page.tsx`.
- `front/src/modules/treatments/pages/treatment-form-page.tsx`.
- `front/src/modules/inventory/pages/inventory-item-form-page.tsx`.
- `front/src/modules/notifications/components/notification-template-editor.tsx`.
- `front/tests/patients-redesign.spec.ts` y `patients-ui-refinement.spec.ts`: expectativas visuales y de navegación ajustadas al nuevo comportamiento solicitado; se mantienen las comprobaciones de datos y negocio.

## Validación real

- **65 casos únicos correctos**: 8 del modal, 6 de acciones globales, 22 de pacientes y 29 de regresión de perfiles/fotografías, sedes, notificaciones, inventario, citas y guardado/exportación clínica.
- El modal y las acciones de siete páginas se verificaron en ambos temas en 320, 360, 375, 390, 430, 600, 768, 1024, 1280, 1440 y 1920 px. También se comprobó una ventana móvil de 375 × 360 px para simular el espacio reducido por el teclado.
- Se probaron confirmación de descarte por las cuatro vías de cierre, foco y retorno, mantenimiento de pestaña y URL, validaciones en acordeones cerrados, error del servicio y reintento, bloqueo de doble envío y actualización de la ficha.
- Se ejecutaron las pruebas de fotografías que comprueban conservación, fallos de lectura/guardado/eliminación, recarga, nuevo login y sincronización de avatares, incluidos los criterios CA-11, CA-18 y CA-27 del trabajo previo.
- TypeScript y build de producción correctos. Persiste la advertencia anterior de paquetes mayores de 500 kB.
- Lint correcto, con cinco advertencias preexistentes de Fast Refresh y React Compiler.
- `git diff --check` correcto.

La ejecución inicial del modal detectó una altura heredada de 38 px y un estado visual de envío liberado antes de terminar una actualización doble. Se corrigieron mediante el token de altura y el estado real de la mutación, y se repitieron los casos afectados. La comprobación móvil se repitió después de retirar la superposición del lanzador de desarrollo. No se declaran pruebas unitarias independientes: el proyecto tiene comprobación TypeScript, lint y pruebas de integración/E2E con Playwright.

El detalle consolidado está en `front/test-results/patient-edit-modal/final-results.json`. La verificación de alcance está en `scope-verification.json`: 265 de los 283 archivos de referencia siguen idénticos, incluidos 115 archivos de áreas protegidas. No cambiaron endpoints, modelos, validaciones, cálculos, stores, persistencia, permisos, autenticación, rutas ni código de historia clínica.

**El odontograma y su librería permanecen intactos.** Sus capturas en ambos temas coinciden byte por byte con las anteriores. Se guardaron 34 pares de capturas antes/después; el comparador está en `front/test-results/patient-edit-modal/review.html`.

Sin incidencias funcionales pendientes en los casos probados. El tamaño reducido de viewport comprueba geometría y acceso a controles; no sustituye una prueba manual con teclados virtuales de dispositivos físicos.
