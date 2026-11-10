# Arquitectura CSS de ClinicApp

La implementación aprobada es la referencia visual. Esta organización conserva
los colores, medidas, estados y breakpoints; no constituye un nuevo diseño.

## Organización y carga

`src/main.tsx` importa únicamente `src/index.css` como entrada global. El orden
es deliberado: Tailwind, animaciones, Shadcn, Inter, tokens, temas, composición de
la aplicación, integración Tailwind y base. No cambiarlo sin comparar la cascada.

| Responsabilidad | Ubicación |
| --- | --- |
| Paleta, fuente, espaciado y radios compartidos | `src/styles/tokens.css` |
| Funciones semánticas y variantes clara/oscura | `src/styles/themes.css` |
| `@theme inline` y variante dark de Tailwind 4 | `src/styles/tailwind.css` |
| Base existente y movimiento reducido | `src/styles/base.css` |
| Composición de estilos de aplicación | `src/styles/app.css` |
| Shell, sidebar, header y acciones de PageHeader | `src/app/layout/app-layout.css` |
| Controles comunes y widgets de aplicación | `src/styles/components.css` |
| Marca compartida con aislamiento local | `src/shared/components/brand-logo.module.css` |
| Listado de pacientes | `src/modules/patients/patients.css` |
| Acceso público | `src/modules/auth/auth.css` |
| React Big Calendar | `src/modules/appointments/appointments-calendar.css` |
| Gráficos Recharts compartidos | `src/styles/integrations/recharts.css` |
| Herramientas clínicas en su documento separado | `src/modules/clinical-history/embed/odontogram-theme.css` |

La composición de aplicación carga layout, controles compartidos, pacientes y
Recharts. Los estilos de acceso y calendario conservan sus imports existentes
en React. No se desplazaron imports de terceros. El odontograma mantiene su
entrada HTML y su cadena de estilos independientes.

Los estilos sin capa conservan esa prioridad. La capa `base` existente permanece
como estaba: no se envolvieron todas las reglas en una nueva capa. Los selectores
de pacientes tienen su prefijo propio y permanecen intactos. No se añadieron
resets ni selectores generales para SVG o herramientas clínicas.

## Mecanismo adecuado para cada cambio

- Usar Tailwind para composición de layout y responsive, como hasta ahora.
- Reutilizar los componentes de `src/components/ui` y `src/shared/components`.
  Sus variantes y clases siguen siendo su contrato visual.
- Usar variables semánticas para colores y medidas compartidos. Consultar
  consumidores antes de añadir, eliminar o renombrar un token.
- Usar CSS Module cuando el aislamiento de un componente aporte valor real.
  Un estilo simple ya resuelto con Tailwind no necesita otro archivo.
- Mantener los overrides de terceros cerca de su integración y con selectores
  propios de la librería. No generalizarlos a tablas o botones de toda la app.
- Mantener los estilos inline que dependen de datos, mediciones, colores de
  usuario o posicionamiento controlado por una librería.

BrandLogo es el ejemplo de CSS Module: importa su hoja local y conserva las
clases públicas `clinic-brand-mark` y `clinic-institution-mark` como hooks de
compatibilidad. Las reglas propias usan las clases aisladas del módulo. No
necesita `@reference`, porque utiliza CSS nativo y custom properties. Si un nuevo
módulo usa `@apply` con utilidades del tema, referenciar la entrada de estilos
con `@reference` y una ruta relativa correcta; no importar Tailwind nuevamente.

## Temas y marca

next-themes sigue controlando la clase del elemento raíz. No crear otro provider
ni otra preferencia visual. `themes.css` conserva el primario violeta de claro,
Acid Lime de oscuro, sus foregrounds y todos los estados semánticos existentes.
La paleta de referencia en `tokens.css` no se aplica por sí sola a una página.

Logo y botón comparten `--primary` y `--primary-foreground`. Los aliases del logo
apuntan a esos tokens. La identidad institucional y los colores de usuario
permanecen independientes: no vincularlos al primario porque coincidan hoy.

Los cuatro archivos Linear originales son documentación de referencia. No
importar `variables.css` o `theme.css` de Downloads sobre la implementación actual.

## Reutilización

| Necesidad | Procedimiento |
| --- | --- |
| Botón nuevo | Usar Button y su variante existente; conservar etiquetas, estados y foco. |
| Tarjeta | Usar Card y sus secciones; componer la distribución con utilidades existentes. |
| Formulario | Reutilizar Field, Input, Select y errores; no duplicar validaciones ni sustituir estados. |
| Tabla especializada | Reutilizar Table o DataTable según su contrato; mantener formatos y acciones en una definición compartida. |
| CSS Module | Ubicarlo junto al componente; importar sus clases; comprobar consumidores de hooks públicos antes de cambiarlos. |
| Variante responsive | Respetar los breakpoints y container queries actuales; verificar ancho real y navegación. |
| Token compartido | Confirmar una responsabilidad común; definir el valor una vez y, si procede, su override de tema. |

Cartera activa conserva su componente local, sus tarjetas y su container query
de 59rem. No forzar en ella el breakpoint genérico de DataTable. Tampoco unificar
media queries parecidas de otros componentes: sus límites actuales son parte
de la experiencia aprobada.

## Protección clínica y verificación

El CSS del odontograma, motor, SVG, hitboxes, numeración y matriz periodontal no
se reorganiza junto al CSS general. Tampoco sus estilos de exportación. No
añadir reglas globales sobre `svg`, `path`, `rect` o celdas clínicas.

Antes de reorganizar estilos, guardar referencias en ambos temas. Comparar
estilos calculados, geometría, hover/focus/disabled y capturas; un build por sí
solo no demuestra equivalencia. Verificar menús y portales, sidebar abierto y
cerrado, formularios, calendarios y anchos entre 320 y 1920 px.

Herramientas reproducibles desde `front`:

```powershell
node scripts/capture-css-architecture.mjs before
# Realizar un ajuste estructural pequeño.
node scripts/capture-css-architecture.mjs after
node scripts/compare-css-architecture.mjs after
npm.cmd run build
npm.cmd run lint
$env:CLINIC_TEST_URL = 'http://localhost:5173'
npm.cmd run test:e2e -- --workers=2
```

La comparación automatizada tiene un reloj fijo, once anchos, ambos temas y
estados representativos. No sustituye una auditoría completa de accesibilidad
ni la revisión en dispositivos físicos. Conservar los avisos previos como tales;
no ampliar el alcance funcional para corregirlos durante una reorganización CSS.
