# Mensajería y Notificaciones: auditoría, rediseño y validación
Fecha: 19 de noviembre de 2026.

Se separó la comunicación con pacientes del centro de avisos internos, sobre el frontend existente. Se conservaron las rutas, permisos, contratos, preferencias de pacientes y mecanismos de persistencia. Los cambios anteriores de Tratamientos, Inventario, Finanzas y Reportes permanecen intactos.

## Hallazgos de la auditoría
- Historial y plantilla compartían una pantalla larga; el editor podía reinicializarse durante una actualización de datos.
- El listado resolvía pacientes solo en la primera página de 100 registros.
- La campana mostraba contador y punto de importancia al mismo tiempo.
- El panel repetía categorías y reservaba demasiado espacio para acciones y etiquetas.
- Los tipos disponibles son recordatorio, confirmación y cancelación de cita; los canales son Correo y SMS. Solo existen estados internos enviada y fallida.
- NotificationLog no contiene cuerpo enviado, destinatario ni motivo de fallo. No existe un endpoint de consulta individual ni una operación de reintento.
- Las semillas actuales contienen ocho mensajes, siete enviados y uno fallido. Por eso la interfaz muestra 8 / 7 / 1 / 88%, en lugar de copiar los cinco registros ilustrativos de la referencia.

## Nombres y navegación
El Sidebar muestra MessagesSquare + Mensajería, dentro de Comunicación. El breadcrumb usa el mismo nombre. La ruta continúa siendo `/notificaciones` y mantiene acceso para administrador y recepción. El médico conserva sus restricciones.

La campana y su panel se denominan Notificaciones. El enlace inferior es Ir a Mensajería. Las preferencias de comunicación de los pacientes y los nombres internos de APIs, estados y tokens no se renombraron.

## Mensajería
- Historial de envíos es la pestaña inicial. Plantillas de mensajes tiene su propio apartado, con contenido montado después de la primera apertura para conservar el borrador al alternar pestañas.
- Los indicadores se calculan sobre el catálogo completo de registros, compartiendo las consultas que ya usa el Header. Nunca se agregan únicamente los diez registros de una página.
- Los errores de consulta no se presentan como totales cero. Sin registros, la tasa es —; no se afirma un éxito sin denominador.
- La aclaración distingue envío de entrega y lectura.
- Búsqueda por nombre o identificación; filtros reales por canal, estado, tipo y fechas; filtros activos visibles y limpieza conjunta.
- Se conservaron las comparaciones originales de fechas del endpoint, incluido su límite superior UTC. La presentación mantiene el formateador y la zona horaria existentes.
- La tabla conserva Paciente, Tipo, Canal, Fecha de envío y Estado. El paciente incluye iniciales, nombre e identificación. En anchos reducidos se reutilizan las tarjetas de DataTable sin ocultar información.
- Los estados visibles Enviado y Fallido utilizan iconos y colores semánticos; no cambian los valores internos.
- Un aviso de fallo abre el mensaje real mediante `?envio=ID`, incluso si había filtros incompatibles. Mostrar todos los mensajes vuelve al historial sin esa selección y limpia los filtros.
- No se agregaron WhatsApp, estados de entrega/lectura, reintentos ni contenido de mensajes inexistente. Para el fallo se informa Motivo no disponible.

## Plantilla
Se conservan la única plantilla predeterminada, el esquema de validación y sus cinco tokens exactos:
- `[nombre del cliente]`
- `[nombre de la clínica]`
- `[fecha de la cita]`
- `[hora de la cita]`
- `[profesional]`

Las etiquetas visibles usan Nombre del paciente, Clínica, Fecha de cita, Hora de cita y Profesional. La inserción respeta cursor, selección y foco.

En escritorio, editor y vista previa comparten dos columnas; en anchos pequeños se apilan. La vista previa usa los ejemplos existentes, identifica a la clínica de ejemplo, conserva variables desconocidas y no simula un envío.

