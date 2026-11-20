# Perfil institucional: distribución, identidad y sedes

Fecha: 19 de noviembre de 2026. Ruta: /perfil-institucion.

## Resultado

El perfil institucional mantiene sus campos y su persistencia local, con una composición más compacta y una identidad que se refleja en el Sidebar después de guardar.

- Escritorio: información general, contacto y horarios a la izquierda; identidad visual y resumen a la derecha. La segunda columna aparece cuando el contenido dispone de al menos 860 px.
- Tablet y móvil: una columna en orden de lectura, sin desbordamiento horizontal global.
- Cards con padding de 16 px, títulos y separadores discretos, horarios multilínea y altura determinada por el contenido.
- Guardar cambios aparece en una fila natural al final, sin contenedor decorativo ni barra fija.
- Se conservan los temas existentes y los colores primarios violeta y Acid Lime.

## Auditoría previa

La página ya utilizaba Card, Input, Textarea, componentes de marca y un registro local institucional. Las sedes ya tenían consulta compacta y operaciones separadas del borrador general. Los problemas pendientes eran la marca fija del Sidebar, la escasa información en la columna derecha, el editor de sedes lateral de altura completa y la lectura del logo sin comprobar que fuera una imagen válida.

Se reutilizaron los componentes UI y los tokens existentes. No se cambió el sistema de temas, las rutas, los permisos, los modelos ni la arquitectura de datos.

## Identidad institucional

El registro local existente continúa siendo la fuente de verdad. El escritor publica un evento local únicamente después de que localStorage.setItem termina correctamente. Un hook con useSyncExternalStore escucha ese evento y los eventos nativos de almacenamiento de otras pestañas.

El Sidebar de escritorio, su estado contraído y el menú móvil muestran el logo institucional y el nombre confirmado. Si no hay imagen, se muestran exactamente dos iniciales mediante la función institucional compartida: primera y segunda palabra; si solo hay una palabra, sus dos primeras letras. Un nombre de una sola letra repite esa letra y la marca ClinicApp conserva CA. El subtítulo institucional es un texto libre opcional del registro local; las configuraciones anteriores sin ese campo se leen con subtítulo vacío. La vista previa comparte la misma presentación que el Sidebar y cambia con el borrador, mientras el menú refleja exclusivamente los datos confirmados. El tooltip permite consultar el nombre y subtítulo completos, incluso con el menú contraído.

Los cambios del formulario se muestran como vista previa y no alteran el Sidebar antes de guardar. Un fallo de almacenamiento conserva el registro confirmado, la marca y el borrador pendiente. La identidad vuelve a leerse al recargar. El avatar y el nombre del usuario en el Header continúan siendo personales.

El antiguo campo Texto del logo ya no aparece en la interfaz. La propiedad logoText se conserva únicamente para compatibilidad con registros almacenados. AuthLayout utiliza ahora el nombre institucional y la misma función de iniciales que el Sidebar y la vista previa.

## Logo

- Subir, reemplazar y quitar imagen desde el mismo bloque compacto.
- Vista previa real, conservando el aspecto de la imagen mediante object-fit: contain.
- Validación de tipo y decodificación de la imagen antes de aceptar el nuevo borrador.
- Los archivos inválidos, corruptos o ilegibles conservan el logo anterior.
- Las lecturas obsoletas no reemplazan una selección más reciente; se cancelan al desmontar el control.
- Guardar permanece deshabilitado mientras termina la lectura.
- El feedback diferencia una imagen pendiente de aplicar de un logo ya guardado.
- Quitar una imagen muestra las iniciales en la vista previa; la eliminación se aplica al Sidebar tras guardar correctamente.
- Si una imagen guardada no se puede mostrar, el componente de marca presenta las iniciales.

No se agregaron dependencias ni un almacenamiento alternativo de fotografías.

## Sedes y guardado

Sedes mantiene la tabla de consulta en escritorio y las fichas de lectura en espacios menores. Se conservan nombre, dirección, teléfono, horarios, tipo y menú de acciones.

El estado vacío incluye el mensaje Aún no hay sedes registradas y Crear primera sede. Crear sede sigue disponible en la cabecera. Ambas acciones abren el mismo modal centrado de hasta 600 px; Editar sede precarga ese modal. El cuerpo tiene scroll interno cuando es necesario y las acciones Cancelar y Guardar sede siguen accesibles, incluso a 320 × 480 px. Horarios admite varias líneas.

Se conserva la confirmación de eliminación, el foco inicial, el foco contenido, Escape y el retorno al disparador. Los fallos de escritura mantienen abiertos el editor o la confirmación y conservan sus datos para reintentar.

Las operaciones de sedes guardan únicamente los datos institucionales previamente confirmados y la nueva lista de sedes: no guardan accidentalmente otros cambios pendientes. Un guardado general posterior conserva esa lista. Las funciones de creación, edición, eliminación y coordinación de persistencia mantienen las reglas previas, incluida la ausencia de promoción automática de otra sede al eliminar la principal.

