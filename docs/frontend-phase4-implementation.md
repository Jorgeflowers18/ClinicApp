# ClinicApp — Fase 4: composición, densidad y controles de tema

Solicitud: 12 de noviembre de 2026. Continúa sobre el trabajo local existente, sin descartarlo ni realizar commits.

## Auditoría previa

Se revisaron las tres guías/informes de la fase anterior, los tokens, referencias de diseño, componentes compartidos y rutas reales. Se guardó el estado inicial de Git y hashes/código fuente en `front/test-results/phase4/` para verificar el alcance.

| Hallazgo | Acción prevista | Límites |
| --- | --- | --- |
| Los KPI compartidos mantienen una altura mínima de 104 px. | Altura natural; label y valor con separación corta; icono alineado arriba. | Conservar valor, hint, estado de carga y callbacks. |
| Finanzas divide cuatro indicadores entre CardHeader y CardContent, acumulando gaps. | Reutilizar el KPI con la etiqueta y el importe en el mismo grupo. | Conservar las cuatro fórmulas y `formatCurrency` sin cambios. |
| El ejemplo «Gasto del mes» no existe como indicador en este checkout. | Aplicar el patrón a Cobrado este mes, Total pendiente, Total vencido y Seguros pendientes. | No inventar un gasto, consulta o dato nuevo. |
| Cartera móvil coloca etiquetas y cifras en extremos de una fila. | Agrupar cada label con su valor en campos compactos, conservando los nueve datos. | Misma lista de columnas, valores y formateadores. |
| La cartera de escritorio no identifica las columnas monetarias para su alineación. | Alineación numérica y cifras tabulares con atributos locales de columna. | No cambiar formatos regionales ni estados. |
| Los iconos informativos usan el mismo tono neutro. | Tonos semánticos discretos para información, éxito, riesgo y error según su función real. | No inferir estados clínicos nuevos ni cambiar el significado de badges. |
| El indicador del Sidebar hereda un tono claro en oscuro. | Línea fina del primario del tema solo en el enlace que React Router ya marca activo. | Rutas, selección, anchos, iconos y estructura intactos. |
| El cambio de tema es una acción con etiqueta de destino. | Switch real «Modo oscuro», controlado por `isDarkTheme` y el callback actual. | Sin estado local de tema ni cambio de persistencia. |
| Campos numéricos y algunas tablas administrativas conservan medidas más amplias. | Limitar inputs cortos en escritorio y aplicar densidad a tablas administrativas. | No modificar formularios clínicos especializados. |

Las herramientas del calendario, nueve secciones clínicas más Evolución periodontal adicional, Notificaciones, tablas móviles y paginación se conservan. La única intervención del Sidebar será el indicador activo y el nuevo control de tema; Header, Login y navegación permanecen fuera del rediseño.

## Composición de tarjetas y Finanzas

`KpiCard` utiliza un grid de contenido e icono alineados arriba. El label, valor y ayuda forman un grupo continuo; no se distribuyen con `justify-between`. Se eliminó la altura mínima anterior de 104 px y se permite que cada tarjeta tenga la altura de su contenido, incluso dentro de un grid. Las tarjetas con ayudas reales pueden ser más altas que las que solo contienen un valor.

Medidas: padding vertical de 14 px y horizontal de 16 px; separación label/valor de 4 px; valores numéricos de 24 px y textuales de 21 px; iconos de 20 px en superficies de 32 px. No se alteró el formateo regional. En las pruebas a 1440 px, las cuatro tarjetas financieras midieron **80,98 px** y el espacio entre label y valor fue **4 px**, en ambos temas.

Finanzas reutiliza la misma composición. El símbolo y la cifra son un único texto generado por el `formatCurrency` original, sin separar el símbolo en otro contenedor. Las cuatro fórmulas permanecen idénticas. Los importes de demostración comprobados fueron `$100,00`, `$95,00`, `$0,00` y el contador `1`; la implementación no sustituye valores reales por estos ejemplos.

En cartera móvil, cada campo agrupa su etiqueta encima de su valor. Los campos breves comparten dos columnas; el tratamiento conserva una fila completa. Permanecen paciente, tratamiento, total, pagado, pendiente, vencido, próximo vencimiento, días de mora y estado. En escritorio se alinearon las columnas monetarias y numéricas, manteniendo formateadores, orden y datos.

El Panel conserva dos columnas en laptops con menor espacio de contenido y cuatro a partir de `xl`, evitando comprimir etiquetas por mantener cuatro columnas. Reportes y los resúmenes clínicos heredan la composición natural del KPI. No se redujo el área operativa del calendario ni del odontograma.

