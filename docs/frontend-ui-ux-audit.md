# Auditoría del frontend de ClinicApp

Solicitud: 11 de noviembre de 2026. Auditoría de la implementación local antes de esta fase. Se conservan los cambios de UI/UX y navegación clínica de la fase anterior; no se parte de un checkout limpio.

## Inventario y diagnóstico

React 19, TypeScript, Vite, Tailwind 4, Base UI, React Day Picker y React Big Calendar ya están instalados. Los tokens y las dos paletas están en `front/src/styles/tokens.css` y `themes.css`. Se contrastaron con `DESIGN.md` y `variables.css` facilitados por el usuario. Se reutilizarán estas definiciones, sin importar una paleta externa sobre el modo claro.

| Módulo/patrón revisado | Hallazgo al comenzar | Recomendación | Prioridad / riesgo |
| --- | --- | --- | --- |
| Citas / calendario de escritorio | El rango es un texto de RBC; no permite salto directo a otra fecha. | Toolbar local que conserve los callbacks de RBC y convierta el título en un trigger accesible. | Alta / medio: fecha, vista, foco. |
| Citas / agenda compacta | Hay un picker mensual sin acceso directo a mes/año. | Compartir el nuevo selector con la agenda, conservando el único estado de fecha de la página. | Alta / medio: responsive, fecha local. |
| Selector de tema | `SidebarContent` etiqueta el tema actual, aunque el callback activa el opuesto. | Cambiar únicamente la etiqueta visible/accesible por el destino del cambio. | Alta / bajo: excepción expresa al componente protegido. |
| Pestañas y selectores internos | Superficies activas neutras sin un indicador de acento uniforme. | Subrayado o indicador lateral solo en la opción activa; superficies neutras para el resto. | Alta / bajo: CSS limitado al contenido. |
| Inventario | DataTable ya conserva nombre/categoría y riesgo en badge. Stock, mínimo y costo no comparten alineación numérica. | Añadir los identificadores reales de esas columnas al patrón de cifras tabulares; mantener badges y acciones. | Media / bajo. |
| Notificaciones | Variables, editor y vista previa están apilados incluso con espacio amplio. Guardar ya usa los estados reales de RHF. | Dos áreas relacionadas en escritorio, una columna en móvil; preservar inserción, preview, dirty y guardado. | Alta / medio: foco del textarea. |
| Pacientes, Tratamientos, listados clínicos | Densidad, tarjetas móviles y paginación condicional ya implementadas. | Conservar; extender los indicadores compartidos sin modificar consultas o resultados. | Media / bajo. |
| Finanzas y Reportes | Tablas y vistas adaptativas existentes; sus acciones y formatos tienen significado propio. | Jerarquía de encabezados y selección compartida; preservar cálculos, datos y exportaciones. | Media / medio si se alterase lógica: no se hará. |
| Panel y resúmenes clínicos | KPI compactos, informativos y neutros ya implementados. | Conservar sus medidas y cálculos. | Baja / bajo. |
| Formularios administrativos y perfiles | Grids responsive, labels e inputs compartidos existentes. | Mantener densidad previa y mejorar estados secundarios/focus compartidos. | Media / bajo. |
| Historia clínica | Nueve principales y Evolución periodontal adicional ya aprobadas; guardado separado. | Mantener organización, montaje y datos; no editar el iframe, SVG ni las reglas clínicas. | Protegido / alto. |
| Login, Header, AppLayout y Sidebar | Diseño aprobado; el área de contenido es `main.clinic-app-canvas`. | Conservar archivos y estilos, salvo la única etiqueta de tema autorizada. | Protegido / alto. |

## Decisiones previas a implementación

- No añadir dependencias, endpoints ni cambios de modelo o persistencia.
- Un único `date`/`setDate` controla RBC y la agenda. El mes que se explora dentro del popover es solo un cursor de navegación; no modifica la fecha visible hasta elegir un día.
- El año admite ingreso directo, sin una lista limitada a pocos años. Se comprueba únicamente que pueda representarse como fecha local de JavaScript; no se inventan límites del negocio.
- Se mantienen Hoy/Anterior/Siguiente y Mes/Semana/Día, las 24 horas, eventos, bloqueos y selección de intervalos.
- Se conserva el trabajo anterior. Baseline de hashes y Git en `front/test-results/frontend-redesign/`.
- Verificación prevista: build/lint, regresión existente, nuevos casos de salto a marzo de 2027 en las tres vistas, años lejanos, teclado, fecha local, ambos temas y matriz de anchos.

## Cierre de la auditoría

Los cambios se implementaron y validaron. La suite general aprobó 135/135 casos; el archivo final de esta fase aprobó 18/18, con solapamiento de casos entre ejecuciones. Build y lint correctos, conservando sus avisos previos. Se verificaron 137 casos distintos en total. Las comparaciones de áreas protegidas no encontraron cambios de estilo ni geometría, salvo el texto de tema autorizado.

El detalle de archivos, resultados, evidencias y limitaciones está en [frontend-redesign-implementation.md](frontend-redesign-implementation.md). Los componentes que ya cumplían las pautas se conservaron y las mejoras se concentraron en los hallazgos de esta tabla.

## Fase 4 — 12 de noviembre de 2026

La revisión posterior detectó el mínimo compartido de 104 px, separación estructural de etiqueta e importe en Finanzas y agrupación mejorable de la cartera móvil. Se adoptó altura natural, composición continua de label/valor/ayuda, iconografía semántica y cifras alineadas. El Sidebar recibe exclusivamente el indicador activo del tema y un Switch real de Modo oscuro, usando la lógica y persistencia existentes.

El diagnóstico, archivos, medidas, pruebas y límites de esta fase se documentan en [frontend-phase4-implementation.md](frontend-phase4-implementation.md). No se eliminan los resultados históricos de las fases previas.