El contador corresponde al texto de la plantilla, sin límites nuevos ni estimaciones de segmentos o costos SMS. Guardar conserva el color primario, los estados de procesamiento, errores y confirmación; no tiene barra decorativa.

El formulario se inicializa una vez por apertura. Tanto una actualización exitosa como una consulta fallida en segundo plano conservan el borrador. Un error inicial muestra una acción de reintento, sin abrir un formulario vacío sobre los datos.

La protección del borrador cubre cambios de pestaña, enlaces del Sidebar, navegación programática del menú personal, recarga y Atrás/Adelante del navegador. Usa un adaptador de contexto sobre BrowserRouter, sin sustituir el router ni mutar su navigator. Un listener temprano permite restaurar el historial antes de que una navegación Atrás desmonte el editor. La confirmación es un AlertDialog y el aviso de recarga usa el mecanismo nativo del navegador. Al confirmar descarte se restaura la última plantilla guardada.

## Centro de Notificaciones
- Un solo contador, anclado a la campana, con primario y contraste del tema; desaparece a cero y muestra 99+ sobre 99. La etiqueta accesible conserva el número completo.
- Carga o consulta incompleta tienen una presentación explícita y no afirman cero pendientes.
- Panel de referencia de 420 px, limitado por el viewport y la altura disponible; solo la lista se desplaza. Encabezado, filtros y nota de lectura local siguen accesibles.
- No leídas, Todas e Importantes conservan su lógica. El selector muestra Todos los tipos y utiliza Select con opciones legibles.
- Inventario usa Package y ámbar; citas, CalendarClock y cian; cumpleaños, Cake y violeta; fallos de mensaje, MailWarning y rojo.
- Las unidades se presentan correctamente en singular/plural, reutilizando inventoryUnit. Los valores y umbrales no se modifican.
- Una cita futura puede decir Próxima cita y mostrar minutos restantes; una hora ya pasada se presenta como Cita de hoy. Se conservan las condiciones originales que generan avisos, sin cambiar estados de citas.
- Los cumpleaños no exponen edades ni generan felicitaciones automáticas.
- Marcar como leída permanece separado del enlace relacionado. El contador cambia y el aviso sigue disponible en Todas. La salida de No leídas tiene una transición breve, desactivada con movimiento reducido.
- Marcar todas como leídas afecta al total de pendientes, aunque se esté filtrando una categoría.
- La lectura sigue guardándose en el mismo localStorage por usuario y navegador. Marcar una alerta no resuelve su causa operativa.
- Se conservan actualizaciones, recuperación de errores y restricciones por rol.

## Archivos modificados
Existentes:
- `front/src/app/nav-config.ts`
- `front/src/app/layout/app-layout.tsx`: únicamente integración del proveedor de protección del borrador, sin añadir elementos al DOM.
- `front/src/modules/notifications/pages/notifications-report-page.tsx`
- `front/src/modules/notifications/components/notification-template-editor.tsx`
- `front/src/modules/notifications/components/global-notification-center.tsx`
- `front/src/modules/notifications/components/global-notification-center.module.css`
- `front/src/modules/notifications/components/use-global-alerts.ts`: textos y metadatos de presentación; condiciones, IDs, orden e importancia conservados.

Nuevos, bajo `front/src/modules/notifications/`:
- `components/message-status.tsx`
- `components/messaging-draft-provider.tsx`
- `hooks/use-messaging-catalog.ts`
- `hooks/use-template-navigation-guard.ts`
- `hooks/messaging-draft-context.ts`
- `hooks/messaging-history-events.ts`
- `messaging.css`

Se reutilizaron Button, Badge, Select, Input, AdaptiveTabs/Tabs, Popover, Tooltip, AlertDialog, DataTable, PaginationBar, Skeleton, Avatar, BrandLogo, KpiCard, los formateadores y las consultas completas existentes. No se instalaron dependencias ni se cambiaron estilos globales.

