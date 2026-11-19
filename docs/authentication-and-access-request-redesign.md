# Autenticación y Solicitar acceso

Fecha: 19 de noviembre de 2026. Rutas: `/login`, `/recuperar-contrasena` y `/solicitar-acceso`.

## Resultado

Se conserva una composición centrada y minimalista: identidad institucional, una tarjeta de formulario y el pie de acceso autorizado. No se añaden fotografías, ilustraciones, columnas decorativas ni tarjetas para las acciones.

La auditoría encontró padding de 32 px, separaciones de hasta 28 px, controles de 48 px, una explicación independiente para Recordarme y textos institucionales fijos. Las tres pantallas ya compartían AuthLayout, por lo que se ajusta ese componente y su hoja de estilos existente.

La tarjeta usa padding de 20–24 px y separaciones de 14–18 px; inputs y botones mantienen una altura de 44 px y texto de entrada de 16 px. Login y recuperación tienen un ancho máximo de 460 px. Solicitar acceso dispone de hasta 520 px para organizar los nombres. No hay alturas fijas de tarjeta ni centrado que recorte el contenido cuando falta altura.

## Solicitar acceso: último ajuste solicitado

- Nombres y Apellidos se administran por separado. Ambos son obligatorios, con los placeholders «Ej. Juan Carlos» y «Ej. Pérez López» y autocomplete given-name/family-name.
- Se aceptan nombres compuestos, espacios, acentos, apóstrofes y guiones. No se añaden patrones restrictivos ni límites de caracteres.
- En escritorio y tablet comparten la primera fila con el mismo ancho y altura. En móvil pasan a una columna cuando falta espacio. Correo, institución opcional y mensaje opcional ocupan las filas siguientes completas.
- Los asteriscos son decorativos; los inputs mantienen nombres accesibles claros, required y errores asociados mediante aria-describedby.
- La indicación opcional aparece junto a las etiquetas. Se retira la línea independiente debajo de institución.
- El mensaje comienza con tres líneas y crece hasta 200 px; conserva el contenido al cambiar de tema o resolución y permite edición y desplazamiento interno.
- Se retira la flecha entre «¿Ya tienes acceso?» e «Iniciar sesión».
- El envío permanece deshabilitado y acompañado de su aviso real de indisponibilidad. Pulsar Enter no envía ni persiste los datos.

### Compatibilidad del contrato

El schema y el tipo originales AccessRequestFormValues, que utilizan fullName, permanecen intactos. Un adaptador de presentación valida firstName y lastName por separado y prepara el objeto existente uniendo ambos valores con un espacio y retirando únicamente los espacios exteriores.

Por ejemplo, «María José» y «D'Ávila Pérez-López» producen `fullName: "María José D'Ávila Pérez-López"`. No se agregan firstName/lastName al contrato externo ni se deduce cómo dividir nombres guardados. La preparación no habilita ningún endpoint ni simula una solicitud enviada.

## Ajustes compartidos de autenticación

AuthLayout utiliza el hook institucional existente para nombre, subtítulo opcional y logo. El título del documento también utiliza el nombre configurado. Si no hay subtítulo no aparece una segunda línea vacía. Solo se muestran estos datos públicos de marca; no se renderizan razón social, RUC, contacto ni notas privadas.

Se reutilizan las iniciales institucionales centralizadas y la imagen personalizada conserva sus proporciones con object-fit: contain. El switch aprobado del Header se reutiliza fuera de la tarjeta, en la esquina superior derecha, sin cambiar su implementación ni crear otra gestión de temas.

Login conserva correo, contraseña oculta inicialmente, botón de visibilidad, enlaces y redirecciones. Recordarme sigue deshabilitado, con ayuda accesible mediante tooltip en lugar de un párrafo visible independiente. Se mantiene el procesamiento real y se impiden envíos concurrentes desde la interfaz. Los errores de cliente conservan sus mensajes; fallos de servidor o desconocidos muestran un mensaje seguro sin trazas internas. Un error no borra los campos y permite reintentar.

