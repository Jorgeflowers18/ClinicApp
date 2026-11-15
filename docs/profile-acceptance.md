# Perfil: criterios CA-01 a CA-31

Implementación y verificación del 14 de noviembre de 2026. Esta fase amplía el rediseño visual anterior con operaciones reales de fotografía sobre la persistencia disponible del modo demostración.

**Resultado y alcance de la persistencia**

Se aprobaron 51 casos distintos de Playwright: 18 de aceptación, 28 de regresión de perfil/autenticación, tres de seguridad de persistencia y dos del calendario. El resumen usa el último resultado de cada caso, sin sumar reejecuciones como casos nuevos. No quedan fallos pendientes en estas verificaciones del frontend.

El repositorio todavía no implementa el servidor de perfiles o fotografías. [back/backlog.md](../back/backlog.md:45) enumera `PUT /auth/me/profile` y la gestión de avatar como trabajo pendiente; [el desglose del backend](../back/backlog-desgloce.md:71) mantiene ese servicio como propuesta. No se inventó un endpoint ni se simula una respuesta exitosa del servidor.

En demostración se guarda un registro persistente del perfil por identificador de usuario en localStorage, separado de la sesión. Es una escritura real del navegador, con errores comprobados. La interfaz informa que los cambios confirmados se guardan en este navegador. En conexión con servidor, las operaciones de perfil informan que el guardado no está disponible y conservan los datos anteriores; su integración continúa pendiente.

**CA-11: confirmar antes de publicar**

Seleccionar un archivo solo crea una vista previa. La imagen se valida con el decodificador del navegador y se mantiene separada del perfil guardado. Confirmar escribe primero el registro persistente; únicamente después se actualizan el store, los avatares y la confirmación de éxito. Un error de lectura o almacenamiento conserva la foto anterior y mantiene visible el error.

La carga independiente de una fotografía conserva el color almacenado y no guarda borradores de nombre, cargo o biografía. Durante la configuración inicial tampoco marca el perfil como completo: Continuar sigue siendo necesario para guardar los campos y conservar el flujo de acceso.

**CA-18: eliminar de la persistencia**

El menú muestra Eliminar fotografía solo cuando existe una imagen. La acción requiere confirmación. Confirmar guarda `avatarImage: null` en el registro persistente, conservando todos los demás campos y el color. Después se actualiza el estado global y reaparecen las iniciales o el icono genérico.

No se trata de ocultar la imagen mediante estado local. Las pruebas leen el registro almacenado, recargan, cierran sesión y vuelven a ingresar. También fuerzan una excepción de almacenamiento: en ese caso el registro y los avatares mantienen la imagen anterior, el diálogo muestra el error y no anuncia una eliminación exitosa.

Un guardado posterior de información personal toma la fotografía y el color del último perfil confirmado. Así un borrador antiguo no puede restaurar una fotografía sustituida o eliminada.

**CA-27: una identidad sincronizada**

Perfil, Header y Sidebar utilizan UserAvatar y las actualizaciones confirmadas del mismo store. El Sidebar conserva sus enlaces, orden, permisos y distribución; únicamente el icono de Mi perfil pasa a mostrar la identidad actual. Se protege el nombre accesible del enlace para que siga siendo Mi perfil.

Se verificó el cambio inmediato de foto e iniciales en el Sidebar expandido, contraído y móvil, además del encabezado y la pantalla de perfil. El nombre visible del Header y el saludo del Panel usan el nombre de perfil confirmado. No se reescriben autores ni registros clínicos existentes.

**Matriz de aceptación**

«Aprobado» se refiere al frontend comprobado en Chrome. «Pendiente servidor» significa que no existe el servicio necesario y no se declara una operación de producción verificada.

