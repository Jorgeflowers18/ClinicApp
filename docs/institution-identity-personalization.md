# Personalización de la identidad institucional

Fecha: 19 de noviembre de 2026. Ruta: `/perfil-institucion`.

## Resultado y auditoría

El registro institucional ya guardaba el nombre comercial y el logo en `clinicapp.institution-profile`. El Sidebar se suscribía a ese registro mediante `useInstitutionProfile`, pero añadía el subtítulo fijo «Odontología». No existía un campo con la función de subtítulo. El antiguo `logoText` se conserva para compatibilidad, sin edición manual; las pantallas de acceso, la vista previa y el Sidebar generan ahora las iniciales desde el nombre con la misma función.

Se incorpora `subtitle`, un texto libre opcional, sin selector ni valor institucional obligatorio. El lector normaliza las configuraciones anteriores sin subtítulo a una cadena vacía, sin reescribirlas automáticamente. Se conservan los demás datos guardados, incluidas las imágenes y las sedes.

Información general distribuye nombre y subtítulo en la primera fila, razón social y RUC en la segunda, sitio web en la tercera y descripción en la cuarta. Los pares pasan a una columna cuando falta espacio. La etiqueta del nombre es «Nombre de la clínica o institución» y la ayuda del subtítulo está disponible mediante un icono junto a su etiqueta, con tooltip al pasar el cursor, enfocar con teclado o pulsar.

## Presentación y guardado

- `InstitutionIdentity` comparte la presentación del nombre, subtítulo y logo entre el menú y la vista previa, sin tarjetas adicionales.
- La vista previa cambia con el borrador. El Sidebar obtiene únicamente la configuración confirmada mediante el hook existente; una escritura fallida no publica el evento de actualización.
- Si el subtítulo está vacío o solo contiene espacios, no se muestra una segunda línea y el nombre permanece centrado verticalmente respecto al logo.
- Los nombres extensos ocupan hasta dos líneas y el subtítulo una línea con elipsis. La marca expandida conserva el texto completo en su nombre accesible y en `title`. El menú contraído muestra solo el logo y un tooltip con la identidad completa, accesible también mediante el nombre del elemento enfocado.
- El tooltip contraído no captura el puntero. En el menú expandido y móvil se evita abrir un popup al recibir el foco inicial del diálogo, de modo que Escape sigue cerrando la navegación con una sola pulsación.
- Se reutilizan `InstitutionMark` e `institutionInitials`, manteniendo la función existente de dos iniciales, los tokens de los botones primarios y el tratamiento `object-fit: contain` de las imágenes. Los logos personalizados conservan sus colores.
- Subir, reemplazar y quitar logo conserva la validación, decodificación y protección contra lecturas obsoletas existentes.
- Cancelar descarta los campos y la imagen pendientes, restaura el registro confirmado más reciente y limpia los errores de edición. No escribe en almacenamiento. También respeta un cambio confirmado desde otra pestaña.
- Guardar mantiene la protección contra envíos duplicados, el estado de procesamiento, los errores y la confirmación. La escritura existente es síncrona: no se introducen retardos artificiales.

Se reutilizan `Card`, `Input`, `Textarea`, `Button`, `Tooltip`, el mecanismo de persistencia y el hook institucional. La posterior simplificación unifica únicamente la identidad institucional de las pantallas de acceso con las iniciales automáticas. Se conservan autenticación, Header, permisos, gestión de sedes, identidad personal, exportaciones, dependencias, odontograma y periodontograma. El informe `institution-profile-simplification.md` detalla ese ajuste.

## Archivos modificados

| Archivo | Cambio |
| --- | --- |
| `front/src/modules/institution/types/institution.types.ts` | Campo `subtitle` y compatibilidad con registros anteriores. |
| `front/src/modules/institution/components/institution-brand.tsx` | Identidad compartida y nombre/subtítulo guardados en la marca. |
| `front/src/modules/institution/components/institution-brand.module.css` | Logo de 40 px, textos adaptables, foco y tooltip. |
| `front/src/modules/institution/components/institution-logo-controls.tsx` | Vista previa del borrador con la identidad compartida. |
| `front/src/modules/institution/components/institution-logo-controls.module.css` | Vista previa compacta. |
| `front/src/modules/institution/pages/institution-profile-page.tsx` | Campo libre, distribución, ayuda, cancelación y estado de guardado. |
| `front/src/modules/institution/pages/institution-profile-page.module.css` | Acciones adaptables sin barra decorativa. |
| `front/tests/institution-identity.spec.ts` | Diez casos nuevos en Chrome para identidad y subtítulo. |
| `front/tests/institution-branding.spec.ts` | Localizadores de la nueva etiqueta del nombre. |
| `front/tests/institution-profile.spec.ts` | Registro de prueba con subtítulo opcional vacío. |
| `front/tests/profile-integration.spec.ts` | Localizadores de la nueva etiqueta del nombre. |
| `docs/institution-profile-redesign.md` | Sustitución de la documentación del subtítulo fijo. |
| `docs/institution-identity-personalization.md` | Este informe. |

## Validación

- `npm.cmd run build`: aprobado, incluyendo `tsc -b` y compilación de producción.
- `npm.cmd run lint`: sin errores; permanecen tres advertencias previas de Fast Refresh en Button, Badge y Tabs.
- 47 casos distintos de Playwright verificados: identidad (10), marca institucional (12), perfil institucional y sedes (10), integración de perfiles y permisos (9) e iconografía/navegación (6).
- La regresión principal terminó con 43 casos aprobados y cuatro pendientes en tooltip/teclado/navegación. Después de corregir el componente y simular navegación real con Tab/Shift+Tab, esos cuatro casos pasaron en una ejecución específica, 4/4. No se presenta ese resultado como una ejecución única de 47/47 ni como la totalidad de la suite histórica del repositorio.
- Se comprobaron cambios independientes y simultáneos de nombre/subtítulo; registro antiguo; subtítulo vacío; alineación sin segunda línea; imagen inicial, reemplazo, eliminación, archivos fallidos y lecturas concurrentes; error de escritura y reintento; cancelación; recarga; actualización desde otra pestaña; avatar personal; sedes y permisos.
- Ambos temas y anchos de 320, 375, 390, 430, 768, 1024, 1440 y 1920 px para nombres y subtítulos extensos. Las regresiones de sedes y navegación añaden otras resoluciones y el modal a 320 × 480 px.
- Se revisaron capturas de escritorio y móvil en ambos temas; no se encontró desbordamiento horizontal global. La identidad completa sigue disponible al contraer el menú.
- Los artefactos compilados del odontograma conservan sus nombres con hash `odontogram-B0VyF-Zx.css` y `odontogram-33SQCvNn.js`; no hay cambios en la biblioteca ni en sus dependencias.

Evidencia local en `front/test-results/institution-identity-final` y `front/test-results/institution-identity-navigation-fix`.

Para reproducir con localhost iniciado, desde `front`:

```powershell
$env:CLINIC_TEST_URL='http://127.0.0.1:5173'
npx.cmd playwright test tests/institution-identity.spec.ts tests/institution-branding.spec.ts tests/institution-profile.spec.ts tests/profile-integration.spec.ts tests/navigation-iconography.spec.ts --workers=2 --reporter=line --output=test-results/institution-identity-reproduction
```

## Alcance de la persistencia

La configuración continúa guardándose en este navegador mediante el mecanismo existente. La sincronización inmediata y entre pestañas corresponde al mismo almacenamiento local; no se agrega un servicio de sincronización entre dispositivos. El formulario mantiene su borrador ante cambios de otra pestaña hasta que el usuario lo descarta o guarda.