Recuperación y solicitud comparten el aviso compacto AuthNotice y AuthUnavailableAction. Sus botones no se habilitan porque esos envíos todavía no están implementados. Las rutas, sesiones, roles, permisos y APIs no cambian.

Los estados focus usan el primario del tema y un contorno discreto, sin cambiar dimensiones. Las reglas autofill estándar y WebKit mantienen la superficie, texto y cursor del tema, sin desactivar el autocompletado ni los administradores de contraseñas. Las transiciones son breves y respetan movimiento reducido.

## Componentes y archivos

Se reutilizan AuthLayout, AuthUnavailableAction, InstitutionLogo, useInstitutionProfile, HeaderThemeSwitch, Card, Field, FieldGroup, FieldLabel, FieldError, Input, Textarea, Checkbox, Button y Tooltip.

AuthNotice y AuthRememberHelp son pequeños componentes locales en el archivo existente de AuthLayout. No se crea otra familia de controles ni una arquitectura de autenticación paralela.

| Archivo de producción | Cambio |
| --- | --- |
| `front/src/modules/auth/components/auth-layout.tsx` | Marca dinámica, switch existente, aviso y ayuda compartidos. |
| `front/src/modules/auth/auth.css` | Densidad, alineación, temas, autofill y responsive, limitados a autenticación. |
| `front/src/modules/auth/pages/login-page.tsx` | Ayuda de Recordarme, aviso de error y prevención de envíos concurrentes. |
| `front/src/modules/auth/pages/recover-password-page.tsx` | Descripción y aviso compactos; envío deshabilitado. |
| `front/src/modules/auth/pages/request-access-page.tsx` | Nombres y Apellidos independientes, distribución y enlace sin flecha. |
| `front/src/modules/auth/lib/access-request-form.ts` | Adaptador de presentación al contrato fullName existente. |

| Prueba o documentación | Cambio |
| --- | --- |
| `front/tests/access-request-redesign.spec.ts` | Contrato, nombres, validación, responsive e identidad pública. |
| `front/tests/authentication-interactions.spec.ts` | Envíos concurrentes, errores, reintentos y autofill. |
| `front/tests/helpers/access-theme.ts` | Selección del tema con el switch compartido. |
| `front/tests/auth-ui.spec.ts` | Nuevos nombres, avisos y semántica del switch. |
| `front/tests/header-theme-switch.spec.ts` | Distinción entre el tema claro predeterminado y una preferencia ya guardada. |
| `front/tests/*.spec.ts`, enumerados al final | Sustitución del arranque que pulsaba dos botones de tema por el helper del switch. No se cambian las reglas comprobadas de los módulos. |
| `docs/authentication-and-access-request-redesign.md` | Este informe. |

Se conservan los cambios institucionales locales de las tareas anteriores.

## Pruebas ejecutadas

- Build de producción y TypeScript (`tsc -b`): aprobados.
- Lint: sin errores, con las tres advertencias previas de Fast Refresh en Button, Badge y Tabs.
- Ejecución final de autenticación, solicitud, interacciones y switch: **29/29 aprobadas**.
- Regresión adicional de integración de perfiles y simplificación institucional: **14/14 aprobadas**.
- Total: **43 casos distintos aprobados**. No se ejecuta ni se declara aprobada la totalidad de la suite histórica del repositorio.
- Verificación en 320, 360, 375, 390, 430, 768, 1024, 1280, 1440 y 1920 px, en ambos temas. Solicitar acceso también se comprueba a 320 × 480 px.
- Se revisan capturas de las tres pantallas. La tarjeta y la marca están centradas, no hay desplazamiento horizontal global y las acciones siguen accesibles con poca altura.
- Los tests comprueban nombres compuestos, campos obligatorios y opcionales, ausencia de envíos y persistencia en los formularios pendientes, validaciones, contraseña visible/oculta, redirecciones, reintentos, preferencia de tema y actualización institucional desde otra pestaña sin perder el borrador.
- El estado autofill se fuerza con CDP en Chrome para correo y contraseña; superficie, texto y valores se mantienen al alternar temas. No se deshabilitan los atributos de autocompletado.
- La auditoría por hashes confirma **96 archivos protegidos sin cambios**, incluidos APIs, contratos originales, store de autenticación, protección de rutas, estilos globales y la implementación del switch aprobado.
- Odontograma y periodontograma permanecen intactos. Los artefactos de la librería conservan `odontogram-B0VyF-Zx.css` y `odontogram-33SQCvNn.js`.

