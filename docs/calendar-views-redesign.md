# Calendario de citas: Mes, Semana y Día

Implementado el 13 de noviembre de 2026 sobre las vistas existentes de React Big Calendar. Los dos prompts adjuntos contienen la misma especificación. Se conservaron los cambios locales anteriores y se adaptó únicamente el área de Citas a las tres referencias visuales proporcionadas.

**Cambios visuales**

| Área | Resultado |
| --- | --- |
| Mes | Fechas alineadas a la derecha, contorno redondeado para la fecha elegida, indicador independiente de hoy, contadores discretos de citas y eventos compactos. Se mantienen las semanas reales y el mecanismo nativo «+N más». |
| Semana | Siete encabezados con día y fecha, selección con subrayado del primario, líneas horarias discretas y tarjetas con hora, paciente y tratamiento cuando cabe. Los intervalos cortos tienen una composición resumida. |
| Día | Fecha completa y citas con paciente y tratamiento/duración agrupados; el horario queda a la derecha. Se conserva una sola columna horaria y la posición real de los eventos. |
| Estados | Se mantienen los colores semánticos existentes. Las tarjetas horarias usan superficies suaves y borde lateral; cancelaciones conservan el tachado, ausencias el borde discontinuo y bloqueos una trama neutra con candado. Se añade una leyenda con los estados reales. Programada y Confirmada conservan el color compartido del proyecto. |
| Toolbar | Navegación a la izquierda, fecha exacta al centro y vistas agrupadas a la derecha. Controles neutros, foco visible y subrayado violeta/claro o Acid Lime/oscuro. |
| Móvil | Se conservan la agenda compacta de Semana/Día y el desplazamiento interno de Mes. Se aplican acentos semánticos a las tarjetas sin cambiar sus acciones. |

La franja nativa de eventos de día completo conserva su contenido. Se corrigió su distribución para que no cubra las fechas del encabezado semanal. Se verificó tanto la visibilidad como la pulsación de estas fechas.

**Selector y componentes reutilizados**

El selector aprobado no recibió cambios de código ni de CSS. Conserva mes, año, flechas, fecha única, puntos derivados de citas filtradas, pie con fecha elegida, cierre y retorno del foco. Los dos controles Hoy siguen usando la misma función y la fecha local, sin cambiar la vista activa.

Se reutilizan Calendar, su localizador español, sus vistas nativas, AppointmentsToolbar, CalendarDateNavigator, el proveedor de presentación y todos los formularios y diálogos existentes. El proveedor incorpora un mapa de nombres de tratamientos obtenido de la consulta ya disponible; los objetos de eventos permanecen intactos.

TimeEvent representa únicamente el contenido visual de las citas. Su botón nativo permite abrir los detalles con teclado mediante la misma acción de selección de RBC. TimeEventWrapper conserva la geometría y los handlers nativos y elimina el segundo destino de foco del contenedor. No se añadieron flujos de guardado.

**Archivos de este cambio**

- [Estilos locales del calendario](../front/src/modules/appointments/appointments-calendar.css): reglas consolidadas para toolbar, cuadrículas, eventos, agenda y leyenda.
- [Toolbar](../front/src/modules/appointments/components/appointments-toolbar.tsx): iconos de navegación; callbacks conservados.
- [Contenido y proveedor](../front/src/modules/appointments/components/calendar-month-content.tsx) y [contexto de presentación](../front/src/modules/appointments/components/calendar-presentation-context.ts): nombres de tratamientos para los renderizadores, sin nuevas consultas.
- [Contenido de Semana/Día](../front/src/modules/appointments/components/calendar-time-content.tsx): encabezados, contenido de eventos, wrapper de accesibilidad y leyenda; archivo nuevo.
- [Página de Citas](../front/src/modules/appointments/pages/appointments-calendar-page.tsx): conexión de componentes visuales, estado seleccionado y clases de agenda.
- [Regresión mensual](../front/tests/appointments-calendar-redesign.spec.ts): expectativa de selección adaptada del fondo sólido al contorno y texto primario.
- [Pruebas de las tres vistas](../front/tests/calendar-views-visual.spec.ts): archivo nuevo.

No se modificaron dependencias, tokens globales, orden global de CSS, APIs, modelos, persistencia ni datos de demostración. Sidebar, Header, AppLayout y los demás módulos mantienen sus fuentes originales.

