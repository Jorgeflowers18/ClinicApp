# Perfil institucional: auditoría, rediseño y verificación

Fecha: 14 de noviembre de 2026. Alcance: presentación del perfil institucional y gestión de sedes en el frontend existente.

## Diagnóstico inicial

La ruta `/perfil-institucion` utiliza `InstitutionProfilePage`, protegida por los permisos existentes. La página contenía información general, contacto, horarios, identidad visual y sedes. Las sedes ocupaban la columna lateral: cada registro mostraba permanentemente cuatro campos editables. Diez sedes producían cuarenta inputs, dificultaban consultar datos y alargaban la página.

El estado era local al componente. `readInstitutionProfile` y `writeInstitutionProfile`, en `institution.types.ts`, leen y escriben `clinicapp.institution-profile` en localStorage. El repositorio no tiene un servicio institucional implementado al que conectar estas operaciones. Los campos no tenían validaciones obligatorias adicionales, paginación ni selector de sede principal. La primera sede creada se marca como principal; eliminarla está permitido y no promueve otra. La eliminación anterior era inmediata, sin confirmación. Guardar no capturaba los errores de escritura.

Se revisaron la ruta y permisos, los tipos, lectura y escritura, carga de imágenes, componentes de formulario, Sheet, AlertDialog, DropdownMenu, Table, tokens, temas y pruebas de integración antes de implementar.

## Resultado implementado

- Información general, contacto y horarios a la izquierda; identidad visual independiente a la derecha cuando hay espacio. En pantallas pequeñas se utiliza una columna, sin igualar artificialmente las alturas.
- Se mantienen todos los campos y sus valores, incluidos los horarios de texto libre y los identificadores del formulario general.
- Sedes ocupa todo el ancho debajo de la información institucional. En escritorio se consulta una tabla con nombre, dirección, teléfono, horarios, tipo y acciones. En espacios menores aparecen fichas de consulta, sin formularios desplegados.
- La sede principal usa una etiqueta neutra. Los datos completos se ajustan a varias líneas cuando es necesario; no se recortan con puntos suspensivos.
- Un único Sheet derecho permite crear y editar. En móviles ocupa toda la pantalla. El cuerpo se desplaza y el pie con Cancelar y Guardar sede permanece accesible, incluso a 320 × 480 px.
- Crear primera sede y Crear sede abren el mismo editor. Editar precarga los cuatro campos; cancelar o pulsar Escape descarta el borrador.
- Eliminar sede requiere confirmación. Si falla la escritura, la confirmación sigue abierta y el registro se conserva.
- Los errores de guardado general y de sedes son visibles. Los mensajes de éxito se emiten después de que el escritor existente termine correctamente.
- Se reutilizan tokens y componentes compartidos. Las acciones principales conservan violeta en claro y Acid Lime en oscuro. Los iconos informativos y las superficies son neutros; la eliminación conserva su color semántico.

## Guardado y reglas conservadas

Guardar cambios persiste los campos institucionales y el logo mediante el escritor original. Guardar sede y confirmar una eliminación persisten la operación sobre sedes con ese mismo escritor, sin guardar accidentalmente otros campos pendientes del perfil. La interfaz y el registro confirmado solo cambian después de una escritura exitosa. Un guardado general posterior conserva la lista de sedes ya confirmada.

Se conservan los tipos, la clave de almacenamiento, el formato de los datos, los identificadores de las sedes editadas, sus indicadores `isMain` y las reglas anteriores de principal. No se agregaron restricciones para eliminar una sede principal, promociones automáticas, selección de principal, validaciones nuevas, paginación, dependencias ni endpoints. La generación de identificadores evita colisiones con otro identificador existente del mismo milisegundo.

La carga del logo conserva FileReader, su almacenamiento como data URL y el componente institucional compartido. La vista previa muestra la imagen completa mediante `object-fit: contain`. El texto del logo y las imágenes personalizadas conservan el comportamiento de marca existente.

## Archivos de esta fase

| Archivo | Cambio |
| --- | --- |
| `front/src/modules/institution/pages/institution-profile-page.tsx` | Composición, borrador general, guardado y coordinación de persistencia de sedes. |
| `front/src/modules/institution/pages/institution-profile-page.module.css` | Distribución, campos, identidad visual y estilos responsive locales. |
| `front/src/modules/institution/components/institution-branches.tsx` | Consulta de sedes, menú de acciones, editor único y confirmación. |
| `front/src/modules/institution/components/institution-branches.module.css` | Tabla local, fichas, panel móvil, pie accesible y errores. |
| `front/tests/institution-profile.spec.ts` | Diez casos nuevos de aceptación y responsive en Chrome. |
| `front/tests/profile-integration.spec.ts` | Adaptación de los dos casos institucionales al nuevo panel y listado. |
| `docs/institution-profile-redesign.md` | Este informe. |

No se editaron componentes compartidos, tokens globales, modelos institucionales ni otros módulos durante esta fase. Se conservaron los cambios locales anteriores de calendario y perfil de usuario. No se realizaron commits, pushes, resets ni cambios de rama.

## Pruebas ejecutadas

