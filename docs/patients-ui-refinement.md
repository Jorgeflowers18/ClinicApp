# Pacientes: refinamiento de interfaz

Fecha: 14 de noviembre de 2026.

La implementación parte del módulo existente y sigue este orden: componentes compartidos, formularios y, finalmente, perfil y pestañas. Se mantienen violeta institucional en claro y Acid Lime en oscuro.

La auditoría encontró dos causas concretas: el menú compartido heredaba el ancho del botón de tres puntos y el formulario estaba limitado a 928 px con un contenedor interno de desplazamiento. Se corrigieron en los componentes y estilos del módulo, sin reconstruir las páginas.

## Cambios

1. **Componentes compartidos.** Un solo menú abierto por pantalla, con portal y posicionamiento de Base UI, opciones de 44 px, iconos de 20 px y ancho de 280 px. Se conservan las acciones, confirmaciones, permisos y mutaciones. Se comparten tarjetas, secciones del formulario, pestañas, estados y estados vacíos; se reutilizan Avatar, DataTable, ConfirmDialog y Button existentes.
2. **Formularios.** Creación y edición comparten una presentación de hasta 1280 px. Dos columnas normales, tres para campos cortos cuando el contenedor permite hacerlo y una en móvil. Se elimina el scroll interno del formulario: el área principal de la aplicación es el único contenedor que desplaza el contenido. El pie sticky conserva las acciones, y el espacio de desplazamiento permite mostrar los campos enfocados por encima del pie. No cambian validaciones, borradores, campos, valores, edad, última visita ni guardado.
3. **Perfil y pestañas.** Cabecera compacta, indicador de pestaña activa, tarjetas con etiquetas, valores e iconos y accesos a la sección correspondiente del formulario de edición. Documentos y consentimientos aprovecha una fila completa. Se conservan las seis pestañas y su alternativa «Más» en pantallas pequeñas.
4. **Listado y tablas del paciente.** Filas compactas, estados semánticos, fechas y horas agrupadas. La indicación «Más recientes primero» describe el orden que ya entrega la API. La búsqueda, filtros, paginación y orden permanecen iguales.

## Fidelidad de la información

- Citas conserva los datos y acciones actuales. Los nombres de tratamientos se resuelven con la consulta existente por identificador, incluyendo tratamientos inactivos.
- El profesional de un tratamiento se consulta únicamente cuando la asignación tiene una atención de origen y el usuario tiene acceso clínico. Los registros antiguos sin ese vínculo no reciben un profesional inventado.
- Finanzas utiliza las consultas existentes de resumen de paciente y tratamiento. Pagado, pendiente, vencido y próximo vencimiento se muestran tal como los devuelve la fuente, sin cálculos nuevos. Los movimientos, cuotas y facturas se consultan por paciente y tratamiento para los roles con acceso a la cartera. No se consulta la cartera global para completar la ficha.
- No se agrega un «total facturado» agregado: ese indicador no existe en el contrato del resumen del paciente. Se muestra el importe de una factura solamente cuando la consulta devuelve una factura real.
- Un archivo con metadatos se presenta como «Registrado». No se deduce que esté firmado ni se confunde el consentimiento informado del paciente con el consentimiento de datos personales. La descarga conserva `fetchAttachmentFile` y `downloadBlob`.
- No se añade un backend ni se cambia el modo de almacenamiento. La configuración de demostración/API existente continúa aplicándose.

## Archivos de implementación

- `front/src/modules/patients/components/patient-actions.tsx`
- `front/src/modules/patients/components/patient-ui.tsx` (nuevo)
- `front/src/modules/patients/components/patient-related-tabs.tsx`
- `front/src/modules/patients/pages/patients-list-page.tsx`
- `front/src/modules/patients/pages/patient-form-page.tsx`
- `front/src/modules/patients/pages/patient-detail-page.tsx`
- `front/src/modules/patients/patients.css`

## Validación

La comprobación de hashes en `front/test-results/patients-ui-refinement/scope-verification.json` compara 281 archivos con el estado anterior a este trabajo. Solo cambian seis archivos de presentación y una aserción visual de una prueba existente (altura de controles de 42 a 40 px en escritorio). Los otros 274 archivos siguen idénticos, incluidas las API, modelos, validaciones, cálculos, permisos, almacenamiento, Header, Sidebar, notificaciones, manifiestos, librería y todo el código de historia clínica. También se añaden el componente compartido `patient-ui.tsx`, la nueva batería de pruebas y este informe.

Las dos capturas del odontograma, en claro y oscuro, son idénticas byte por byte a las capturas anteriores.

Pruebas nuevas: `front/tests/patients-ui-refinement.spec.ts`. Se verifican menús y foco, formularios y scroll, las seis pestañas, movimientos financieros frente a sus fuentes, permisos y conservación de los bytes de documentos tras descarga y recarga. La matriz incluye 320, 375, 390, 430, 768, 1024, 1280, 1440 y 1920 px en ambos temas.

Resultados finales:

- **47 casos únicos correctos**, consolidados en `front/test-results/patients-ui-refinement/final-results.json`: 13 de pacientes existentes, 9 del refinamiento, 8 de historia clínica, 8 de navegación clínica, 8 de interacciones generales y 1 de accesibilidad compartida.
- La ejecución completa pasó 42 casos inicialmente. Se corrigieron las esperas de carga y de redistribución de pestañas en la automatización. La prueba financiera se ajustó a los datos reales del resumen: el paciente sin asignaciones conserva sus ceros; los movimientos se comprueban en un paciente con asignaciones existentes. Para comprobar inmutabilidad de una historia vacía, la prueba primero la guarda mediante la API existente, evitando los timestamps nuevos que genera cada lectura de un borrador sin guardar. Los cinco casos afectados se repitieron y quedaron correctos. No se cambiaron las reglas de negocio para adaptar los datos a las pruebas.
- **TypeScript y build de producción correctos**. Persiste la advertencia previa de paquetes mayores de 500 kB.
- **Lint correcto**, con las cinco advertencias preexistentes de Fast Refresh y React Compiler en componentes ajenos a este cambio.
- `http://localhost:5173` responde HTTP 200 y sirve el formulario y los estilos actualizados.

Evidencia visual: `front/test-results/patients-ui-refinement/review.html`, con 42 pares antes/después, y 28 capturas adicionales de pestañas y movimientos en `after/` (70 capturas finales en total).
