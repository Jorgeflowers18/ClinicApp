# ClinicApp · Temas definitivos y perfiles integrados

> Actualización posterior: el logo ahora comparte `--primary` y
> `--primary-foreground` con los botones, incluido Acid Lime en oscuro. El
> informe vigente de ese ajuste está en [SHARED_PRIMARY_LOGO_REPORT.md](SHARED_PRIMARY_LOGO_REPORT.md).

Estado vigente tras la corrección definitiva de colores, exclusivamente en
`ClinicApp-main/front`: **claro con violeta original ClinicApp; oscuro con
Acid Lime de Linear y marca neutra**. Esta configuración sustituye las
indicaciones anteriores sobre botones negros y logo negro en claro.
Los apartados B y L conservan el registro de la integración de perfiles; el
apartado M identifica los cambios de la corrección de colores posterior.

## A. Implementación

Se conservó el Design System global ya implementado y se aplicaron los cambios:
dos paletas diferenciadas, logo CA adaptativo, componente de marca compartido, edición
de Mi perfil dentro del AppLayout y explicación discreta de Recordarme.

Perfil institucional ya utilizaba el AppLayout. Se mantuvo esa integración y se
actualizaron su encabezado y su marca. No se agregó otro layout ni se abrieron
ventanas nuevas. Configuración inicial conserva su formulario y su acción
Continuar; únicamente incorpora la marca y un selector del tema existente.

## B. Archivos de esta entrega

Rutas relativas a `ClinicApp-main`:

| Archivo | Cambio de esta entrega |
| --- | --- |
| `front/src/shared/components/brand-logo.tsx` | Nuevo BrandLogo y presentación de logos institucionales sin alterar imágenes personalizadas. |
| `front/src/styles/tokens.css` | Tokens del logo por tema; separa marca de acciones, calendario e identidad personalizada. |
| `front/src/styles/app.css` | Geometría compartida de marca y navegación activa neutral. |
| `front/src/app/layout/app-layout.tsx` | Reutiliza BrandLogo; Mi perfil en navegación y breadcrumbs; conserva configuración inicial independiente. |
| `front/src/app/routes.tsx` | Anida la misma URL de perfil bajo AppLayout; mantiene las protecciones y todas las URLs. |
| `front/src/modules/auth/components/auth-layout.tsx` | Usa InstitutionLogo en las tres pantallas de acceso. |
| `front/src/modules/auth/auth.css` | Elimina colores locales de marca y el badge Próximamente; texto de ayuda discreto. |
| `front/src/modules/auth/pages/login-page.tsx` | Recordarme continúa deshabilitado con descripción debajo de la fila. |
| `front/src/modules/auth/pages/user-profile-page.tsx` | Distingue configuración inicial y edición; título Mi perfil, Guardar cambios y layout integrado. |
| `front/src/modules/institution/pages/institution-profile-page.tsx` | Encabezado solicitado y componente de logo compartido. |
| `front/tests/auth-ui.spec.ts` | Actualiza la descripción de Recordarme y comprueba su contraste. |
| `front/tests/global-design-system.spec.ts` | Comprueba la marca adaptativa en ambos temas y conserva la matriz global. |
| `front/tests/global-interactions.spec.ts` | Etiqueta Mi perfil y geometría estable al cambiar el tema. |
| `front/tests/profile-integration.spec.ts` | Nueve pruebas nuevas de configuración, perfil, guardado, fotos, logos, sedes y permisos. |
| `front/scripts/capture-premium-design.mjs` | Capturas de acceso, configuración inicial, perfiles y Panel. |
| `front/scripts/compare-design-system.mjs` | Admite las comparativas de ambas fases sin sobrescribir la anterior. |
| `front/DESIGN_SYSTEM_REPORT.md` | Identifica el informe anterior como histórico y enlaza este documento. |
| `front/DESIGN_SYSTEM_PREMIUM_REPORT.md` | Informe vigente. |

Los componentes globales estandarizados en la fase anterior se reutilizan:
Button, Card, Input, Textarea, Select, Table, Dialog, AlertDialog, Sheet,
Calendar, AdaptiveTabs, Alert, Badge y PageHeader. No se agregaron dependencias.

## C. Design System

