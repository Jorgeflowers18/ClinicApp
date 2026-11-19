# Estandarización de controles de ClinicApp

Fecha: 19 de noviembre de 2026. Implementación sobre el frontend existente.

## Resultado y problemas corregidos

Se consolidaron los controles compartidos sin reconstruir páginas ni modificar sus reglas de negocio. Los problemas detectados fueron botones de limpiar con diseños y aparición condicional distintos, filtros comprimidos por el buscador, etiquetas que desaparecían al seleccionar, nombres técnicos durante cargas, menús estrechos y flechas nativas en campos numéricos normales.

La barra conserva una fila cuando dispone de espacio suficiente. En áreas menores se utiliza el panel de filtros existente. La distribución responde al ancho real disponible, también al contraer el Sidebar. Los selectores disponen de etiquetas permanentes y sus menús pueden superar el ancho del control para mostrar el texto completo.

## Componentes reutilizados y estandarizados

| Componente | Resultado |
| --- | --- |
| SearchInput | Se reutiliza sin cambiar su valor, eventos, debounce ni lógica de búsqueda. La barra compartida regula el espacio que recibe. |
| ResponsiveFilterBar | Buscador flexible, filtros proporcionados, reset permanente y panel móvil con scroll interno. Se adapta a grupos compactos, normales y extensos. Reserva también el espacio del contador de filtros. |
| FilterField | Etiqueta superior discreta, asociada al grupo, que sigue identificando el filtro después de seleccionar. |
| ResetFiltersButton | Botón cuadrado neutro con RotateCcw, tooltip accesible y foco visible. Permanece montado, deshabilitado sin filtros activos, y conserva el espacio al habilitarse. |
| Select / SelectValue | Se mantienen los identificadores internos y los mapas de etiquetas. El valor seleccionado conserva su nombre si las opciones se vacían temporalmente. Una opción aún no cargada no se elimina ni se convierte en inválida. |
| SelectContent / DropdownMenu | Límites de viewport, scroll interno, texto completo en las opciones, selección y hover existentes, animación breve y movimiento reducido. |
| Tooltip | Semántica explícita de tooltip, también para los controles de restablecer y nombres largos. |
| Input | Los campos normales de tipo number reciben una clase local que oculta sus spinners. El atributo type y sus validaciones permanecen intactos. Los controles especializados pueden optar por nativeNumberControls. |
| NumericInput | Adornos de presentación para moneda y unidades, manteniendo el valor numérico independiente del prefijo o sufijo. |
| DialogContent / DialogBody | Variantes small, medium, wide y complex; contenido desplazable separado de cabecera y acciones. Se conservan las composiciones aprobadas y sus ajustes responsive locales. |
| AlertDialogContent / FormActions | Confirmaciones limitadas al viewport, acciones simples y el patrón existente de confirmación, foco y retorno al disparador. |

No se introdujeron dependencias, un nuevo gestor de formularios, una segunda gestión de temas ni una arquitectura de navegación alternativa.

## Módulos revisados

| Área | Aplicación |
| --- | --- |
| Panel | Revisión de los controles existentes; no se agregaron filtros ni formularios inexistentes. |
| Pacientes | Reset común; etiquetas de filtros actuales; modales amplios aprobados y acordeones exclusivos conservados. |
| Citas | Profesional y especialidad identificables, reset común, nombres largos completos en el menú, tooltip y título del seleccionado; navegación de fechas y vistas intactas. |
| Historial clínico | Etiquetas Paciente y Profesional, reset compartido, nombre de paciente seleccionado fuera del catálogo inicial, controles numéricos normales y variantes de los modales externos. |
| Tratamientos | Filtros identificables, reset permanente y precio/duración con adornos. Sus acordeones y validaciones se conservan. |
| Inventario / Insumos | Categoría, tipo, proveedor y stock con anchos propios; reset y acción principal alineados. Las etiquetas predeterminadas completas se comprobaron por medidas de texto en escritorio. |
| Compras | Proveedor, estado y fecha identificables; reset compartido y formularios aprobados conservados. |
| Proveedores | Buscador y reset, con el mismo formulario existente. |
| Esterilización | Filtro compacto cuando existe espacio; selección, resultados y registro sanitario sin cambios. |
| Stock crítico | Reutiliza la misma barra y mantiene las cantidades y estados existentes. |
| Finanzas | La cartera reutiliza la barra y conserva importes, estado, saldo, fechas y registros independientes. |
| Reportes / Agenda / Productividad / Tratamientos / Inventario | Periodo con etiqueta legible y reset permanente. Rangos, cálculos y siete exportaciones CSV comprobados. |
| Mensajería | Reset común, incluyendo la salida del mensaje seleccionado; se conservan filtros, borrador y navegación protegida. |
| Notificaciones | El selector utiliza el estándar compartido. No se modificaron generación, lectura, contador ni destinos de alertas. |
| Mi perfil | Selectores y vista previa de fotografía revisados; identidad personal, persistencia e imágenes conservadas. |
| Perfil institucional / Sedes | Editor de sede integrado con la variante compartida, conservando el diseño, los datos y la sincronización institucional existentes. |

