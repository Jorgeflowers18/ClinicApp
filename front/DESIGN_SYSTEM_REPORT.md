# ClinicApp · Estandarización global Linear

> Informe de la fase anterior. El prompt posterior sustituye la marca violeta
> por el logo adaptativo e integra Mi perfil al layout. El estado vigente y sus
> verificaciones están en [DESIGN_SYSTEM_PREMIUM_REPORT.md](DESIGN_SYSTEM_PREMIUM_REPORT.md).

Implementación realizada exclusivamente dentro de `ClinicApp-main/front`.
Se utilizaron `DESIGN.md`, `tokens.json`, `variables.css` y `theme.css` de
`C:/Users/Josue/Downloads` como referencias. Sus instrucciones de composición se
adaptaron a la aplicación existente y a las restricciones del prompt.

## 1. Archivos de esta fase

Las siguientes rutas son relativas a `ClinicApp-main`:

| Archivo | Cambio |
| --- | --- |
| `front/src/styles/tokens.css` | Nueva fuente de tokens y alias compatibles con los módulos existentes. |
| `front/src/styles/app.css` | Navegación, tablas, menús, superficies, gráficos y estados compartidos. |
| `front/src/index.css` | Integra los tokens y elimina colores y reglas duplicadas por rutas. |
| `front/src/app/layout/app-layout.tsx` | Menú móvil mediante el Sheet existente; header con nombre y rol; marca violeta. |
| `front/src/components/ui/button.tsx` | Variantes coherentes, acciones primarias, estados inactivos y transiciones de color. |
| `front/src/components/ui/card.tsx` | Superficie, borde, radio y sombra común. |
| `front/src/components/ui/input.tsx` | Superficie semántica y borde de campo. |
| `front/src/components/ui/textarea.tsx` | Superficie semántica y fuente móvil de 16 px. |
| `front/src/components/ui/select.tsx` | Controles fluidos, opciones que envuelven texto y popup contenido. |
| `front/src/components/ui/table.tsx` | Región de desplazamiento accesible por teclado. |
| `front/src/components/ui/dialog.tsx` | Ancho adaptable, cierre en español y acciones que se reorganizan. |
| `front/src/components/ui/alert-dialog.tsx` | Overlay compartido. |
| `front/src/components/ui/sheet.tsx` | Overlay y cierre en español. |
| `front/src/components/ui/calendar.tsx` | DatePicker que conserva las siete columnas a 320 px. |
| `front/src/components/ui/adaptive-tabs.tsx` | Objetivos táctiles mayores y conservación del menú «Más». |
| `front/src/components/ui/alert.tsx` | Colores semánticos de información y error. |
| `front/src/components/ui/badge.tsx` | Estilo neutral que reserva Acid Lime para acciones principales. |
| `front/src/shared/components/page-header.tsx` | Títulos, jerarquía y acciones que se reorganizan. |
| `front/src/modules/auth/auth.css` | Hereda tokens globales, conserva CA violeta y limita la tarjeta a 440 px. |
| `front/src/modules/auth/pages/user-profile-page.tsx` | Etiquetas asociadas, carga de foto accesible y distribución adaptable. |
| `front/src/modules/institution/pages/institution-profile-page.tsx` | Etiquetas de campos y sedes, carga de imagen y marca violeta. |
| `front/src/modules/appointments/pages/appointments-calendar-page.tsx` | Conserva la vista seleccionada entre tamaños; Mes/Semana/Día disponibles en compacto. |
| `front/src/modules/appointments/appointments-calendar.css` | Eventos legibles, estados semánticos y calendario con desplazamiento propio. |
| `front/src/modules/reports/components/agenda-report-tab.tsx` | Colores de series y tooltip acordes al tema. |
| `front/src/modules/reports/components/productivity-report-tab.tsx` | Color de serie y tooltip acordes al tema. |
| `front/tests/auth-ui.spec.ts` | Amplía la verificación de acceso a los once anchos. |
| `front/tests/design-system.spec.ts` | Expectativas de la nueva paleta global. |
| `front/tests/global-design-system.spec.ts` | Matriz de 18 pantallas, ambos temas, etiquetas, controles y contraste. |
| `front/tests/global-interactions.spec.ts` | Menús, foco, calendario, filtros, diálogos, pestañas, orientación y zoom CSS. |
| `front/scripts/capture-design-system.mjs` | Capturas reproducibles con datos, fuentes y layout estabilizados. |
| `front/scripts/compare-design-system.mjs` | Generador de la comparación visual interactiva. |
| `front/DESIGN_SYSTEM_REPORT.md` | Este informe. |

