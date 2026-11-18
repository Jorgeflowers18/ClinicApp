# Auditoría y rediseño de Pacientes

Implementación del 14 de noviembre de 2026. Se auditó el código antes de modificarlo y se conservaron los cambios locales anteriores.

## Auditoría previa y alcance

Se revisaron las tres páginas de Pacientes, sus tipos y esquema Zod, funciones Mock/Real, claves de React Query, rutas y permisos. También se revisaron sus relaciones con citas, tratamientos, finanzas e historia clínica, los componentes compartidos y las pruebas existentes.

El listado original solo ofrecía búsqueda básica y eliminación. El formulario omitía campos ya existentes —aunque los preservaba al editar— y permitía introducir manualmente la última visita. La ficha colocaba sus tarjetas antes de las pestañas; Citas y Tratamientos solo mostraban enlaces.

`back/README.md` confirma que la API .NET todavía no se ha inicializado. La carpeta contiene documentación y backlog, sin controladores, modelos relacionales ni proyecto compilable. Tampoco hay un servidor Node.js ni esquema de base de datos en este repositorio. Se implementó sobre la arquitectura real del frontend, sin crear otro backend ni simular una migración.

Se guardaron los hashes de 275 archivos y las capturas previas. Se protegieron expresamente 63 archivos de historia clínica, integración dental, paquete vendorizado, entrada del odontograma y manifiestos de dependencias.

## Implementación

### Listado

- Encabezado compacto y cuatro contadores obtenidos de consultas paginadas existentes: registrados, activos, en seguimiento e inactivos. Son totales globales, independientes del filtro visible. Se conservan también los pacientes pendientes, accesibles mediante su filtro.
- Búsqueda por nombres, apellidos, documento, teléfono y correo, con coincidencias sin distinción de mayúsculas o tildes. Estado visible y filtros avanzados desplegables por género y rango inclusivo de registro; limpiar reinicia los criterios y la página.
- Tabla con identidad y documento agrupados, iconos discretos, estados semánticos, fecha y acciones. Se reutilizan `DataTable` y sus tarjetas móviles, así como la paginación y el orden descendente por registro.
- Menú con perfil, edición, agenda e historia clínica cuando el rol lo permite. Desactivación y reactivación requieren confirmación.
- La interfaz cambia el estado mediante el `PUT` existente, sin enviar una eliminación. El método de eliminación heredado del mock también se convirtió en baja lógica; conserva identificador, historia, citas, asignaciones y pagos.

### Registro y edición

- Cuatro secciones nativas desplegables, accesibles con teclado, sin desmontar los campos al cerrarlas. Los errores abren la sección correspondiente y dirigen el foco al campo.
- Datos personales, contacto, emergencia/seguro y consentimientos/preferencias. Se incorporaron a la edición los campos que ya existían: estado civil, ocupación, empresa, nacionalidad, ciudad/provincia y parentesco. Ciudad/provincia mantiene el campo combinado actual; no se inventó una columna adicional.
- Tipo de documento opcional en el contrato, compatible con registros anteriores; selector de cédula, pasaporte u otro documento en el editor. Los documentos heredados sin tipo no se convierten automáticamente en cédulas.
- Validación local de formato y dígito verificador para cédulas seleccionadas como tales, fechas válidas no futuras y edad calculada por cumpleaños, incluidos años bisiestos. No se consulta la emisión ni la titularidad en el Registro Civil.
- Teléfonos y correo pueden quedar vacíos. Se admiten formatos habituales de teléfono, prefijo internacional, paréntesis y extensión. Se conserva el error de formato cuando el dato se ingresa incorrectamente.
- El adaptador mock valida antes de escribir y rechaza documentos duplicados normalizando espacios y mayúsculas, tanto al crear como al editar. Un conflicto no modifica el registro existente. Los errores no borran el borrador.
- Se preservan todos los campos actuales, el número de historia y los datos relacionados. Los switches conservan sus valores; `consentSigned` no se mezcla con `record.dataConsent`, que sigue siendo el consentimiento de datos personales de la historia.
- Campos de 42 px en escritorio y 44 px en dispositivos pequeños. Barra de acciones separada del área desplazable, visible sin tapar los campos; se comprobó también su área de clic en localhost a 320, 375 y 430 px.
- Última visita de solo lectura: se obtiene de atenciones registradas y citas completadas, usando los servicios existentes y respetando el acceso clínico. El campo heredado `lastVisitAt` se conserva en el contrato y no se sobrescribe desde esta presentación.

### Ficha individual

- Encabezado con iniciales, nombre, documento, edad, historia y estado. Acciones de editar, agendar y menú adicional.
- Pestañas inmediatamente debajo: Resumen, Citas, Historial clínico según rol, Tratamientos, Finanzas y Documentos. `AdaptiveTabs` mantiene el acceso a las pestañas que no caben en el ancho disponible.
- Cinco tarjetas de altura natural: contacto, estado/observaciones, datos personales, emergencia/seguro y documentos/consentimientos. No se fijan alturas ni se duplican anotaciones clínicas.
- Citas y tratamientos presentan consultas de sus módulos actuales; las operaciones continúan en sus componentes y rutas originales. La agenda reutiliza `AppointmentFormDialog`, con una propiedad opcional para precargar al paciente, incluso si no está entre las primeras 100 opciones.
- Se reutilizan `PatientClinicalSummary`, el resumen financiero y los servicios de archivos existentes. Los documentos clínicos solo se consultan con rol autorizado. Recepción no recibe una pestaña de historia ni consulta sus archivos clínicos.
- El resumen financiero conserva su visibilidad anterior; el enlace a la cartera general se muestra únicamente a los roles autorizados para esa pantalla.