En Historial clínico, si el paciente seleccionado no aparece en los primeros 100 del catálogo, se reutiliza la consulta individual existente para mostrar su nombre. Esa lectura no cambia los filtros enviados, resultados, permisos ni datos clínicos. El caso con más de 100 pacientes se prueba en ambos temas.

## Modales y acordeones

Se clasificaron los 16 usos directos de DialogContent y AlertDialogContent encontrados, además de los consumidores de ConfirmDialog y de los wrappers de Inventario.

- Confirmaciones: tamaño compacto y límites de pantalla, conservando los botones y la confirmación existente.
- Pacientes: variante compleja; conserva su editor amplio, navegación por secciones, campos registrados y validaciones.
- Nueva/editar cita y bloquear horario: variante amplia del wrapper existente.
- Detalle de cita: variante mediana con cuerpo desplazable; cabecera y acciones permanecen accesibles.
- Registrar atención: variante compleja con su espacio de trabajo clínico aprobado, selector de pasos, Anterior/Siguiente, grupos exclusivos, validación y guardado con confirmación.
- Notas aclaratorias: variante pequeña, formulario desplazable y acciones fuera del cuerpo.
- Tratamientos: variante amplia; edición precargada, insumos y protección del borrador conservados.
- Inventario: movimiento pequeño; insumo y proveedor medianos; compra compleja; detalle de compra y esterilización amplios. Se respetan sus dimensiones locales ya aprobadas.
- Fotografía de Mi perfil: variante pequeña, con vista previa y confirmaciones existentes.
- Sedes: variante mediana que conserva su modal centrado de 600 px y su cuerpo con scroll.

Los formularios extensos de Pacientes, Tratamientos, Compras, Esterilización y Registrar atención ya utilizaban acordeones exclusivos con keepMounted. Se conservan sus controladores, secuencias de animación, apertura del grupo con errores y valores registrados. No se impuso ese comportamiento a las otras áreas clínicas.

No se crearon modales de pagos, cuotas, seguros, facturación o mensajería que no existen en esta implementación. Los espacios de trabajo complejos mantienen sus límites de viewport y su comportamiento aprobado; no se redujo el área clínica necesaria para trabajar.

En 320 × 480 px se detectó que el lanzador de herramientas de desarrollo podía tapar Listo en el panel de filtros. Se extendió únicamente la protección existente para ocultar ese lanzador mientras el panel identificado esté abierto. No se añadió una regla global sobre los campos o controles de librerías.

## Campos numéricos

La clase local del Input oculta visualmente las flechas de los campos normales que ya utilizan ese componente: precio, duración, cantidades, costos, stock mínimo y medidas clínicas generales.

Se añadieron adornos a precio de tratamiento, costo unitario de Inventario/Compras, duración y unidades de los NumberField clínicos normales. El costo clínico ya tenía su prefijo monetario y se conservó.

Se comprobaron valores vacíos, enteros, decimales, negativos permitidos, selección y reemplazo, ArrowUp, límites y step. No se convirtieron los campos a texto ni se añadieron símbolos al payload. Los controles especializados de la librería dental no utilizan este Input.

## Comportamientos conservados y límites

- Cada módulo sigue controlando sus filtros, valores predeterminados y paginación. El componente de reset solo presenta el botón y ejecuta el callback recibido.
- El reset de Historial clínico sigue restableciendo paciente/profesional y conserva el texto de búsqueda como hacía su callback anterior.
- Se mantienen las X para cerrar, quitar líneas o eliminar elementos; solo se sustituyeron las acciones equivalentes a restablecer conjuntos de filtros.
- Nombres excepcionalmente largos pueden abreviarse en el control cerrado, con el nombre completo disponible dentro del menú; Citas conserva además tooltip y título.
- Una opción pendiente de carga conserva su valor. Los mensajes de error y las restricciones del formulario continúan siendo responsabilidad de cada módulo.
- Se conservan guardado manual, errores, confirmaciones de cambios pendientes, estados de procesamiento y prevención de envíos duplicados.
- No se modificaron resultados de búsqueda, cálculos, existencias, fechas, estados, notificaciones, contratos ni exportaciones.
- No se añadieron funcionalidades inexistentes ni se ejecutaron commits o pushes.

## Pruebas y evidencia

Build y type checking: npm.cmd run build correcto. Lint: sin errores y con las tres advertencias previas de Fast Refresh de Button, Badge y Tabs. El build conserva su aviso previo de paquetes mayores de 500 kB.

Chrome / Playwright: 152 casos distintos aprobados al consolidar los resultados y sus reejecuciones, sin duplicar casos:

| Grupo | Casos |
| --- | ---: |
| Inventario, Tratamientos, Finanzas/Reportes, Pacientes y Mensajería | 90 |
| Barra, filtros y estados de Citas | 10 |
| Nuevas pruebas de estandarización | 14 |
| Regresión clínica, odontograma y perfiles | 33 |
| Switch del Header | 5 |
| Total | 152 |

