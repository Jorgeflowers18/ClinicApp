# Login Linear y pantallas de acceso

Implementación frontend basada en el prompt adjunto y en `DESIGN.md`,
`tokens.json`, `variables.css` y `theme.css` de `C:/Users/Josue/Downloads`.
Se adaptaron sus colores, radios, espaciado y tipografía al sistema existente.
Los archivos de referencia originales no se modificaron.

## 1. Archivos modificados y creados

Rutas relativas a `ClinicApp-main`:

| Archivo | Cambio |
| --- | --- |
| `front/index.html` | Idioma español y lectura temprana de la preferencia de next-themes. |
| `front/src/app/providers.tsx` | Tema claro por defecto en el proveedor existente. |
| `front/src/app/routes.tsx` | Agrega las dos rutas públicas de interfaz. |
| `front/src/modules/auth/pages/login-page.tsx` | Presentación centrada, enlaces, accesibilidad y estado pendiente de Recordarme. |
| `front/src/modules/auth/components/auth-layout.tsx` | Nuevo contenedor visual compartido y acción inactiva con explicación. |
| `front/src/modules/auth/auth.css` | Nuevo estilo Linear con alcance exclusivo a las pantallas públicas de acceso. |
| `front/src/modules/auth/pages/recover-password-page.tsx` | Nueva interfaz de recuperación. |
| `front/src/modules/auth/pages/request-access-page.tsx` | Nueva interfaz de solicitud. |
| `front/src/modules/auth/types/access-form.types.ts` | Nueva validación de presentación con Zod. |
| `front/tests/auth-ui.spec.ts` | Doce pruebas de las pantallas públicas. |
| `front/tests/design-system.spec.ts` | Actualiza solamente la expectativa inicial a claro. |
| `documentacion/login-premium.md` | Este informe. |

## 2. Componentes

Se crearon `AuthLayout` y `AuthUnavailableAction`. Se reutilizan `Button`,
`Checkbox`, `Card`, `CardHeader`, `CardContent`, `Input`, `Textarea`, `Field`,
`FieldGroup`, `FieldLabel` y `FieldError`, además de Inter, Lucide, next-themes,
React Hook Form y Zod ya instalados. No se añadieron dependencias.

## 3. Presentación

Las tres vistas comparten marca centrada, una columna de hasta 460 px, tarjeta de
radio 12 px, controles de radio 6 px, bordes discretos y enlaces subrayados.
Se conserva el logo institucional configurado y su alternativa original CA.
El login incorpora el título y subtítulo solicitados, la opción de visualizar la
contraseña y el texto «Acceso para personal autorizado» debajo de la tarjeta.
La fila de Recordarme y recuperación se reorganiza en dos líneas en móvil.

Los estilos nuevos se limitan al contenedor `auth-shell`. Los estilos globales,
los componentes compartidos y las interfaces de otros módulos no se modificaron.
La lista visible de credenciales mock se retiró de la tarjeta; las cuentas de
prueba existentes continúan funcionando.

## 4. Tema claro y oscuro

La primera visita sin preferencia guardada usa claro, incluso si el sistema
operativo está en oscuro. El tema claro utiliza fondo `#f5f6f8`, tarjeta blanca y
botón principal `#161718`. El oscuro utiliza Void `#08090a`, Carbon `#0f1011`,
Obsidian, Graphite, Mist y la acción Acid Lime `#e4f222` con texto oscuro.

El selector de sol y luna usa el mismo ThemeProvider y la clave `theme` del resto
de la aplicación. La preferencia se conserva al recargar, cambiar de pantalla,
iniciar sesión y salir. La lectura inicial en el HTML aplica esa misma preferencia
antes de cargar React; no crea otro estado ni otro almacenamiento de tema.
Si el navegador bloquea el almacenamiento, el cambio de tema sigue funcionando
durante la visita.

## 5. Navegación

| Ruta | Enlaces |
| --- | --- |
| `/login` | Recuperar contraseña y Solicitar acceso. |
| `/recuperar-contrasena` | Volver a iniciar sesión. |
| `/solicitar-acceso` | Iniciar sesión. |