Pruebas nuevas: `front/tests/messaging-redesign.spec.ts`.
Se adaptaron las etiquetas y selectores en `navigation-shell.spec.ts`, `navigation-iconography.spec.ts`, `header-theme-switch.spec.ts`, `frontend-redesign.spec.ts`, `form-actions.spec.ts`, `global-design-system.spec.ts` y `global-interactions.spec.ts`. Esta entrega no afirma haber ejecutado íntegramente todos esos archivos; abajo se indica la selección efectivamente probada.

## Validación ejecutada
**50 pruebas distintas aprobadas**, contando los últimos resultados de cada caso:
- 21 nuevas: catálogos de 129 mensajes y pacientes fuera de la primera página; filtros combinados y paginación; tokens y selección; borradores y guardados rechazados; navegación y recarga; lectura, selección de un mensaje y limpieza de filtros; cero, uno y más de 99 avisos; fechas y estados; errores de consulta; roles; nombres extensos; plantilla extensa; comparaciones contra las reglas originales.
- 16 regresiones de lectura local, errores de almacenamiento, recuperación de consultas, permisos, agregación, edición de plantilla y acciones administrativas.
- 11 regresiones de iconografía, menú hamburguesa/X y switch de tema.
- 2 regresiones clínicas: edición, odontograma, plan, consentimiento, archivos, guardado y exportaciones; migración de visitas anteriores.

Se comprobaron 320, 360, 375, 390, 430, 600, 768, 1024, 1280, 1440 y 1920 px, ambos temas, menú expandido/contraído, teclado, movimiento reducido, selectores anidados y pantallas de poco alto de 390 × 380 y 720 × 450 px.

Durante la validación se corrigieron la pérdida de borrador por fallo de refresco, la interceptación de Atrás antes del desmontaje y el acceso a un mensaje que tenía filtros anteriores incompatibles. Los casos correspondientes pasan después de las correcciones.

Las pruebas usan contextos de Chrome aislados y datos de demostración. No se realizaron envíos reales. El servidor temporal de validación utiliza caché de Vite independiente para evitar que la recarga de módulos durante el desarrollo altere los mocks de una prueba.

Build y TypeScript correctos. Lint sin errores y con tres advertencias previas de Fast Refresh en Button, Badge y Tabs. El uso de useWatch en el editor elimina la advertencia anterior de watch. Vite conserva el aviso de tamaño de algunos bundles. `git diff --check` correcto.

Se generaron 12 capturas anteriores y 12 finales en `front/test-results/messaging-redesign/`. Son evidencias locales ignoradas por Git. Las ejecuciones utilizan subdirectorios de salida para no borrarlas.

## Conservación de componentes protegidos
La auditoría SHA-256 compara 168 archivos protegidos contra el inicio de esta intervención, incluidos archivos que ya tenían cambios locales de trabajos anteriores: no presentan cambios.

Las APIs y tipos de Mensajería, la persistencia de lectura, los módulos ya estandarizados, los componentes clínicos y el switch conservan sus fuentes. La comparación de funciones confirma que collectAlertPages, useGlobalAlerts y la sustitución applyPreview siguen idénticas. Un caso adicional compara IDs, orden, umbrales, importancia y destinos contra el constructor anterior de avisos.

No se modificaron backend, librería odontológica, dependencias ni versiones. Odontograma y periodontograma permanecen intactos, con las dos pruebas clínicas anteriores aprobadas.

## Límites conservados
El historial no aporta cuerpo enviado, destinatario o causa del fallo, ni un reintento real; esas funciones no se simulan. El detalle enlazado consulta el registro disponible en el historial.

Los ejemplos y cambios de plantilla del modo demostración conservan su almacenamiento actual. La lectura local no se anuncia como sincronizada entre dispositivos. La completitud de los indicadores depende de obtener todas las páginas de la API; si falla la consulta, no se presenta un agregado parcial como total.

No se realizaron commits, pushes ni cambios de rama. La aplicación principal continúa en `http://localhost:5173/notificaciones`.