La última ejecución conjunta de controles, calendario y switch aprobó 27/27; la comprobación final adicional del panel móvil aprobó 2/2. Las pruebas comprueban ambos temas, 320, 360, 375, 390, 430, 768, 1024, 1280, 1440 y 1920 px, además de otros anchos ya cubiertos por las suites existentes, Sidebar abierto/contraído, pantallas de 480 px de alto, foco, Escape, opciones asíncronas, conservación de datos y cálculos.

Durante la validación se ajustaron las pruebas visuales que exigían el recorte anterior de nombres. También se esperó el retorno real del foco después de cerrar confirmaciones. Un caso falló al cargar el runtime de React con ERR_NO_BUFFER_SPACE de Chrome; se comprobó en su traza y se volvió a ejecutar aislado, correctamente. No se presenta esa ejecución inicial como aprobada.

No se ejecutó toda la suite histórica del repositorio: se seleccionaron las regresiones de los componentes y módulos afectados. Las capturas y mediciones finales están en front/test-results/playwright-ui-standardization-accepted, front/test-results/playwright-ui-standardization-mobile-final y front/test-results/ui-standardization/screenshots. La verificación visual se realizó también en localhost:5173, sin errores JavaScript.

## Auditoría de alcance y protección dental

Se compararon 351 archivos de partida. Los 83 archivos protegidos auditados —API, modelos, contratos, stores, utilidades de negocio, embed, periodontograma, vendor, paquetes y switch— mantienen sus hashes originales. Se compararon además 18 declaraciones reales de filtrado, reset, navegación y confirmación, todas sin cambios.

El odontograma y periodontograma permanecen intactos. Su entrada, estilos e integración no se editaron. Sus archivos compilados conservan los mismos identificadores que el build anterior: odontogram-B0VyF-Zx.css y odontogram-33SQCvNn.js. Los estilos nuevos de campos numéricos son locales al Input normal y no entran en el documento aislado de la librería.

La evidencia técnica se conserva en front/test-results/ui-standardization: inventory.json, scope-audit.json, source-before.json, build.txt, lint.txt, visual-results.json y validation-summary.json.

## Archivos de esta implementación

El listado siguiente distingue los cambios de esta tarea de las modificaciones locales de trabajos anteriores, que se conservaron.

- front/src/components/ui/alert-dialog.tsx
- front/src/components/ui/dialog.tsx
- front/src/components/ui/dropdown-menu.tsx
- front/src/components/ui/input.tsx
- front/src/components/ui/select.tsx
- front/src/components/ui/tooltip.tsx
- front/src/modules/appointments/calendar-toolbar.css
- front/src/modules/appointments/components/appointment-detail-dialog.tsx
- front/src/modules/appointments/components/calendar-professional-filters.tsx
- front/src/modules/appointments/components/schedule-form-dialog.tsx
- front/src/modules/auth/components/profile-photo-controls.tsx
- front/src/modules/clinical-history/components/encounter-note-dialog.tsx
- front/src/modules/clinical-history/components/form-controls.tsx
- front/src/modules/clinical-history/components/register-encounter-form.tsx
- front/src/modules/clinical-history/pages/clinical-history-list-page.tsx
- front/src/modules/institution/components/institution-branches.tsx
- front/src/modules/inventory/components/inventory-dialog.tsx
- front/src/modules/inventory/components/inventory-filter.tsx
- front/src/modules/inventory/components/inventory-form-fields.tsx
- front/src/modules/inventory/components/inventory-toolbar.tsx
- front/src/modules/inventory/components/purchase-orders-tab.tsx
- front/src/modules/inventory/inventory.css
- front/src/modules/notifications/pages/notifications-report-page.tsx
- front/src/modules/patients/components/patient-form-dialog.tsx
- front/src/modules/patients/pages/patients-list-page.tsx
- front/src/modules/patients/patients.css
- front/src/modules/reports/components/period-selector.tsx
- front/src/modules/treatments/components/treatment-form-dialog.tsx
- front/src/modules/treatments/pages/treatments-list-page.tsx
- front/src/shared/components/responsive-filter-bar.tsx
- front/src/styles/form-actions.css
- front/src/components/ui/dialog-layout.module.css
- front/src/components/ui/numeric-input.module.css
- front/src/components/ui/numeric-input.tsx
- front/src/components/ui/select.module.css
- front/src/shared/components/filter-controls.module.css
- front/src/shared/components/filter-field.tsx
- front/src/shared/components/reset-filters-button.tsx
- front/src/shared/components/responsive-filter-bar.module.css
- front/tests/calendar-toolbar-filters.spec.ts
- front/tests/finance-reports-redesign.spec.ts
- front/tests/inventory-redesign.spec.ts
- front/tests/messaging-redesign.spec.ts
- front/tests/patients-redesign.spec.ts
- front/tests/treatments-redesign.spec.ts
- front/tests/ui-standardization.spec.ts
- front/tests/fixtures/ui-standardization.tsx
- front/tests/fixtures/original-global-alerts.ts
- docs/global-controls-standardization.md
