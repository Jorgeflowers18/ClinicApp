# Sidebar, Header y menú personal

Implementación y verificación del 14 de noviembre de 2026.

## Resultado

El Sidebar se dedica a navegar. El Header reúne la expansión de la navegación, las migas de pan, el selector de tema, la campana y el menú personal. Las rutas, permisos, autenticación y persistencia de perfiles se mantienen.

| Grupo | Opciones, sujetas a los permisos anteriores |
| --- | --- |
| General | Panel |
| Atención clínica | Pacientes, Citas, Historial clínico, Tratamientos |
| Gestión | Inventario, Finanzas, Reportes |
| Comunicación | Notificaciones |

Mi perfil, Perfil institucional y Cerrar sesión aparecen en el dropdown del usuario. El acceso institucional continúa limitado a administración. El menú muestra fotografía o iniciales, nombre confirmado y rol; no publica los borradores del formulario de perfil. La foto y los cambios de nombre siguen utilizando el estado y el guardado existentes.

El Sidebar mide 268 px expandido y 72 px contraído. En tablet comienza contraído; por debajo de 768 px se presenta como Drawer. Tiene scroll interno, enlaces de 44 px, iconos uniformes, grupos discretos, tooltips al contraer e indicador activo con los tokens originales.

El Header mide 64 px. En espacios reducidos el usuario se presenta mediante su avatar y las migas de pan se ajustan al espacio disponible. El switch usa `next-themes`, refleja `resolvedTheme` y conserva la preferencia existente, incluida la sincronización entre pestañas. El sol identifica claro y la luna oscuro; el indicador utiliza violeta o Acid Lime según el tema.

## Auditoría y alcance de la campana

La inspección no encontró un centro global ni una campana anterior en el Header. El módulo existente de Notificaciones contiene el historial de envíos y el editor de plantillas. Se conservaron sus servicios, contratos, callbacks, rutas y permisos, y se añadió un panel global que consulta las fuentes ya disponibles:

| Fuente | Alertas derivadas |
| --- | --- |
| Inventario | Insumos con existencias iguales o inferiores al mínimo. |
| Citas | Citas programadas o confirmadas del día actual; excluye canceladas, completadas y no asistidas. |
| Pacientes | Cumpleaños del día según la fecha registrada. |
| Envíos | Registros cuyo estado real es `fallida`; no se modifica el estado de entrega. |

Inventario y fallos de envío se muestran únicamente a administración y recepción, de acuerdo con sus permisos existentes. El personal médico consulta citas y cumpleaños. Las consultas paginadas recorren todas sus páginas y deduplican registros, para no presentar la primera página como si fuera el total.

Los datos utilizan las APIs actuales y su selección existente entre demostración y servidor. Se comparte la caché de React Query y los prefijos de invalidación de cada módulo, de modo que las modificaciones existentes actualizan las consultas del panel. Las fuentes del panel se revisan periódicamente cada cinco minutos; el usuario también puede actualizar manualmente. El día actual se recalcula para actualizar citas y cumpleaños.

La campana muestra el número de alertas sin leer y un indicador de importantes sin leer. Tiene filtros No leídas, Todas, Importantes y por tipo. Permite marcar una alerta o todas como leídas y abrir el módulo relacionado. El enlace Historial de envíos abre el historial existente, con los mismos permisos; se distingue del listado global de alertas.

**La lectura se guarda localmente por usuario**, en `clinicapp.global-alert-reads.<id>`. No existía un contrato de lectura remota y no se inventó uno. Una escritura fallida mantiene los indicadores sin leer y muestra el error. Una consulta incompleta o un estado local ilegible no se presenta como un contador de cero. La lectura local no modifica inventario, pacientes, citas, envíos ni plantillas.

## Archivos de implementación

| Archivos | Responsabilidad |
| --- | --- |
| `front/src/app/layout/app-layout.tsx` y `.css` | Grupos, dimensiones, Drawer, Header, breadcrumb y adaptación responsive. |
| `front/src/app/layout/header-theme-switch.tsx` y `.module.css` | Selector real de tema trasladado desde `sidebar-theme-switch`. |
| `front/src/app/layout/header-user-menu.tsx` y `.module.css` | Menú personal e institucional y callback original de cierre de sesión. |
| `front/src/modules/auth/components/user-avatar.tsx` | Se añade la ubicación visual `menu` al tipo del avatar compartido; no cambia su lógica de fotografía. |
| `front/src/modules/notifications/components/global-notification-center.tsx` y `.module.css` | Campana, panel, filtros, acciones de lectura y enlaces. |
| `front/src/modules/notifications/components/use-global-alerts.ts` | Consultas existentes y derivación de alertas de presentación. |
| `front/src/modules/notifications/components/use-alert-reads.ts` | Lecturas locales por usuario, sincronización del navegador y errores. |

