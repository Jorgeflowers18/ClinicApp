# Pacientes: modales compartidos y acordeón exclusivo

Implementado el 14 de noviembre de 2026 sobre los cambios locales existentes.

## Comportamiento

- «Nuevo paciente» abre un modal desde el listado. Al crear correctamente se cierra y se actualizan los datos mediante la invalidación existente de React Query. El listado conserva su componente, filtros y paginación; no hay navegación a otra página.
- La edición desde el listado, el perfil y sus accesos por sección utiliza el mismo `PatientFormDialog`, configurado en modo `edit`. La ficha y su pestaña activa conservan el contexto.
- Los enlaces directos `/pacientes/nuevo` y `/pacientes/:id/editar`, incluido el parámetro `seccion`, continúan funcionando con el mismo `PatientForm`.
- Los modales mantienen encabezado y pie integrados, foco controlado, confirmación de descarte, bloqueo durante el guardado y conservación del borrador ante errores.

## Acordeón limitado a Pacientes

Se inspeccionó la API instalada de Base UI. Se reutiliza `Accordion.Root` con `multiple={false}`, un solo estado `openSectionId: string | null`, y `keepMounted`. No se instalaron dependencias ni se creó un comportamiento global de acordeón.

Datos personales inicia abierta en los accesos generales. Abrir otra sección cierra la anterior; pulsar la abierta permite dejar todas contraídas. Los accesos explícitos a una sección de edición siguen abriendo esa sección de forma exclusiva.

Los paneles permanecen montados y React Hook Form usa `shouldUnregister: false`. Cambiar de sección no reinicializa el formulario ni elimina campos, valores, errores o elementos del payload.

Al enviar, se identifica el primer campo inválido, se abre únicamente su sección y se enfoca y desplaza el campo. Las demás secciones con errores muestran «Revisar» sin expandirse. No cambian los esquemas de validación ni la normalización.

Los encabezados son compactos, con iconos neutros al cerrar y acento del tema al abrir. La cuadrícula del modal usa dos o tres columnas cuando existe espacio y una en móvil. Se corrigió la distribución de las explicaciones de consentimiento y notificaciones a 320 px, colocando cada explicación debajo de su etiqueta.

**La exclusividad solo se aplica al formulario compartido de Pacientes.** No se modificó ningún acordeón, formulario, componente o estilo de historia clínica ni de otros módulos. El odontograma y su librería permanecen intactos.

## Archivos

- `front/src/modules/patients/components/patient-form-dialog.tsx`: generalización del anterior `patient-edit-dialog.tsx` para crear y editar.
- `front/src/modules/patients/components/patient-form.tsx`: estado exclusivo, campos montados y apertura del primer error.
- `front/src/modules/patients/components/patient-ui.tsx`: secciones accesibles basadas en Base UI.
- `front/src/modules/patients/pages/patients-list-page.tsx`: apertura de ambos modos sin abandonar el listado.
- `front/src/modules/patients/pages/patient-detail-page.tsx`: reutilización del modal generalizado.
- `front/src/modules/patients/patients.css`: presentación limitada al módulo.
- `front/tests/patient-single-accordion.spec.ts`: ocho casos nuevos.
- Pruebas existentes de pacientes y `dental-history.spec.ts`: selectores y pasos de navegación adaptados al acordeón y al contexto conservado por el modal, manteniendo las comprobaciones de datos.

## Resultados reales

- **42 casos únicos correctos:** ocho nuevos, treinta de pacientes y edición existentes y cuatro de integración clínica y acciones de páginas.
- Se verificó la secuencia solicitada de nombre → contacto/teléfono → emergencia → regreso a nombre y teléfono → guardado, en creación y edición y en ambos temas. El payload conserva datos personales, contacto, emergencia, seguro, consentimiento, notificaciones y observaciones.
- Se probaron filtros conservados, actualización de ficha/listado, rutas directas, errores en múltiples secciones, errores del servicio y reintento, cancelación por las cuatro vías, valores iniciales al reabrir, teclado, foco y bloqueo de doble envío.
- Ambos modos se comprobaron en **320, 360, 375, 390, 430, 600, 768, 1024, 1280, 1440 y 1920 px**, en claro y oscuro. También se comprobó el espacio reducido de 375 × 360 px. Esta simulación de geometría no sustituye una prueba manual de teclados en dispositivos físicos.
- TypeScript y build de producción correctos. Permanece la advertencia previa de paquetes mayores de 500 kB.
- Lint correcto, con cinco advertencias preexistentes de Fast Refresh y React Compiler.
- Se comprobó la preferencia de movimiento reducido y la ausencia de advertencias de animación del panel de Base UI; el ajuste se limita a los paneles de Pacientes.
- `git diff --check` correcto.

Las pruebas detectaron la composición estrecha de las descripciones de preferencias y se corrigió dentro de Pacientes; los dos casos responsive afectados pasaron al repetirse. Una prueba clínica se actualizó para consultar Resumen después de verificar que guardar conserva la pestaña Historial clínico. Sus comprobaciones de información clínica permanecen intactas y la prueba completa pasó al repetirse.

La comparación de 289 archivos de referencia deja **279 idénticos**, incluidos **241 archivos protegidos**. No hay cambios en API, modelos, reglas, persistencia, autenticación, permisos, rutas, estilos globales, Sidebar, Header, historia clínica ni odontograma. Se conservaron los cambios locales anteriores y no se hicieron commits, pushes, resets ni cambios de rama.

Los resultados consolidados están en `front/test-results/patient-single-accordion/final-results.json`, y la verificación de alcance en `scope-verification.json`. Las capturas del odontograma son idénticas byte por byte en ambos temas. El comparador `review.html` contiene **20 pares de capturas antes/después**.