El nombre institucional es obligatorio y tiene error asociado al campo. El correo sigue siendo opcional y se comprueba su formato al introducirlo. No se añadieron restricciones al RUC histórico, ni nuevas reglas de sede principal, campos o contratos.

## Archivos modificados y nuevos

| Archivo | Finalidad |
| --- | --- |
| front/src/modules/institution/pages/institution-profile-page.tsx | Composición, resumen, validación y acciones compactas. |
| front/src/modules/institution/pages/institution-profile-page.module.css | Distribución y estilos locales de la página. |
| front/src/modules/institution/components/institution-branches.tsx | Modal centrado reutilizado al crear y editar; horarios multilínea. |
| front/src/modules/institution/components/institution-branches.module.css | Estado vacío compacto, modal y scroll interno. |
| front/src/modules/institution/components/institution-brand.tsx | Imagen e iniciales compartidas entre vista previa y Sidebar. |
| front/src/modules/institution/components/institution-brand.module.css | Identidad compacta, imagen completa y nombre de hasta dos líneas. |
| front/src/modules/institution/components/institution-logo-controls.tsx | Carga, reemplazo, eliminación, validación y feedback del logo. |
| front/src/modules/institution/components/institution-logo-controls.module.css | Presentación local del control de imagen. |
| front/src/modules/institution/hooks/use-institution-profile.ts | Suscripción reactiva al registro local existente. |
| front/src/modules/institution/lib/institution-initials.ts | Derivación de exactamente dos iniciales. |
| front/src/modules/institution/types/institution.types.ts | Publicación de escrituras confirmadas; tipos y datos iniciales intactos. |
| front/src/app/layout/app-layout.tsx | Sustitución exclusiva del bloque de marca fija por la marca institucional. |
| front/tests/institution-branding.spec.ts | Doce pruebas nuevas de identidad, fallos, concurrencia de imágenes y responsive. |
| front/tests/institution-profile.spec.ts | Adaptación de medidas y selectores al modal centrado. |
| front/tests/profile-integration.spec.ts | Adaptación a las iniciales derivadas y diferenciación entre imagen del Sidebar y del formulario. |
| front/tests/navigation-iconography.spec.ts | Espera por la accesibilidad real del botón durante la animación del aviso inicial existente. |
| docs/institution-profile-redesign.md | Este informe. |

## Verificación

- npm.cmd run build: correcto, sin errores TypeScript; se mantiene el aviso previo de paquetes mayores de 500 kB.
- npm.cmd run lint: sin errores; tres advertencias previas de Fast Refresh en Button, Badge y Tabs.
- Chrome / Playwright: 51 casos distintos aprobados. Ejecución final principal: 42 aprobados. Regresión adicional: 9 aprobados.
- Los 31 casos institucionales y de integración de perfil comprueban campos, logos, sedes, cancelación, eliminación, errores, reintentos, recarga, permisos y preservación de la identidad personal.
- Otros 11 casos comprueban el switch y la navegación; 9 adicionales cubren grupos, permisos, protección del borrador de Mensajería y las dos regresiones clínicas seleccionadas.
- Ambos temas a 320, 360, 375, 390, 430, 600, 768, 1024, 1280, 1440 y 1920 px; además, el editor a 320 × 480 px.
- Fallos de almacenamiento, archivos inválidos, decodificación fallida, lecturas simultáneas y cambios desde otra pestaña comprobados en el navegador.
- 12 capturas anteriores y 24 posteriores; revisadas las composiciones de escritorio, tablet, móvil, identidad y modal en ambos temas.
- Revisión en localhost:5173: correcta en ambos temas, sin errores JavaScript.

Evidencia local bajo front/test-results/institution-redesign: scope-audit.json, visual-checks.json, validation-summary.json, build.txt, lint.txt y carpetas before/after. Las salidas de Playwright están en front/test-results/playwright-institution-verified y front/test-results/playwright-institution-shell-clinical.

La auditoría por hashes comparó 344 archivos previos y no detectó cambios fuera del alcance. Los 73 archivos relacionados con historia clínica, odontograma, periodontograma y vendor permanecen intactos. Se verificó además que AppLayout solo cambia su importación y bloque de marca, y que los tipos, los datos iniciales y las reglas de sedes mantienen su contenido.

El servidor habitual en http://localhost:5173 permanece activo. No se realizaron commits, pushes ni cambios de rama; se conservaron los cambios locales de los módulos anteriores.

### Reproducir las pruebas

Con el servidor local iniciado, desde front:

    $env:CLINIC_TEST_URL='http://localhost:5173'
    npx.cmd playwright test tests/institution-branding.spec.ts tests/institution-profile.spec.ts tests/profile-integration.spec.ts tests/header-theme-switch.spec.ts tests/navigation-iconography.spec.ts --workers=2 --reporter=line --output=test-results/playwright-institution-verified
    npx.cmd playwright test tests/navigation-shell.spec.ts tests/messaging-redesign.spec.ts tests/dental-history.spec.ts --grep 'navigation groups|retains navigation|draft confirmation covers|historia editable|visitas guardadas' --workers=2 --reporter=line --output=test-results/playwright-institution-shell-clinical
