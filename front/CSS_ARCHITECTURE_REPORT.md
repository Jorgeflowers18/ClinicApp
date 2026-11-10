# ClinicApp · Refactorización de arquitectura CSS

Alcance: frontend de `ClinicApp-main/front`. Referencia: estado de trabajo
existente al recibir el prompt `99143ba2-2e32-468d-ba65-94cda92f51f1`.

## 1. Arquitectura inicial

Había seis hojas CSS propias: entrada global, tokens/temas unidos, `app.css`
con responsabilidades mezcladas, acceso, calendario y la integración clínica.
Los componentes ya utilizaban Tailwind 4 y variantes React compartidas. No había
CSS Modules. El calendario, acceso y odontograma ya estaban ubicados en sus
módulos y no necesitaban una migración.

El inventario registra reglas, imports, variables, capas, media/container queries
e `!important` en `test-results/css-architecture-before/inventory.json`. Los
estilos inline existentes responden a colores de usuario, mediciones de tabs,
dimensiones del calendario, progreso, gráficos y exportación; se conservaron.

## 2. Arquitectura resultante

La entrada global ahora compone fundamentos, temas y estilos de aplicación.
`app.css` contiene únicamente imports por responsabilidad. La marca utiliza un
CSS Module; los componentes con Tailwind y los módulos que ya estaban bien
organizados permanecen así. No se movieron componentes ni interfaces públicas.

Se aplicó primero el piloto de BrandLogo. Tras comprobar su equivalencia, se
extrajeron fundamentos, layout, controles comunes, pacientes y gráficos. Se
conservaron las **747 declaraciones CSS** propias, sus valores y condiciones.
La comparación de declaraciones normaliza únicamente los nombres aislados de
las dos clases del logo a sus nombres originales. No hubo altas o bajas de
declaraciones, cambios de media queries ni nuevos `!important`.

## 3. Árbol relevante

```text
src/index.css
src/styles/
  tokens.css
  themes.css
  tailwind.css
  base.css
  app.css
  components.css
  integrations/recharts.css
src/app/layout/app-layout.css
src/shared/components/
  brand-logo.tsx
  brand-logo.module.css
src/modules/
  patients/patients.css
  auth/auth.css                         (conservado)
  appointments/appointments-calendar.css (conservado)
  finance/components/active-portfolio.tsx (conservado)
  clinical-history/embed/odontogram-theme.css (conservado)
```

## 4. Archivos de esta entrega

Rutas relativas a `ClinicApp-main`:

| Archivo | Cambio |
| --- | --- |
| `front/src/index.css` | Entrada con los imports existentes de terceros y los archivos propios organizados. |
| `front/src/styles/tokens.css` | Paleta, fuente, espaciado y geometría; valores intactos. |
| `front/src/styles/themes.css` | Valores semánticos claros/oscuros trasladados sin cambios. |
| `front/src/styles/tailwind.css` | Variante dark y `@theme inline` existentes. |
| `front/src/styles/base.css` | Capa base y movimiento reducido existentes. |
| `front/src/styles/app.css` | Composición de layout, shared UI, pacientes e integración de gráficos. |
| `front/src/styles/components.css` | Tablas, tabs, popups, formularios de perfil y widgets compartidos. |
| `front/src/app/layout/app-layout.css` | Shell, header, sidebar y ajuste móvil de PageHeader. |
| `front/src/modules/patients/patients.css` | Reglas del listado, con sus selectores originales. |
| `front/src/styles/integrations/recharts.css` | Overrides existentes de ejes, leyendas, tooltips y contenedores. |
| `front/src/shared/components/brand-logo.module.css` | Aislamiento de las tres reglas existentes de marca. |
| `front/src/shared/components/brand-logo.tsx` | Importa el módulo; mantiene hooks, props, JSX y comportamiento salvo la clase aislada añadida. |
| `front/tests/global-interactions.spec.ts` | Espera a que el logo entre en viewport durante la animación de apertura del menú. |
| `front/scripts/capture-css-architecture.mjs` | Referencias de estilos calculados, geometría y capturas, con reloj fijo. |
| `front/scripts/compare-css-architecture.mjs` | Comparación de registros y píxeles; genera JSON y comparador HTML. |
| `front/docs/css-architecture.md` | Guía breve de organización y reutilización. |
| `front/CSS_ARCHITECTURE_REPORT.md` | Este informe. |