No se cambiaron archivos de backend ni dependencias.

## 2. Design System

`tokens.css` concentra los valores de referencia y sus funciones semánticas:
superficies, texto, acciones, información, éxito, advertencia, error, bordes,
foco, gráficos, espaciado y radios. Tailwind utiliza esos mismos valores mediante
la integración `@theme inline` existente. Los archivos de referencia no se
importan por duplicado.

Se mantiene Inter Variable con una escala basada en 4 px, controles de radio
6 px y tarjetas de radio 12 px. La marca CA conserva el violeta original
`#5350cc`, independiente de la acción primaria y del tema. Las imágenes de marca
y los colores personales de avatar configurados por el usuario se conservan.

Las tablas siguen mostrando sus datos y acciones: reutilizan sus tarjetas
móviles o su región de desplazamiento. No se eliminaron columnas para ganar
espacio. Las pestañas que no caben siguen disponibles mediante «Más».

## 3. Temas

| Función | Claro | Oscuro |
| --- | --- | --- |
| Fondo | `#f5f6f8` | Void `#08090a` |
| Header, sidebar y tarjetas | `#ffffff` | Carbon `#0f1011` |
| Superficie secundaria | `#f9fafb` | Obsidian `#161718` |
| Texto | `#161718` | `#ffffff` |
| Texto secundario | `#59616b` | Mist `#d0d6e0` |
| Acción primaria | `#161718`, texto blanco | Acid Lime `#e4f222`, texto Void |
| Marca CA | Violeta original | Violeta original |
| Foco | Iris Violet `#6366f1` | Iris Violet `#6366f1` |

Los bordes de campos tienen más contraste que los bordes decorativos. Las
acciones secundarias permanecen neutrales y los estados conservan su significado.
Los gráficos utilizan series diferenciadas, sin pintar todo con Acid Lime.

Se reutiliza next-themes y su preferencia persistente existente. El login y el
sidebar siguen sincronizados. La estructura y las dimensiones comprobadas no
cambian al alternar entre claro y oscuro.

## 4. Responsive realmente verificado

Anchos comprobados en ambas apariencias: **320, 360, 375, 390, 430, 600, 768,
1024, 1280, 1440 y 1920 px**.

En la tabla, **A** significa verificación automatizada de los once anchos,
ausencia de desbordamiento global, controles sin recorte, etiquetas de entradas
y contraste del texto de controles activos, tablas y navegación.