El antiguo selector del Sidebar se trasladó a los archivos del Header. Los componentes compartidos de Switch, Sheet, DropdownMenu, Popover y Tooltip se reutilizan sin modificaciones. No se cambiaron tokens, rutas, modelos, endpoints, servicios de autenticación ni reglas de envío.

Se actualizaron los selectores y aserciones de las pruebas que utilizaban el footer anterior del Sidebar: autenticación, integración y aceptación de perfiles, seguridad de persistencia, interacción global, densidad, calendario, navegación clínica y diseño global. `tests/helpers/app-navigation.ts` centraliza la navegación mediante el menú personal. `tests/navigation-shell.spec.ts` agrega los casos de esta fase. `scripts/capture-content-ui.mjs` utiliza el nuevo ancho expandido.

## Verificación

**84 casos distintos de Playwright aprobados**, tomando el último resultado de cada caso y sin sumar reejecuciones:

- 18 de navegación, menú personal, tema y alertas globales.
- 60 de regresión de autenticación, fotografías, persistencia, perfiles, sedes e interacciones existentes.
- Cuatro de navegación/densidad y de las tres vistas del calendario con Sidebar expandido y contraído.
- Dos de navegación clínica, secciones y odontograma con la nueva distribución.

Los casos cubren ambos temas y **320, 360, 375, 390, 430, 600, 768, 1024, 1280, 1440 y 1920 px**. Se verificaron ausencia de desbordamiento horizontal, un único selector de tema, grupos según rol, Drawer, enlaces, tooltips, apertura por teclado, Escape, clic exterior y devolución del foco.

Las verificaciones de alertas incluyen fuentes con registros activos e irrelevantes, filtros, contador, recarga, fallos de escritura, consultas fallidas, lectura dañada, reintento, separación entre cuentas y paginación completa. Un caso de lógica comprueba agregación de páginas, deduplicación y cancelación dentro del ejecutor de Playwright. El repositorio no tiene una suite unitaria independiente.

La regresión de fotografías comprueba carga, confirmación, cancelación, eliminación, errores, color almacenado, recarga y siguientes inicios de sesión. La sincronización que anteriormente se verificaba en el avatar lateral ahora se verifica en el Header y el menú personal, además de la pantalla de perfil. Los formularios y la navegación institucional conservan sus pruebas de persistencia y errores.

`npm.cmd run build` y `npm.cmd run lint` terminaron correctamente. Permanecen las cinco advertencias anteriores de lint en Button, Badge, Tabs y dos formularios de React Hook Form, y la advertencia de Vite por paquetes mayores de 500 kB.

Se guardaron hashes del estado local antes de editar. La comparación confirma que las APIs, modelos, store de autenticación, rutas, tokens y fuentes de los módulos clínicos, calendario, finanzas e institución conservan sus cambios previos. La única modificación de la carpeta de autenticación en esta fase es el tipo de ubicación del componente visual del avatar.

## Revisión visual e incidencias resueltas

Se compararon las capturas anteriores y posteriores y se generaron 26 vistas específicas del Header, menú personal, campana, navegación contraída y Drawer. La campana también se comprobó a 320 × 480 y 844 × 390 px, con cuerpo desplazable y controles accesibles.

La revisión detectó y corrigió dos problemas del nuevo contexto: los avisos de guardado podían cubrir los controles del Header, por lo que ahora aparecen debajo de este únicamente dentro de la aplicación; y una traslación heredada del Switch se sumaba a su desplazamiento local, por lo que se eliminó la traslación duplicada y se comprobó su geometría en ambos temas.

Las pruebas se adaptaron al comportamiento real de las primitivas: el nombre accesible del menú lo proporciona su disparador, los modales de fotografía impiden abrir el Header mientras están activos y el cierre de sesión debe terminar antes de iniciar otra cuenta. Se conserva la comprobación del retorno del foco antes de abrir otro menú.

Los artefactos locales, ignorados por Git, están en `front/test-results/navigation-redesign`: `review.html`, `verification.json`, `source-verification.json`, informes JSON, capturas, mediciones y registros de compilación/lint.

## Límites conservados

La campana es una vista de los datos disponibles, con recibos de lectura locales. No es un servicio de alertas remotas, no sincroniza lecturas entre dispositivos y no crea un historial central de alertas que ya no cumplan sus condiciones. El acceso histórico disponible sigue siendo el historial de envíos existente. Para grandes volúmenes, una agregación de alertas en servidor permitiría evitar recorrer listas completas; no se añadió ningún endpoint en esta fase.

No se instalaron dependencias ni se realizaron commits, pushes, resets o cambios de rama. El localhost habitual permanece en el puerto 5173.