## Iconografía, tablas, formularios y menús

Los tonos del icono se consumen desde tokens existentes: información para resúmenes generales, éxito para Cobrado/Completadas, advertencia para Insumos bajo mínimo y error para Total vencido/No asistió. Son señales de la categoría del indicador; no se añaden reglas ni estados derivados. Valores y tarjetas conservan superficies neutras. No se agregaron iconos dentro del editor clínico.

Las tablas administrativas comparten encabezados de 42 px, texto de 13 px y cifras tabulares; la cartera identifica sus columnas para alinear importes. Los nombres principales y badges mantienen su jerarquía y significado. Se conservan acciones, menús de tres puntos, datos móviles y la paginación condicional anterior.

Los inputs numéricos de formularios administrativos tienen máximo de 14 rem en escritorio, respetando los anchos menores de cada formulario; en móvil mantienen sus medidas adaptativas y áreas táctiles. No se alteraron nombres, tipos, valores, errores o validaciones. Los menús existentes ya utilizaban filas de 38 px en escritorio y 44 px en móvil, altura natural y scroll acotado; se conservaron, incluido «Ver secciones».

## Dos cambios autorizados del Sidebar

1. **Indicador activo:** línea lateral de 3 px y acento de icono exclusivamente en `.clinic-sidebar-link[aria-current="page"]`. Consume `--primary`: violeta en claro y Acid Lime en oscuro. La selección sigue perteneciendo a React Router. Se mantiene visible en la presentación contraída.
2. **Switch de Modo oscuro:** reemplaza únicamente la presentación de la antigua acción. Usa el componente Switch existente, `checked={isDarkTheme}` y el callback anterior `onToggleTheme`. No introduce `useState` de tema ni cambia `setTheme` o su persistencia. La etiqueta siempre es «Modo oscuro». OFF presenta track neutro; ON usa el primario oscuro Acid Lime y el thumb correspondiente. El objetivo interactivo mide 44 × 44 px; el track visual mide 32 × 18 px. Funciona con ratón y Espacio y conserva tooltip al contraer.

Se conservan anchos de 256/72 px, posición, enlaces, permisos, submenús existentes, expansión, animación, cierre de sesión y demás opciones. Se preservó también el espacio de línea que ocupaba la acción anterior para que los enlaces de perfil y salida no cambiaran de posición. Header y Login permanecen intactos.

## Archivos de esta fase

Rutas relativas al repositorio:

| Archivo | Propósito |
| --- | --- |
| `front/src/modules/reports/components/kpi-card.tsx` | Composición natural reutilizable y tono semántico del icono. |
| `front/src/modules/finance/pages/finance-page.tsx` | Reutilización de KPI sin modificar cálculos. |
| `front/src/modules/finance/components/active-portfolio.tsx` | Agrupación de campos móviles y alineación numérica de escritorio. |
| `front/src/app/pages/dashboard-page.tsx` | Grid que respeta el ancho disponible y señal de stock. |
| `front/src/modules/reports/components/agenda-report-tab.tsx` | Tonos de iconos de Completadas y No asistió. |
| `front/src/styles/content-ui.css` | Elimina el mínimo de KPI, define tonos locales, densidad administrativa y campos numéricos. |
| `front/src/app/layout/app-layout.css` | Solo modifica el indicador activo y el color de su icono. |
| `front/src/app/layout/app-layout.tsx` | Solo sustituye la presentación del control de tema e importa el componente. |
| `front/src/app/layout/sidebar-theme-switch.tsx` y `.module.css` | Nuevo componente local que reutiliza Switch y sus estilos aislados. |
| `front/tests/phase4-density.spec.ts` | Seis pruebas nuevas de composición, datos y Sidebar/Switch en ambos temas. |
| `front/tests/content-ui.spec.ts` | Comprueba proximidad label/valor en lugar del mínimo anterior de 104 px. |
| `front/tests/administrative-responsive.spec.ts`, `auth-ui.spec.ts`, `clinical-navigation-integration.spec.ts`, `dental-history.spec.ts`, `design-system.spec.ts`, `frontend-redesign.spec.ts`, `global-interactions.spec.ts`, `profile-integration.spec.ts` | Actualizan la interacción con el control real `role="switch"`, manteniendo las comprobaciones anteriores. |
| `docs/frontend-redesign-guidelines.md`, `frontend-ui-ux-audit.md` y este informe | Patrones vigentes, cierre de auditoría y evidencia de Fase 4. |