## 5. Tokens

Se separaron los valores de paleta/medidas de sus funciones por tema. No se
renombraron los tokens existentes ni se eliminaron aliases de compatibilidad.
Los valores duplicados con funciones distintas, como identidad institucional y
color de eventos, no se unificaron por coincidir hoy. Los consumidores conservan
las mismas variables y los registros calculados coinciden con la línea base.

## 6. Temas

Claro conserva primario y logo `#5350CC` con blanco, fondo `#F7F7F8` y superficies
blancas. Oscuro conserva Void, Carbon, Obsidian, Graphite y primario/logo
`#E4F222` con `#08090A`. Los dos aliases de marca siguen apuntando a `--primary`
y `--primary-foreground`. next-themes, persistencia y bootstrap no se cambiaron.

La separación mantiene los imports de proveedores en su orden original y la
capa base existente. No se creó una capa para todo el CSS. Los desplazamientos
de reglas dentro de la composición no introducen sobrescrituras de las mismas
propiedades sobre los mismos consumidores: las reglas de pacientes conservan
su especificidad y los overrides de gráficos mantienen sus selectores propios.

## 7. CSS Modules

Se utilizó únicamente en BrandLogo, piloto pequeño compartido entre acceso,
configuración, sidebar y vista previa de la marca. Las clases públicas se
conservan para consumidores y pruebas; la presentación queda aislada. El módulo
utiliza custom properties nativas y no necesita `@reference`. No se convirtieron
tablas, calendario, Cartera activa ni herramientas clínicas a CSS Modules.

## 8. Componentes compartidos

Button, Card, Input, Select, Dialog, Table, DataTable, Badge, AdaptiveTabs,
PageHeader y sus variantes permanecen intactos. Sus estilos utilitarios siguen
en React. La hoja de controles agrupa únicamente las reglas cruzadas existentes,
incluidos foco de upload, notices y el contenedor de configuración inicial.

## 9. Librerías y áreas protegidas

Se conservaron React Big Calendar y su CSS local; Recharts conserva los mismos
overrides en una ubicación identificable. Los popups siguen usando selectores
globales de `data-slot` para alcanzar portales fuera del árbol del layout.

No se editaron motor clínico, iframe, SVG, hitboxes, colores clínicos, matriz,
exportaciones, API, stores, rutas, formularios ni cálculos. La entrada clínica
sigue importando su librería, Inter y su hoja local. El CSS compilado del
odontograma conserva el mismo nombre/hash y **69.039 bytes**.

## 10. Responsive

Se verifican ambos temas en **320, 360, 375, 390, 430, 600, 768, 1024, 1280,
1440 y 1920 px**. Las referencias calculadas cubren Login, Recuperar contraseña,
Solicitar acceso, Configuración inicial, Panel, Pacientes, Citas, Finanzas y
Cartera activa, Mi perfil, Perfil institucional e Historia del paciente.
Se añaden hover/focus de acceso y diálogos de citas a 390, 768 y 1440 px.

Las pruebas existentes también recorren otros formularios y detalles, menús
abiertos/cerrados, sidebar de escritorio, orientación horizontal, altura reducida,
zoom CSS y movimiento reducido. Cartera activa conserva sus tarjetas, sus nueve
campos y su adaptación al ancho real cuando cambia el sidebar.

## 11. Equivalencia visual