Se mantuvieron los tokens existentes: violeta en modo claro y Acid Lime en oscuro, con colores semánticos para los estados. No se modificaron Sidebar, Header, autenticación ni rutas.

## Odontograma: comprobación crítica

**No se modificó ningún archivo de su implementación o librería.** No se cambiaron versión, dependencias, eventos, propiedades, estructuras dentales, selección, cálculos, estilos internos, guardado ni integración.

- Los 63 archivos protegidos conservan sus hashes previos.
- Las capturas de la cuadrícula dental antes y después son idénticas byte por byte en claro y oscuro.
- Pasaron los casos existentes de selección y edición dental, plan, consentimiento, adjuntos, guardado, exportaciones, registro de atenciones, navegación y restricciones clínicas.
- En `tests/dental-history.spec.ts` solo se añadieron dos pasos de navegación por los nuevos contenedores de Pacientes: abrir Contacto y volver a seleccionar la pestaña de historia. Se conservaron sus comprobaciones de datos y del odontograma.

## Archivos

Modificados:

- `front/src/modules/patients/pages/patients-list-page.tsx`
- `front/src/modules/patients/pages/patient-form-page.tsx`
- `front/src/modules/patients/pages/patient-detail-page.tsx`
- `front/src/modules/patients/patients.css`
- `front/src/modules/patients/types/patient.types.ts`
- `front/src/modules/patients/api/patients.api.ts`
- `front/src/modules/patients/api/patients.queries.ts`
- `front/src/modules/appointments/components/appointment-form-dialog.tsx`
- `front/tests/dental-history.spec.ts`

Nuevos:

- `front/src/modules/patients/components/patient-actions.tsx`
- `front/src/modules/patients/components/patient-status.tsx`
- `front/src/modules/patients/components/patient-related-tabs.tsx`
- `front/src/modules/patients/hooks/use-patient-last-visit.ts`
- `front/src/modules/patients/lib/patient-validation.ts`
- `front/tests/patients-redesign.spec.ts`
- Este informe.

Se reutilizan los controles de UI, `DataTable`, `PaginationBar`, `PageHeader`, `AdaptiveTabs`, `ConfirmDialog`, consultas y fuentes existentes. No se instalaron dependencias ni se creó una versión alternativa del odontograma, calendario o historia clínica.

## Pruebas y evidencia

- Frontend build: aprobado.
- Lint: sin errores; permanecen cinco advertencias preexistentes de componentes ajenos a este cambio.
- **38 casos únicos aprobados:** 13 del nuevo módulo y su API mock, 8 de historia dental, 8 de navegación clínica, 8 de interacciones globales y 1 de accesibilidad compartida. Los casos afectados por los nuevos pasos de UI se corrigieron y se reejecutaron individualmente; el consolidado conserva el último resultado de cada caso y enlaza su ejecución original.
- Alta y edición con todos los campos; secciones cerradas; concordancia de edad; contacto opcional; cédula inválida y pasaporte; duplicados al crear y editar; atomicidad ante rechazo; confirmación/cancelación; desactivación y reactivación con relaciones intactas; agenda precargada y citas actualizadas; última visita derivada y permisos de los tres roles.
- Tres pantallas × ocho anchos × dos temas: **48 combinaciones**, sin desbordamiento horizontal global. Anchos: 320, 375, 430, 768, 1024, 1280, 1440 y 1920 px. Se revisaron las capturas y se comprobaron controles, footer y acceso a pestañas.
- Regresiones clínicas adicionales en once anchos, teclado y tacto; formularios, calendario y diálogos también comprobados en paisaje y con espacio reducido.
- Comprobación adicional de teléfonos locales/internacionales, extensión, campos vacíos, fechas bisiestas y dígitos verificadores.

Evidencias locales, excluidas de Git:

- [Comparación visual antes/después](../front/test-results/patients-redesign/review.html).
- [Resultados consolidados por caso](../front/test-results/patients-redesign/final-results.json).
- [Verificación de archivos y odontograma](../front/test-results/patients-redesign/verification.json).
- Capturas y mediciones en `front/test-results/patients-redesign/before/` y `after/`; logs `build.log` y `lint.log` en el mismo directorio.

## Backend, base de datos y límites reales

**No se modificó ni migró una base de datos. No hay backend ejecutable que compilar en este repositorio.** El frontend sigue usando el modo de demostración existente: los pacientes se mantienen en memoria y se reinician al recargar; la historia clínica conserva su mecanismo de almacenamiento anterior.

Cuando se implemente la API .NET documentada, el servidor deberá soportar los parámetros de listado `status`, `gender`, `registeredFrom` y `registeredTo`, la búsqueda por correo, el campo opcional `documentType` y el contacto opcional. Debe aplicar autorización, validación, unicidad transaccional de documentos, baja lógica y auditoría en la base de datos. Las validaciones del cliente y del adaptador mock no sustituyen esas garantías del servidor.

Permanecen el aviso existente de tamaño de algunos chunks y las cinco advertencias de lint anteriores. No se crearon commits ni se publicaron cambios. La aplicación continúa disponible en http://localhost:5173.