El resto de los cambios que muestra Git ya pertenecía a las fases anteriores. No se descartaron ni se atribuyen de nuevo a esta fase.

## Responsive y conservación funcional

Las seis pruebas nuevas recorren ambos temas y 320, 360, 375, 390, 430, 600, 768, 1024, 1280, 1440 y 1920 px. Comprueban KPI en Panel, Finanzas, Reportes e Historia clínica; no hay texto que desborde sus tarjetas, los valores siguen a 4–8 px del label y no quedan reservas vacías de altura. Se verifican los nueve campos financieros y sus importes.

El Sidebar se prueba abierto/cerrado y contraído, con un único enlace activo, indicador del color correcto, track ON/OFF, control de 44 px, Espacio, cambio único de estado, recarga y rutas de módulos/perfil. La suite anterior conserva la matriz de 18 pantallas, orientaciones, tacto, diálogos, menús y zoom CSS del 200 %.

Se compararon los 229 archivos iniciales: 212 permanecen idénticos y no hay eliminaciones. Todos los archivos de Citas, su selector de fechas, Historia clínica, Notificaciones, Login, primitivas UI, APIs, tipos, stores y tokens protegidos conservan sus hashes. Las cuatro fórmulas financieras, la definición de las nueve columnas y los handlers de layout/navegación comparados permanecen iguales.

La comparación de `SidebarContent` demuestra que solo cambió el bloque de la acción de tema. La comparación de su CSS demuestra que solo cambió el indicador activo y su icono. Los 12 snapshots de Login/Header/Sidebar no muestran diferencias de estilos o geometría en los elementos restantes, excluyendo únicamente el nuevo control de tema y su input/label. Las cuatro capturas de Login son idénticas por SHA-256. Los indicadores nuevos se verifican en las pruebas específicas.

## Validación real

- Pruebas dirigidas: **24/24 aprobadas en 50,4 segundos**, incluyendo las seis nuevas y las 18 de contenido existentes.
- Suite completa: **143/143 aprobadas en 6,7 minutos**, sin fallos ni reintentos. Incluye calendario y fechas lejanas, guardado clínico, diagnósticos, periodontograma, exportaciones, perfiles, permisos, tablas, temas y las seis pruebas nuevas. La ejecución dirigida se solapa con esta suite; no se suma como casos distintos.
- `npm.cmd run build`: correcto, TypeScript y Vite incluidos. Se conserva el aviso anterior de chunks mayores de 500 kB.
- `npm.cmd run lint`: correcto, sin errores ni advertencias nuevas; permanecen cinco avisos previos de Fast Refresh/RHF.
- `git diff --check`: correcto; Git informa de la normalización LF/CRLF de archivos existentes.

Comandos ejecutados desde `front/`:

```powershell
npm.cmd run build
npm.cmd run lint
git diff --check
$env:CLINIC_TEST_URL='http://localhost:5173'
$env:PLAYWRIGHT_JSON_OUTPUT_FILE='test-results/phase4/targeted.json'
npm.cmd run test:e2e -- tests/phase4-density.spec.ts tests/content-ui.spec.ts --workers=2 --output=test-results/phase4/targeted --reporter=line,json --max-failures=4
$env:PLAYWRIGHT_JSON_OUTPUT_FILE='test-results/phase4/full-suite.json'
npm.cmd run test:e2e -- --workers=2 --output=test-results/phase4/full-suite --reporter=line,json --max-failures=5
```

Las evidencias están en `front/test-results/phase4/`, ignorado por Git: hashes, código previo, estado inicial de Git, informes JSON, medidas adjuntas de tarjetas, capturas `before/`/`after/` y verificaciones de alcance. Las capturas y pruebas dirigidas fijan el reloj en noviembre de 2026 para comparar los mismos ejemplos; no cambian la fecha de la aplicación real.

## Límites y Git

Las verificaciones usan Chrome/Playwright y los datos mock existentes. No sustituyen una certificación de accesibilidad, revisión manual con lectores de pantalla, dispositivos físicos o backend real. El zoom verificado es CSS. Las limitaciones originales de persistencia y borradores se conservan.

No se inventó «Gasto del mes» ni se corrigieron posibles diferencias entre nombres de indicadores y sus reglas existentes: esa lógica quedó fuera del cambio visual autorizado. No se introdujeron endpoints, datos, dependencias ni cambios clínicos.

Rama local `main`, HEAD `205fec7e5b4b1d4ab1b8a490fa6bc1ea06e8b3b0`. Sin commits, pushes, resets ni cambios de rama. El resultado permanece en **http://localhost:5173**.