Para el tema oscuro se revisaron las cuatro referencias Linear de `C:/Users/Josue/Downloads`:
`DESIGN.md`, `tokens.json`, `variables.css` y `theme.css`. Sus ejemplos de
marketing se adaptaron a los requisitos explícitos de la aplicación clínica.
No se importaron cuatro hojas de variables ni se duplicó el ThemeProvider.
El tema claro recupera los valores originales del proyecto desde Git, incluidos
`--clinic-primary: #5350cc`, su hover `#403cd5` y fondo `#f7f7f8`.

`src/styles/tokens.css` sigue siendo la fuente de colores semánticos, superficies,
texto, acciones, estados, bordes, foco, gráficos, espaciado y radios. `src/index.css`
los conecta a Tailwind 4 mediante el mecanismo `@theme inline` existente.

Inter Variable sigue siendo la fuente principal, con pesos de referencia 400,
510 y 590. Se conserva la escala de 4 px, radio de controles de 6 px y tarjetas
de 12 px. Los estados clínicos y colores de avatar permanecen independientes.

## D. Modo claro

| Función | Valor |
| --- | --- |
| Fondo general | `#f7f7f8`, original ClinicApp |
| Sidebar, header y tarjetas | `#ffffff` |
| Superficie secundaria | `#f1f2f3` |
| Texto principal / secundario | `#17191c` / `#62666d` |
| Borde / separador | `#e1e3e6` / `#e5e7eb` |
| Acción primaria | `#5350cc`, texto blanco; hover `#403cd5` |
| Navegación y pestañas activas | Acentos violetas |
| Foco | `#007fbd`, original ClinicApp |

Continúa siendo el tema predeterminado sin preferencia guardada, incluso si el
sistema operativo usa oscuro. La preferencia existente se aplica desde el HTML
antes del arranque de React. La suite comprueba este comportamiento y el uso
cuando el almacenamiento del navegador está bloqueado.

## E. Modo oscuro

| Función | Valor |
| --- | --- |
| Fondo | Void `#08090a` |
| Sidebar, header y tarjetas | Carbon `#0f1011` |
| Superficie secundaria | Obsidian `#161718` |
| Borde / separador | Graphite `#23252a` / Smoke `#383b3f` |
| Texto principal / secundario | Paper `#ffffff` / Mist `#d0d6e0` |
| Acción primaria | Acid Lime `#e4f222`, texto Void |

Se mantiene next-themes, la misma preferencia persistida y la misma geometría
de la interfaz. Login, configuración inicial y menú cambian esa preferencia.
La recarga, navegación, salida y regreso al login conservan el tema. Acid Lime
continúa reservado a acciones principales; gráficos y estados usan sus tokens.

## F. Logo adaptativo

| Token | Claro | Oscuro |
| --- | --- | --- |
| `--brand-logo-background` | Violeta ClinicApp `#5350cc` | Bone `#e5e5e6` |
| `--brand-logo-foreground` | Paper `#ffffff` | Void `#08090a` |

BrandLogo conserva CA, proporción cuadrada, alineación y radio de 12 px, sin
degradados ni sombras. Se utiliza en sidebar expandido, contraído y móvil,
configuración inicial y, mediante InstitutionLogo, Login, Recuperar contraseña,
Solicitar acceso y la vista previa institucional.

InstitutionLogo conserva las imágenes subidas sin filtros ni recoloreado. Las
iniciales personalizadas de una clínica mantienen su apariencia independiente.
La marca CA utiliza violeta en claro y Bone en oscuro, independientemente del
botón primario oscuro. Los tokens de los logos personalizados y las series de
gráficos permanecen separados de la marca CA y de los estados semánticos.

Las comprobaciones verifican los colores de fondo y letras, proporción y radio
del logo, además de conservar imágenes e iniciales personalizadas. Los colores
personales y la foto del usuario se comprueban por separado.

## G. Matriz responsive

Anchos: **320, 360, 375, 390, 430, 600, 768, 1024, 1280, 1440 y 1920 px**.
M significa móvil 320–430; T significa tablet 600–1024; E significa escritorio
1280–1920. Las verificaciones de esta tabla corresponden a la ejecución integral
aprobada y registrada en la sección I.