| Criterio | Resultado real | Evidencia |
| --- | --- | --- |
| CA-01 Sin fotografía | Aprobado | Iniciales visibles cuando hay nombre. |
| CA-02 Con fotografía | Aprobado | Imagen guardada en perfil, Header y Sidebar. |
| CA-03 Nombres incompletos | Aprobado | FP, AM, MG, FE, AN, PA; A conserva una letra; vacío muestra icono genérico. Espacios y Unicode comprobados. |
| CA-04 Apertura del menú | Aprobado | Avatar, cámara y teclado abren el mismo menú. |
| CA-05 Menú sin fotografía | Aprobado | Únicamente Subir fotografía. |
| CA-06 Menú con fotografía | Aprobado | Cambiar fotografía y Eliminar fotografía. |
| CA-07 Cierre del menú | Aprobado | Acción, clic fuera y Escape; foco y teclado comprobados. |
| CA-08 Selector de archivo | Aprobado | Solicitud nativa de archivos comprobada con FileChooser de Chrome. |
| CA-09 Vista previa | Aprobado | Candidato visible en diálogo; perfil persistido sin cambios hasta confirmar. |
| CA-10 Cancelación | Aprobado | Cancelar archivo o vista previa no modifica los datos guardados. |
| CA-11 Carga confirmada | Aprobado demo / Pendiente servidor | Escritura persistente antes de actualizar; color conservado y avatares sincronizados. |
| CA-12 Error de carga | Aprobado demo / Pendiente errores de API | Imagen inválida y fallo de almacenamiento mantienen la foto; no aparece éxito. |
| CA-13 Reemplazo | Aprobado demo / Pendiente servidor | Nueva imagen confirmada reemplaza a la anterior y sobrevive a otro ingreso. |
| CA-14 Conservar foto anterior | Aprobado frontend | La vista previa no altera la imagen del perfil ni de la navegación. |
| CA-15 Cancelar reemplazo | Aprobado | Registro e imagen anterior idénticos tras cancelar. |
| CA-16 Confirmación de eliminación | Aprobado | Diálogo explica el retorno a iniciales o icono genérico. |
| CA-17 Cancelar eliminación | Aprobado | Registro, foto y color intactos. |
| CA-18 Eliminación confirmada | Aprobado demo / Pendiente servidor | Imagen borrada del registro; ausencia recuperada tras recarga y nuevo ingreso. |
| CA-19 Error de eliminación | Aprobado demo / Pendiente errores de API | Fallo de escritura conserva la imagen y muestra error sin éxito falso. |
| CA-20 Nombre | Aprobado demo / Pendiente servidor | Guardado actualiza nombre e iniciales; con fotografía la conserva. |
| CA-21 Cargo | Aprobado frontend | Texto libre, sin catálogo. |
| CA-22 Especialidad | Aprobado frontend | Texto libre, sin catálogo. |
| CA-23 Biografía | Aprobado frontend | Multilínea y más de 250 caracteres; sin límite nuevo. Se mantiene el recorte exterior original al guardar. |
| CA-24 Guardar cambios | Aprobado demo / Pendiente servidor | Confirmación y navegación tras persistir; error mantiene perfil anterior y borrador. |
| CA-25 Cancelar cambios | Aprobado | Recupera los últimos campos guardados; no deshace operaciones de fotografía ya confirmadas. |
| CA-26 Color | Aprobado demo / Pendiente contrato de servidor | Color personalizado conservado durante carga, cambio, eliminación y guardado; modelo intacto. |
| CA-27 Sincronización global | Aprobado frontend/demo / Pendiente integración con servidor | Misma foto/iniciales en perfil, Header y Sidebar, también móvil y contraído. |
| CA-28 Nombre visible | Aprobado frontend/demo / Pendiente integración con servidor | Header, iniciales y saludo del Panel actualizados al guardar. |
| CA-29 Persistencia entre ingresos | Aprobado demo / Pendiente servidor | Registro por usuario; comprobados nuevo ingreso, aislamiento entre cuentas y perfiles antiguos. |
| CA-30 Temas | Aprobado frontend | Temas originales, violeta y Acid Lime; borradores y fotografía conservados. |
| CA-31 Responsive | Aprobado en Chrome | Once anchos, ambos temas; formulario, menú, vista previa, confirmación y Sidebar móvil. |

**Pruebas de protección adicionales**

- Si falla la caché de sesión después de guardar el perfil, el registro confirmado sigue siendo válido y la nueva fotografía se recupera al volver a ingresar. La sesión no es la fuente de verdad del perfil.
- Los perfiles antiguos que solo estaban en la sesión se conservan antes de cerrarla. Si esa conservación falla, se informa del error y no se descarta la sesión con la única copia de la foto.
- Un registro persistido ilegible no se reemplaza silenciosamente por un perfil vacío.
- Las cuentas mantienen registros separados. La foto de un administrador no aparece al ingresar como médico.
- En modo servidor sin servicio de perfil, carga y eliminación muestran indisponibilidad sin actualizar los avatares ni emitir solicitudes inventadas de guardado.