Evidencia local en `front/test-results/authentication-redesign-final`, `front/test-results/authentication-redesign-integration` y `front/test-results/authentication-redesign/protected-audit.json`.

Para reproducir, con localhost iniciado, desde `front`:

```powershell
$env:CLINIC_TEST_URL='http://127.0.0.1:5173'
npx.cmd playwright test tests/access-request-redesign.spec.ts tests/auth-ui.spec.ts tests/authentication-interactions.spec.ts tests/header-theme-switch.spec.ts tests/profile-integration.spec.ts tests/institution-simplification.spec.ts --workers=2 --reporter=line --output=test-results/authentication-reproduction
```

## Límites de la verificación

El envío de solicitudes, recuperación y Recordarme continúan pendientes de su implementación real; no se añaden simulaciones ni persistencia de contraseñas. Las pruebas de navegador usan Chrome. Hay selectores de autofill estándar y WebKit, pero no se ejecutaron Safari, Firefox ni un gestor de contraseñas externo. La altura disponible del teclado se aproxima con un viewport reducido, sin afirmar una prueba sobre un teclado virtual de un teléfono físico.

## Archivos de prueba que usan el helper del tema

- `front/tests/access-request-redesign.spec.ts`
- `front/tests/appointments-calendar-redesign.spec.ts`
- `front/tests/appointments-polish.spec.ts`
- `front/tests/auth-ui.spec.ts`
- `front/tests/authentication-interactions.spec.ts`
- `front/tests/calendar-selector-reference.spec.ts`
- `front/tests/calendar-single-date-today.spec.ts`
- `front/tests/calendar-toolbar-filters.spec.ts`
- `front/tests/calendar-views-visual.spec.ts`
- `front/tests/clinical-density.spec.ts`
- `front/tests/clinical-encounter-redesign.spec.ts`
- `front/tests/clinical-modal.spec.ts`
- `front/tests/clinical-navigation-integration.spec.ts`
- `front/tests/clinical-navigation-visual.spec.ts`
- `front/tests/content-ui.spec.ts`
- `front/tests/dashboard-redesign.spec.ts`
- `front/tests/finance-reports-redesign.spec.ts`
- `front/tests/form-actions.spec.ts`
- `front/tests/frontend-redesign.spec.ts`
- `front/tests/global-design-system.spec.ts`
- `front/tests/global-interactions.spec.ts`
- `front/tests/header-theme-switch.spec.ts`
- `front/tests/institution-branding.spec.ts`
- `front/tests/institution-identity.spec.ts`
- `front/tests/institution-profile.spec.ts`
- `front/tests/institution-simplification.spec.ts`
- `front/tests/inventory-redesign.spec.ts`
- `front/tests/messaging-redesign.spec.ts`
- `front/tests/navigation-iconography.spec.ts`
- `front/tests/navigation-shell.spec.ts`
- `front/tests/patient-accordion-motion.spec.ts`
- `front/tests/patient-edit-modal.spec.ts`
- `front/tests/patient-single-accordion.spec.ts`
- `front/tests/patients-redesign.spec.ts`
- `front/tests/patients-ui-refinement.spec.ts`
- `front/tests/phase4-density.spec.ts`
- `front/tests/profile-acceptance.spec.ts`
- `front/tests/profile-integration.spec.ts`
- `front/tests/profile-setup-visual.spec.ts`
- `front/tests/treatments-redesign.spec.ts`
- `front/tests/ui-standardization.spec.ts`