**Validación**

- Build aprobado. Continúa el aviso existente de paquetes mayores de 500 kB.
- Lint aprobado: cinco advertencias anteriores en Button, Badge, Tabs, Inventario y Notificaciones; ninguna nueva.
- 72 casos distintos de Playwright con resultado final aprobado, sin contar reejecuciones como casos nuevos: 64 de regresión existente, seis nuevos y dos de interacciones globales del calendario. Los informes conservan los intentos iniciales y las reejecuciones dirigidas.
- Regresión de creación, edición, cancelación, creación/eliminación de bloqueos, filtros y selección de intervalos; navegación entre las tres vistas y fechas lejanas; años bisiestos, cruce de año y fecha local cerca de medianoche UTC.
- Posicionamiento de citas simultáneas y de 15/30/60 minutos; acceso a detalles por teclado y evento que abarca varios días, usando fixtures aislados del navegador. Las semillas del proyecto no cambian.
- Comprobados 320, 360, 375, 390, 430, 600, 768, 1024, 1280, 1440 y 1920 px en ambos temas. En escritorio se verificó el Sidebar expandido y contraído; en móvil, apertura/cierre del panel y calendario accesible tras cerrarlo. Sin desplazamiento horizontal global.
- Conservados los 24 horarios, incluidos 00:00 y 23:00, y la altura existente de 72 px por hora. Sin cambios de `step`, `timeslots`, `min`, `max` ni algoritmo de superposición. Las filas de Mes mantienen 96–112 px en escritorio y 128 px en la adaptación táctil.
- Comparación de 244 archivos iniciales: solamente seis archivos existentes del alcance cambiaron y se añadieron dos de frontend/pruebas. Los nueve helpers/handlers protegidos son idénticos; renderAgendaEvent solo cambia atributos y clases de presentación. El cálculo de eventos y todos los callbacks anteriores de la página son idénticos.

**Comparación visual y evidencia local**

Se obtuvieron y revisaron capturas reales de las tres vistas, del selector y de la agenda móvil en ambos temas. La comparación con las referencias fue visual: jerarquía, superficies, eventos, encabezados, espaciado, selección y bordes. No se afirma igualdad píxel a píxel con las imágenes del chat: el contenido, la escala horaria y la navegación global corresponden a ClinicApp.

- [Comparador interactivo antes/después](../front/test-results/calendar-views-redesign/comparison.html).
- [Mes oscuro](../front/test-results/calendar-views-redesign/after/frame-month-dark.png), [Semana oscura](../front/test-results/calendar-views-redesign/after/frame-week-dark.png), [Día oscuro](../front/test-results/calendar-views-redesign/after/frame-day-dark.png).
- [Mes claro](../front/test-results/calendar-views-redesign/after/frame-month-light.png), [Semana clara](../front/test-results/calendar-views-redesign/after/frame-week-light.png), [Día claro](../front/test-results/calendar-views-redesign/after/frame-day-light.png).
- [Agenda móvil](../front/test-results/calendar-views-redesign/after/day-dark-390.png) y [selector](../front/test-results/calendar-views-redesign/after/selector-dark-1440.png).
- [Resumen de pruebas](../front/test-results/calendar-views-redesign/test-summary.json) y [verificación de alcance](../front/test-results/calendar-views-redesign/scope-verification.json).

Doce instantáneas de estructura y estilos de Login/Header/Sidebar no presentan diferencias. De las 16 capturas de áreas protegidas, 15 son idénticas; Historia clínica clara difiere en dos píxeles con diferencia máxima de un nivel de canal. Su código no cambió. El selector conserva geometría e interior; las diferencias de borde en escritorio corresponden a su composición sobre el calendario rediseñado. Las capturas móviles del selector son idénticas.

La automatización utiliza Chrome y zona horaria America/Guayaquil. Las capturas comparativas fijan el reloj al 11 de noviembre de 2026 para repetir los mismos datos de demostración; la aplicación sigue utilizando la fecha local actual. No se realizó una auditoría exhaustiva de lectores de pantalla ni una matriz de navegadores adicionales.

Los artefactos de `front/test-results` son locales y están excluidos de Git. Se conserva la rama `main` con cambios locales anteriores y actuales, sin crear commits ni publicar al remoto. Localhost permanece en http://localhost:5173.