| Pantalla | M | T | E | Claro | Oscuro | Comprobaciones | Pendientes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Panel | Sí | Sí | Sí | Sí | Sí | Límites, etiquetas, contraste, gráfico | Dispositivo físico¹ |
| Pacientes | Sí | Sí | Sí | Sí | Sí | Búsqueda, filas, tarjetas y teclado | Dispositivo físico¹ |
| Nuevo paciente | Sí | Sí | Sí | Sí | Sí | Campos, acciones y límites | Dispositivo físico¹ |
| Detalle de paciente | Sí | Sí | Sí | Sí | Sí | Campos y pestañas | Dispositivo físico¹ |
| Citas | Sí | Sí | Sí | Sí | Sí | Mes/Semana/Día, fechas, filtros, diálogos | Dispositivo físico¹ |
| Historial clínico | Sí | Sí | Sí | Sí | Sí | Listado, filtros y controles externos | Dispositivo físico¹ |
| Historia del paciente | Sí | Sí | Sí | Sí | Sí | Motor, visitas, diagnósticos y mediciones | Dispositivo físico¹ |
| Tratamientos | Sí | Sí | Sí | Sí | Sí | Listado, acciones y límites | Dispositivo físico¹ |
| Nuevo tratamiento | Sí | Sí | Sí | Sí | Sí | Campos, acciones y límites | Dispositivo físico¹ |
| Detalle de tratamiento | Sí | Sí | Sí | Sí | Sí | Resúmenes y acciones | Dispositivo físico¹ |
| Inventario | Sí | Sí | Sí | Sí | Sí | Cinco secciones accesibles | Dispositivo físico¹ |
| Nuevo insumo | Sí | Sí | Sí | Sí | Sí | Campos, acciones y límites | Dispositivo físico¹ |
| Detalle de insumo | Sí | Sí | Sí | Sí | Sí | Datos, acciones y límites | Dispositivo físico¹ |
| Notificaciones | Sí | Sí | Sí | Sí | Sí | Editor, controles y tablas | Dispositivo físico¹ |
| Finanzas | Sí | Sí | Sí | Sí | Sí | Cartera, columnas y desplazamiento | Dispositivo físico¹ |
| Reportes | Sí | Sí | Sí | Sí | Sí | Cuatro secciones y gráficos | Dispositivo físico¹ |
| Mi perfil | Sí | Sí | Sí | Sí | Sí | Layout, campos, foto, color y guardado | Dispositivo físico¹ |
| Perfil institucional | Sí | Sí | Sí | Sí | Sí | Layout, campos, sedes, logos y guardado | Dispositivo físico¹ |
| Login | Sí | Sí | Sí | Sí | Sí | Acceso mock, contraseña, enlaces y contraste | Recordarme sin función |
| Recuperar contraseña | Sí | Sí | Sí | Sí | Sí | Campos, contraste, tema y retorno | Envío pendiente |
| Solicitar acceso | Sí | Sí | Sí | Sí | Sí | Campos, contraste, tema y retorno | Envío pendiente |
| Configuración inicial | Sí | Sí | Sí | Sí | Sí | Marca, campos, borrador, Continuar y destino | Dispositivo físico¹ |

Son **484 combinaciones de pantalla, tema y ancho**: 396 de los módulos, 66 de
acceso y 22 de configuración inicial. La matriz de módulos comprueba límites
de controles, etiquetas y contraste de controles activos a 1440 px; la de acceso
comprueba campos, contraste y controles táctiles. No equivale a una auditoría
WCAG completa de todos los píxeles y estados.

También se comprueban navegación móvil, Escape y retorno del foco, sidebar
de 256/72 px, geometría estable entre temas, calendarios y pestañas adaptativas.
Las pruebas incluyen orientación 844 × 390, diálogos en ocho tamaños hasta
1920 × 1080, altura reducida, zoom CSS del 200 % y movimiento reducido.

¹ Chrome de escritorio con viewports controlados. Quedan pendientes dispositivos
físicos iOS/Android, teclado real, otros navegadores, zoom de la interfaz del
navegador y una revisión manual con lector de pantalla. La reducción de altura
y el zoom CSS son simulaciones.

## H. Integración de perfiles

La URL `/perfil-usuario` conserva su protección y se presenta bajo AppLayout.
Cuando la cuenta cumple la misma condición inicial existente —perfil ausente
o nombre vacío—, el layout muestra únicamente el formulario inicial. Al acceder
con un perfil completo, aparecen Sidebar, Header, breadcrumbs y la página
Mi perfil con «Administra tu información personal y profesional».