| Módulo o pantalla | Móvil | Tablet | Escritorio | Claro | Oscuro | Verificación realizada | Pendientes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Panel | Sí | Sí | Sí | Sí | Sí | A; gráfico y comparativas visuales | Dispositivo físico¹ |
| Pacientes | Sí | Sí | Sí | Sí | Sí | A; búsqueda, filas, tarjetas y acciones con teclado | Dispositivo físico¹ |
| Formulario de paciente | Sí | Sí | Sí | Sí | Sí | A; campos y acciones | Dispositivo físico¹ |
| Detalle de paciente | Sí | Sí | Sí | Sí | Sí | A; pestañas adaptativas | Dispositivo físico¹ |
| Citas | Sí | Sí | Sí | Sí | Sí | A; Mes/Semana/Día, filtros, selector de fecha y diálogos | Dispositivo físico¹ |
| Historial clínico | Sí | Sí | Sí | Sí | Sí | A; listado y filtros externos | Dispositivo físico¹ |
| Historia del paciente | Sí | Sí | Sí | Sí | Sí | A; motor, visitas, diagnósticos, medidas y exportaciones | Dispositivo físico¹ |
| Tratamientos | Sí | Sí | Sí | Sí | Sí | A; listado y acciones | Dispositivo físico¹ |
| Formulario de tratamiento | Sí | Sí | Sí | Sí | Sí | A; campos y acciones | Dispositivo físico¹ |
| Detalle de tratamiento | Sí | Sí | Sí | Sí | Sí | A; tarjetas y datos | Dispositivo físico¹ |
| Inventario | Sí | Sí | Sí | Sí | Sí | A; cinco secciones accesibles por pestañas o menú | Dispositivo físico¹ |
| Formulario de insumo | Sí | Sí | Sí | Sí | Sí | A; campos y acciones | Dispositivo físico¹ |
| Detalle de insumo | Sí | Sí | Sí | Sí | Sí | A; datos y acciones | Dispositivo físico¹ |
| Notificaciones | Sí | Sí | Sí | Sí | Sí | A; editor, controles y tablas existentes | Dispositivo físico¹ |
| Finanzas | Sí | Sí | Sí | Sí | Sí | A; nueve columnas de cartera y desplazamiento por teclado | Dispositivo físico¹ |
| Reportes | Sí | Sí | Sí | Sí | Sí | A; cuatro secciones, gráficos y comparativas | Dispositivo físico¹ |
| Perfil del usuario | Sí | Sí | Sí | Sí | Sí | A; etiquetas, avatar y campos | Dispositivo físico¹ |
| Perfil institucional | Sí | Sí | Sí | Sí | Sí | A; etiquetas, marca, campos y sedes | Dispositivo físico¹ |
| Login | Sí | Sí | Sí | Sí | Sí | Once anchos; contraseña, temas, navegación y autenticación mock | Recordarme pendiente |
| Recuperar contraseña | Sí | Sí | Sí | Sí | Sí | Once anchos; validación y retorno al login | Envío pendiente |
| Solicitar acceso | Sí | Sí | Sí | Sí | Sí | Once anchos; validación y retorno al login | Envío pendiente |

Son **396 combinaciones** para las 18 pantallas de la matriz y **66 combinaciones**
para las tres pantallas de acceso. Además se comprobaron:

- Sidebar expandido y contraído en escritorio, apertura y cierre móvil y retorno
  del foco después de Escape.
- Identidad de geometría del layout al alternar tema.
- Orientación horizontal de móvil a 844 × 390.
- Diálogos en 320 × 720, 360 × 800, 390 × 360, 600 × 900, 768 × 1024,
  1024 × 768, 1440 × 1000 y 1920 × 1080, conservando el texto introducido.
- Reducción de altura para simular el espacio disponible con teclado abierto.
- Zoom CSS del 200 % con encabezado y búsqueda utilizables.
- Movimiento reducido, foco, menú «Más», selector de fecha y filtros móviles.

¹ Las pruebas se ejecutaron en Chrome de escritorio con tamaños de viewport
controlados. La reducción de altura y el zoom CSS son simulaciones: no se declara
probado un teclado físico de iOS/Android ni el zoom de la interfaz del navegador
en un dispositivo real. También queda una revisión manual con lector de pantalla.

## 5. Componentes reutilizados

Se mejoraron los componentes compartidos existentes: Button, Card, Input,
Textarea, Select, Table, Dialog, AlertDialog, Sheet, Calendar, AdaptiveTabs,
Alert, Badge y PageHeader. Se conservan BrowserRouter, next-themes, React Big
Calendar, los gráficos Recharts y el motor clínico existente.

El menú móvil usa el mismo Sheet y las mismas opciones. El contenido principal
aprovecha el ancho completo cuando el menú está cerrado. El calendario compacto
deriva su presentación de la vista seleccionada y mantiene Mes/Semana/Día al
pasar entre móvil y escritorio. El mes conserva su propio desplazamiento.

## 6. Comandos y resultados

Desde `front`:

```powershell
npm.cmd run build
npm.cmd run lint
$env:CLINIC_TEST_URL = 'http://localhost:5173'
$env:PLAYWRIGHT_JSON_OUTPUT_FILE = 'test-results/linear-complete.json'
npm.cmd run test:e2e -- --output=test-results/linear-complete --reporter=line,json --max-failures=3
git diff --check
```

- **Build correcto**: TypeScript y Vite.
- **Lint sin errores**: seis avisos preexistentes de Fast Refresh y React Compiler.
- **68 pruebas aprobadas**, cero fallidas, cero omitidas y cero inestables en la
  ejecución integral; duración aproximada de 5 minutos y 26 segundos.
- `git diff --check` sin errores de whitespace.
- Verificación SHA-256 de **51 archivos protegidos**, sin diferencias respecto
  del inicio de esta fase. Incluye API, stores, tipos, lógica clínica, motor
  embebido, rutas y dependencias.

Los resultados estructurados están en `test-results/linear-complete.json`.
Las verificaciones se realizaron por grupos durante la implementación y luego
se ejecutó toda la suite.

## 7. Comparaciones visuales

Se guardaron **28 pares de capturas**, 56 imágenes en total: siete módulos,
dos temas y anchos de 390 y 1440 px. Las capturas esperan a que se carguen los
datos, la fuente Inter y la distribución responsive.

- [Comparador interactivo en localhost](http://localhost:5173/test-results/design-system-comparison.html)
- [Comparador HTML local](test-results/design-system-comparison.html)
- Antes: `test-results/design-system-before/`.
- Después: `test-results/design-system-after/`.

El estado anterior se capturó en una instancia local aislada con los archivos de
la revisión previa y las mismas dependencias. Esa instancia auxiliar se detuvo;
la aplicación de trabajo sigue activa en el puerto 5173. Las capturas usan los
datos mock y pueden mostrar la herramienta de desarrollo de TanStack, que solo
aparece en desarrollo.

Para futuras iteraciones, antes de editar se puede ejecutar:

```powershell
node scripts/capture-design-system.mjs before
# Realizar los cambios visuales.
node scripts/capture-design-system.mjs after
node scripts/compare-design-system.mjs
```

## 8. Funcionalidades preservadas

La suite existente comprobó autenticación, errores, perfil inicial, cierre de
sesión, búsquedas, navegación por teclado, permisos, rutas antiguas, creación y
cierre de visitas, relación con citas, guardado del odontograma, mediciones
periodontales, diagnósticos y exportaciones.

Las nuevas pruebas comprueban opciones de navegación, pestañas, filtros, cambios
de vista, diálogos, conservación de texto al redimensionar y foco. No se editaron
los archivos del motor clínico, SVG, coordenadas, hitboxes, cálculos ni estados
internos. Tampoco se cambiaron rutas, API, stores, schemas ni dependencias.

## 9. Pendientes y límites

- Revisión en dispositivos físicos, navegadores móviles y lector de pantalla,
  según la nota de la matriz.
- Vite mantiene el aviso de bundles superiores a 500 kB. No bloquea el build.
- Los seis avisos de lint ya existían y no se ampliaron para corregir lógica fuera
  del alcance visual.
- Recordarme, recuperación y solicitud continúan indicando su estado pendiente;
  no se habilitaron envíos ficticios.

No se observaron desbordamientos globales ni controles recortados en las
combinaciones verificadas.

## 10. Git y trabajo preexistente

No se crearon commits ni se hizo push. Las modificaciones de esta fase quedaron
limitadas a `front`. El informe de login en `documentacion/` ya existía y no se
editó en esta fase.

Al comenzar ya existían cambios del login en `index.html`, providers, rutas,
login-page, design-system y los nuevos archivos de acceso. Se conservaron sus
funciones. Los archivos de rutas, providers, HTML y lógica del login no se
modificaron en esta fase; el CSS de acceso y las expectativas visuales de sus
pruebas se adaptaron al sistema global solicitado.

Se guardó el diff inicial en
`test-results/design-system-before/working-tree.patch`, junto con las huellas de
los archivos protegidos. Los artefactos de prueba y comparación están ignorados
por Git. La reorganización previa del repositorio exterior se conserva.