- `npm.cmd run build`: correcto, sin errores de TypeScript. Vite conserva la advertencia de paquetes mayores de 500 kB.
- `npm.cmd run lint`: correcto, sin errores. Permanecen cinco advertencias previas en Button, Badge, Tabs y dos formularios que usan React Hook Form.
- Playwright en Chrome: **19 casos aprobados, 0 fallidos, 0 omitidos y 0 inestables**. Son diez casos institucionales nuevos y nueve de integración de perfil/permisos. La ejecución final duró unos 94 segundos.
- Pruebas de creación, edición, cancelación, eliminación, reintento después de errores, identidad de registros, recarga, logo y guardado general.
- Se simuló `QuotaExceededError` únicamente en el navegador de prueba para comprobar los fallos reales del escritor, sin reemplazarlo por respuestas exitosas ficticias.
- Ambos temas a **320, 360, 375, 390, 430, 600, 768, 1024, 1280, 1440 y 1920 px**: sin desbordamiento horizontal global, diez sedes consultables, un solo editor, foco contenido, Escape, retorno al disparador y pie visible. También se comprobó 320 × 480 px.
- Carga y conservación del logo después de guardar, recargar y alternar tema. Los casos existentes también comprueban su presencia en login y solicitud de acceso después de cerrar sesión.
- Permisos existentes comprobados para administración, odontología y recepción.
- El proyecto no define una suite unitaria independiente; la validación funcional usa sus pruebas de integración/E2E existentes y los nuevos casos.

Comando reproducible con un servidor local iniciado:

```powershell
$env:CLINIC_TEST_URL='http://127.0.0.1:5176'
node node_modules/@playwright/test/cli.js test tests/institution-profile.spec.ts tests/profile-integration.spec.ts --workers=2 --reporter=line --output=test-results/institution-e2e
```

### Matriz de aceptación

| Criterio | Evidencia aprobada |
| --- | --- |
| CA-01 | Datos institucionales existentes visibles y valores comprobados. |
| CA-02 | Nombre, razón social, RUC, sitio web y descripción modificados y persistidos. |
| CA-03 | Teléfono, correo y dirección modificados y persistidos. |
| CA-04 | Horarios libres y multilínea conservados en el formulario general y almacenamiento. |
| CA-05 | Carga del logo y conservación de su fuente entre recargas y temas. |
| CA-06 | Guardado general comprobado directamente en localStorage. |
| CA-07 | Crear abre Sheet, sin insertar un formulario en la lista. |
| CA-08 | Cancelar creación conserva la lista vacía. |
| CA-09 | Guardar registra los cuatro campos de la nueva sede. |
| CA-10 | La nueva sede aparece sin recarga de página. |
| CA-11 | El editor compartido precarga los datos de la sede seleccionada. |
| CA-12 | Cancelar conserva el registro original. |
| CA-13 | Editar conserva el identificador y actualiza el registro correcto sin duplicarlo. |
| CA-14 | Confirmación y cancelación de eliminación comprobadas; se agregó la confirmación que faltaba. |
| CA-15 | Principal identificado a partir del `isMain` almacenado. |
| CA-16 | Primera sede principal; eliminarla sigue permitido y no promueve otra. |
| CA-17 | Estado vacío inicial y después de eliminar la última sede. |
| CA-18 | Diez sedes sin inputs en el listado ni editores simultáneos. |
| CA-19 | Fallos de guardado general, creación, edición y eliminación visibles, sin perder datos. |
| CA-20 | Perfil y sedes recuperados después de recargar. |
| CA-21 | Operaciones verificadas en claro y oscuro. |
| CA-22 | Once anchos en ambos temas y pantalla móvil de altura reducida. |
| CA-23 | Integración, permisos y comparación visual de pantallas ajenas al módulo. |

## Comparación visual

Se generaron 36 capturas institucionales de consulta, estado vacío, creación y confirmación a 1440, 768 y 390 px en ambos temas. La comparación usa el componente anterior, leído de HEAD porque estaba sin modificaciones al iniciar esta fase, y el frontend actual. La referencia anterior se sirvió en un Vite aislado con sus clases Tailwind explícitas; no se reemplazó el código de trabajo. Las primeras capturas tuvieron que regenerarse porque la salida predeterminada de Playwright había limpiado la carpeta de artefactos; las ejecuciones finales utilizan una carpeta de salida separada.

Con el mismo conjunto de diez sedes, la sección de escritorio pasó de **3672 a 609 px** de alto, aproximadamente un **83 % menos**, y de **40 a 0 inputs permanentes**. A 768 px ocupa aproximadamente 1226 px; a 390 px, 2424 px, con todos los datos disponibles al desplazarse.

También se compararon 18 pares de capturas de login, panel, historia clínica, tratamientos, citas, finanzas, inventario y notificaciones: 17 pares idénticos píxel a píxel y un par de historia clínica oscura con una diferencia de un píxel. Las doce capturas estructuradas de estilos y geometría de login, header y sidebar son idénticas. Esto complementa las pruebas funcionales; no sustituye una ejecución de toda la suite del repositorio.

Los artefactos locales, ignorados por Git, están en `front/test-results/institution-redesign`: `review.html`, carpetas `before/after`, `verification.json`, `e2e.json`, mediciones y registros de build/lint.

## Incidencias resueltas y límites

Las primeras pruebas detectaron que los fieldsets podían comprimirse en un móvil bajo y dejar parte del último campo detrás del pie. Se impidió esa compresión y se comprobó el desplazamiento interno. La comprobación de color también se ajustó para retirar el cursor del botón: estaba midiendo correctamente el color de hover del sistema, en lugar del color primario en reposo.

La persistencia institucional sigue siendo **local al navegador**, como en la implementación anterior. No hay sincronización con servidor, transacciones remotas, validaciones de asociaciones clínicas ni mecanismo de elección de principal en este módulo. Estas capacidades requieren una fase funcional independiente. No se ejecutó toda la suite del repositorio ni se atribuye a esta fase una validación integral del backend.