Los enlaces conservan el estado de navegación recibido por el login. Cada vista
actualiza su título y el foco del encabezado; al salir se restaura el título
anterior de la aplicación. No se cambiaron rutas funcionales ni sus protecciones.

## 6. Recordarme

No existía un comportamiento funcional asociado. La casilla se muestra
deshabilitada, con etiqueta y descripción asociadas, y el texto «Próximamente».
No cambia la duración de la sesión ni almacena contraseñas.

## 7. Recuperación y solicitud de acceso

Recuperación valida el correo al abandonar el campo. «Enviar instrucciones» está
deshabilitado y explica que el envío aún no está disponible.

Solicitud valida nombre y correo al abandonar sus campos. Clínica y mensaje son
opcionales. «Enviar solicitud» está deshabilitado y muestra el aviso de
disponibilidad futura. Los errores aparecen con texto y se asocian a los campos.

Ambos formularios son interfaces: no envían peticiones de escritura, no guardan
sus valores y no muestran confirmaciones de envío. Pulsar Enter tampoco envía.
El login conserva su schema, mutation, sesiones y redirecciones existentes.

## 8. Pruebas

Ejecutadas desde `front`, con localhost activo:

```powershell
npm.cmd run build
npm.cmd run lint
$env:CLINIC_TEST_URL = 'http://localhost:5173'
npm.cmd run test:e2e -- tests/auth-ui.spec.ts tests/design-system.spec.ts tests/shared-accessibility.spec.ts --output=test-results/access-ui --reporter=line
git diff --check
```

- Compilación TypeScript y Vite correcta.
- Lint sin errores; seis avisos en archivos no modificados.
- Catorce pruebas de navegador aprobadas: doce nuevas y dos de regresión sobre
  el sistema de diseño y la navegación accesible de pacientes.
- Se verificaron las tres pantallas en ambos temas a 320, 375, 390, 430, 768,
  1024, 1440 y 1920 px: 48 combinaciones sin desbordamiento horizontal, con marca
  y tarjeta centradas y controles interactivos de al menos 44 px de alto.
- Se comprobaron contraste de texto y placeholders de al menos 4.5:1, bordes de
  campos de al menos 3:1, teclado, foco visible, etiquetas, errores asociados,
  botones inactivos y visibilidad de la contraseña.
- Se verificaron el arranque del tema antes de React, el almacenamiento bloqueado,
  la persistencia compartida, los errores del login y la ausencia de envíos o
  almacenamiento de los nuevos formularios. El login se probó con la API mock.
- Se hicieron otras doce comprobaciones sobre la compilación de producción:
  tres vistas, dos temas y anchos de 320 y 1440 px, sin errores de JavaScript ni
  desbordamiento horizontal. Se revisaron capturas de móvil y escritorio.
- Capturas locales en `front/test-results/access-ui/`; producción en su subcarpeta
  `production`. Son artefactos ignorados por Git.

## 9. Pendientes y avisos

Recordarme, el envío de instrucciones y el envío de solicitudes quedan pendientes
de una implementación funcional posterior. Las interfaces no los presentan como
funciones terminadas.

Vite avisa de bundles superiores a 500 kB. Los seis avisos de lint corresponden a
Fast Refresh en button, badge y tabs, y a React Compiler en inventario,
notificaciones y visit-workspace. No se amplió el alcance para corregirlos.

## 10. Estado del repositorio

Se trabajó en `ClinicApp-main`: cinco archivos modificados y siete nuevos,
incluido este informe. Ya existían cambios en providers y design-system; se
conservaron sus ajustes y se actualizó lo necesario para el tema claro solicitado.
No se crearon commits ni se hizo push.

No se modificaron API, stores de autenticación, roles, permisos, datos, cálculos,
odontograma ni módulos clínicos o administrativos. Tampoco se modificaron
dependencias. La reorganización preexistente que muestra el repositorio exterior
`ClinicaApp` se conservó.

El servidor de desarrollo permanece activo en `http://localhost:5173/login`.