Piloto y resultado final: **252 registros calculados sin diferencias** y
**44 pares de capturas sin diferencias de píxeles** en cada comparación. Los
registros incluyen colores/tokens, fuentes, dimensiones, posiciones, espaciado,
bordes, sombras, overflow y foco. La geometría se registra a tres decimales.
Las capturas usan un reloj fijo y esperan fuentes, datos y animaciones finitas.

- [Comparador final en localhost](http://localhost:5173/test-results/css-architecture-comparison.html).
- Resultado final: `test-results/css-architecture-after-comparison.json`.
- Piloto: `test-results/css-architecture-pilot-comparison.json`.
- Declaraciones y tamaños: `test-results/css-architecture-after/source-equivalence.json`.

La hoja de aplicación pasó de **125.806 a 125.800 bytes** en la medición del build
posterior a la reorganización; el CSS clínico no cambió. Es una diferencia de
empaquetado, no una optimización de rendimiento que se pueda extrapolar.

## 12. Pruebas y comandos

```powershell
npm.cmd run build
npm.cmd run lint
$env:CLINIC_TEST_URL = 'http://localhost:5173'
$env:PLAYWRIGHT_JSON_OUTPUT_FILE = 'test-results/css-architecture-baseline.json'
npm.cmd run test:e2e -- --workers=2 --output=test-results/css-architecture-baseline --reporter=line,json --max-failures=3
node scripts/capture-css-architecture.mjs before
# Piloto de marca, después reorganización de fundamentos/composición.
node scripts/capture-css-architecture.mjs pilot
node scripts/compare-css-architecture.mjs pilot
node scripts/capture-css-architecture.mjs after
node scripts/compare-css-architecture.mjs after
$env:PLAYWRIGHT_JSON_OUTPUT_FILE = 'test-results/css-architecture-final.json'
npm.cmd run test:e2e -- --workers=2 --output=test-results/css-architecture-final --reporter=line,json --max-failures=3
git diff --check
```

- Build inicial y posterior: correctos.
- Lint: sin errores; seis avisos preexistentes.
- Línea base: 77 de 78 casos aprobaron inicialmente. Un caso midió el logo antes
  de terminar su entrada animada; se corrigió la espera de la prueba, sin tocar
  la animación, y los dos casos de sidebar aprobaron al repetirse. Registros en
  `css-architecture-baseline.json` y `css-architecture-baseline-sidebar.json`.
- Suite final: **78 pruebas aprobadas**, cero fallidas, omitidas o inestables;
  aproximadamente 3 minutos y 50 segundos. Registro:
  `test-results/css-architecture-final.json`.
- `git diff --check`: sin errores de whitespace.

## 13. Límites y riesgos pendientes

La comparación cubre estados y pantallas representativos en Chrome con viewports
controlados. No demuestra todos los estados posibles ni equivale a una auditoría
WCAG completa. Quedan pendientes dispositivos físicos, otros navegadores y lector
de pantalla. No se alteró el sistema para compensar esas limitaciones.

Persisten los avisos anteriores de React Compiler/Fast Refresh y de chunks Vite
superiores a 500 kB. No se introdujeron dependencias ni se modificó su configuración.

## 14. Git

Los cambios previos del usuario permanecen. Se guardaron el estado inicial,
huellas SHA-256, CSS originales y diff en `test-results/css-architecture-before`.
La lista de la sección 4 identifica esta entrega; las modificaciones anteriores
del login, temas, layout, responsive y cartera siguen presentes en el árbol.
Se comprobaron **162 archivos fuente existentes sin diferencias**; solo
cambiaron las tres hojas globales indicadas y el enlace de clases de BrandLogo.
El registro está en `test-results/css-architecture-after/protected-source.json`.
No se crearon commits ni se modificaron archivos fuera del frontend.

## 15. Guía de reutilización

[docs/css-architecture.md](docs/css-architecture.md) explica dónde ubicar estilos,
cómo elegir Tailwind/CSS Module, reutilizar botones, tarjetas y formularios,
crear tablas específicas, mantener container queries y definir tokens sin
duplicar temas ni afectar la identidad institucional o la representación clínica.