La acción se llama Continuar en configuración inicial y Guardar cambios en
edición. Ambas llaman al mismo guardado existente, con la misma limpieza de
espacios y destino de navegación. Se conservan foto, nombre, cargo,
especialidad, biografía y color; no se agregaron campos ni otro almacenamiento.

Perfil institucional conserva la ruta `/perfil-institucion`, su protección de
administrador, todas sus tarjetas, contacto, horarios, sedes y guardado. Sus
opciones de menú se activan por su URL exacta; no se activa Mi perfil al entrar
al perfil institucional. En móvil ambos perfiles mantienen acceso al menú.

## I. Verificaciones y funcionalidades conservadas

```powershell
npm.cmd run build
npm.cmd run lint
$env:CLINIC_TEST_URL = 'http://localhost:5173'
$env:PLAYWRIGHT_JSON_OUTPUT_FILE = 'test-results/color-theme-complete.json'
npm.cmd run test:e2e -- --output=test-results/color-theme-complete --reporter=line,json --max-failures=3
git diff --check
```

- Build: correcto, TypeScript y Vite.
- Lint: correcto, seis avisos preexistentes; sin errores.
- Suite integral de la corrección de colores: **77 pruebas aprobadas**, cero
  fallidas, omitidas o inestables; aproximadamente 6 minutos y 14 segundos.
  Resultado: `test-results/color-theme-complete.json`.
- `git diff --check`: correcto, sin errores de whitespace.
- Archivos protegidos: **77 huellas SHA-256 sin cambios** respecto al inicio
  de esta entrega, incluidos API, stores, schemas/tipos, hooks, utilidades y
  archivos clínicos. Registro: `test-results/premium-after/protection-check.json`.
- No se modificaron dependencias, backend, SVG, coordenadas ni motor clínico.

Las pruebas existentes cubren autenticación, errores, temas, salida, navegación,
tablas con teclado, filtros, calendario, diagnósticos, odontograma, visitas,
exportaciones y mediciones periodontales. Las nuevas pruebas cubren además:
configuración inicial y su destino; borrador intacto al cambiar tema; guardado
de datos reales del perfil y recarga; foto y color personalizados; navegación
móvil entre perfiles; guardado de sedes y logos; permisos de admin, médico y
recepción. No se sustituyó la API ni el store para estos ajustes visuales.

## J. Comparación visual

**28 pares, 56 capturas** del estado anterior a la integración de perfiles y
del resultado actual, actualizado con los colores definitivos. Siete pantallas:
Login, Recuperar contraseña, Solicitar
acceso, Configuración inicial, Mi perfil, Perfil institucional y Panel. Dos
temas y anchos de 390 y 1440 px, con la fuente y el layout estabilizados.