**Implementación y archivos**

- [profile-persistence.ts](../front/src/modules/auth/api/profile-persistence.ts): registro por usuario para el modo demostración y guardado no disponible en modo servidor.
- [auth-store.ts](../front/src/modules/auth/store/auth-store.ts): restauración, actualización posterior a la persistencia y conservación de perfiles anteriores. No guarda tokens en el registro del perfil.
- [auth.queries.ts](../front/src/modules/auth/api/auth.queries.ts): informa si no se pudo conservar un perfil anterior al cerrar sesión.
- [use-profile-editor.ts](../front/src/modules/auth/components/use-profile-editor.ts): separa campos en borrador de fotografía/color confirmados; serializa operaciones y permite cancelar cambios.
- [profile-photo-controls.tsx](../front/src/modules/auth/components/profile-photo-controls.tsx) y [su CSS Module](../front/src/modules/auth/components/profile-photo-controls.module.css): menú, lectura, vista previa, confirmación, eliminación, errores y retorno del foco.
- [user-avatar.tsx](../front/src/modules/auth/components/user-avatar.tsx), [sus estilos](../front/src/modules/auth/components/user-avatar.module.css), [user-identity.ts](../front/src/modules/auth/components/user-identity.ts) y [profile-initials.ts](../front/src/modules/auth/components/profile-initials.ts): presentación compartida de la identidad, sin duplicar letras ni inventar nombres.
- [user-profile-page.tsx](../front/src/modules/auth/pages/user-profile-page.tsx) y [sus estilos](../front/src/modules/auth/pages/user-profile-page.module.css): conecta los flujos reales con la distribución anterior, informa del modo de persistencia y distingue borradores.
- [app-layout.tsx](../front/src/app/layout/app-layout.tsx) y [dashboard-page.tsx](../front/src/app/pages/dashboard-page.tsx): identidad confirmada en Header, Sidebar y saludo; navegación y permisos conservados.
- [profile-acceptance.spec.ts](../front/tests/profile-acceptance.spec.ts), [profile-persistence-safety.spec.ts](../front/tests/profile-persistence-safety.spec.ts) y adaptación de las dos suites anteriores del perfil.

Se compararon 249 archivos iniciales: nueve archivos existentes del alcance modificados, nueve nuevos de código/pruebas y ninguno eliminado. Modelos, tokens, primitivas compartidas, logo, reglas de acceso, rutas, configuración de navegación, dependencias y calendario permanecen iguales. Se conservaron los cambios locales anteriores.

**Resultados y capturas**

Build y lint aprobados. Se mantienen cinco advertencias de lint anteriores y el aviso de tamaño de bundles. git diff --check no encontró errores. Las 51 pruebas distintas tienen resultado final aprobado; los intentos previos se conservan en los artefactos, con sus correcciones y reejecuciones.

La matriz responsive incluye 320, 360, 375, 390, 430, 600, 768, 1024, 1280, 1440 y 1920 px en claro y oscuro. La captura del selector de archivos nativo del sistema operativo no forma parte del DOM; se verificó su apertura y selección mediante la API de FileChooser. No se afirma verificación en dispositivos físicos, Safari/Firefox ni una auditoría exhaustiva de lectores de pantalla.

- [Revisión interactiva de estados](../front/test-results/profile-acceptance/review.html).
- [Perfil con fotografía y navegación sincronizada](../front/test-results/profile-acceptance/captures/saved-dark-1440.png).
- [Vista previa móvil](../front/test-results/profile-acceptance/captures/preview-light-390.png).
- [Confirmación de eliminación en tablet](../front/test-results/profile-acceptance/captures/delete-confirm-dark-768.png).
- [Sidebar móvil después de eliminar](../front/test-results/profile-acceptance/captures/mobile-sidebar-dark.png).
- [Estado persistido tras eliminar](../front/test-results/profile-acceptance/captures/confirmed-state.json), [resumen de pruebas](../front/test-results/profile-acceptance/test-summary.json) y [verificación del alcance](../front/test-results/profile-acceptance/scope-verification.json).

Las imágenes se obtuvieron en contextos de prueba aislados y no sustituyeron fotografías de usuarios. Los artefactos de test-results permanecen locales, excluidos de Git. No se creó un commit ni se publicó al repositorio. El frontend de revisión continúa en http://localhost:5173/perfil-usuario.