- [Comparador vigente en localhost](http://localhost:5173/test-results/premium-comparison.html).
- [Comparador HTML local](test-results/premium-comparison.html).
- Directorios `test-results/premium-before` y `test-results/premium-after`.

Se revisaron visualmente Mi perfil en móvil claro y escritorio oscuro,
Configuración inicial en móvil claro, Login oscuro en escritorio y Perfil
institucional oscuro en escritorio. Los screenshots corresponden al
viewport; los perfiles tienen su desplazamiento vertical dentro del AppLayout.
El widget TanStack de las capturas corresponde exclusivamente a desarrollo.

```powershell
node scripts/capture-premium-design.mjs before
# Aplicar los cambios.
node scripts/capture-premium-design.mjs after
node scripts/compare-design-system.mjs premium
```

Las comparativas de la fase anterior se conservan y están identificadas como
históricas; sus imágenes pueden mostrar el logo violeta anterior.

## K. Límites y pendientes

- Dispositivos físicos, otros navegadores y lector de pantalla, según la nota G.
- Recordarme, recuperación y solicitud continúan sin servicio implementado.
  Se indican como no disponibles; no se simulan envíos ni éxitos.
- Las pruebas de guardado y permisos utilizan la API mock que ya tenía el
  proyecto; no se ha certificado una integración con backend real.
- Vite mantiene el aviso preexistente de chunks superiores a 500 kB.
- Lint mantiene seis avisos preexistentes de Fast Refresh y React Compiler.

## L. Git y cambios preexistentes

No se hicieron commits, push, restauraciones globales ni cambios fuera del
frontend. El árbol de trabajo ya contenía la estandarización anterior y el
login premium. Se guardaron su estado y 175 huellas de archivos antes de editar:
`test-results/premium-before/git-status.txt`, `working-tree.patch` y
`working-files.json`. Los artefactos de prueba están ignorados por Git.

Los 18 archivos de la sección B son los tocados o creados en esta entrega.
Los siguientes cambios anteriores también siguen presentes en Git; no se
modificaron en esta entrega (rutas relativas a `ClinicApp-main`):

```text
front/index.html
front/src/app/providers.tsx
front/src/components/ui/adaptive-tabs.tsx
front/src/components/ui/alert-dialog.tsx
front/src/components/ui/alert.tsx
front/src/components/ui/badge.tsx
front/src/components/ui/button.tsx
front/src/components/ui/calendar.tsx
front/src/components/ui/card.tsx
front/src/components/ui/dialog.tsx
front/src/components/ui/input.tsx
front/src/components/ui/select.tsx
front/src/components/ui/sheet.tsx
front/src/components/ui/table.tsx
front/src/components/ui/textarea.tsx
front/src/index.css
front/src/modules/appointments/appointments-calendar.css
front/src/modules/appointments/pages/appointments-calendar-page.tsx
front/src/modules/auth/pages/recover-password-page.tsx
front/src/modules/auth/pages/request-access-page.tsx
front/src/modules/auth/types/access-form.types.ts
front/src/modules/reports/components/agenda-report-tab.tsx
front/src/modules/reports/components/productivity-report-tab.tsx
front/src/shared/components/page-header.tsx
front/tests/design-system.spec.ts
front/scripts/capture-design-system.mjs
documentacion/login-premium.md
```

Los archivos nuevos de marca, capturas, pruebas e informe siguen sin seguimiento
de Git, al igual que los archivos nuevos de las fases previas. Los archivos
rastreables existentes siguen modificados; no se ocultaron esas diferencias.
La reorganización previa del repositorio exterior permanece intacta.

## M. Corrección definitiva de colores

La corrección posterior cambió únicamente dos archivos de estilos de la
aplicación: `front/src/styles/tokens.css` y `front/src/styles/app.css`.
No se modificaron componentes React, rutas, layouts, formularios, validaciones,
stores, API, cálculos, imágenes ni representaciones clínicas en esta corrección.

Se recuperaron desde `HEAD:front/src/index.css` el violeta `#5350cc`, hover
`#403cd5`, fondo `#f7f7f8`, superficie secundaria `#f1f2f3`, texto `#17191c`,
texto secundario `#62666d`, borde `#e1e3e6`, foco `#007fbd` y color de serie
`#02889a`. Los límites de los inputs conservan su contraste reforzado.
El modo oscuro mantiene sus superficies Linear, primario `#e4f222`, texto de
botones `#08090a` y logo `#e5e5e6` con letras `#08090a`.

Las acciones primarias comparten `--primary`, `--primary-foreground` y
`--primary-hover`. BrandLogo usa sus dos tokens independientes. Los acentos
activos de navegación y pestañas vuelven a violeta en claro, conservando los
neutrales de oscuro. Error, advertencia, éxito y estados clínicos/financieros
mantienen sus tokens sin cambios.

Se actualizaron las expectativas de las cinco pruebas existentes:
`front/tests/auth-ui.spec.ts`, `front/tests/design-system.spec.ts`,
`front/tests/global-design-system.spec.ts`, `front/tests/global-interactions.spec.ts`
y `front/tests/profile-integration.spec.ts`. No se crearon pruebas duplicadas.
La matriz ahora comprueba también fondo y texto de cada botón primario visible
en los once anchos. El acceso comprueba ambos colores de hover.

La captura `front/scripts/capture-premium-design.mjs` ahora espera los datos y
la geometría final de las barras de Recharts para evitar imágenes del gráfico
durante su animación. Este ajuste solo afecta al generador de capturas.

La comparación SHA-256 registra **163 archivos de `src` fuera de `src/styles`
sin cambios**, respecto al inicio de esta corrección. La copia del estado inicial
está en `test-results/color-theme-before/working-files.json`, junto con el
diff y estado de Git. Las modificaciones adicionales son las pruebas
indicadas, el generador de capturas y este informe. No se hicieron commits.
