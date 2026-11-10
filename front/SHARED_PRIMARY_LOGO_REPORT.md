# ClinicApp · Logo y botones con un primario compartido

Implementación del prompt `bc486340-5f9c-44d8-bd46-366406ecc94c`, limitada a
`ClinicApp-main/front`. Sustituye la variante neutra del logo oscuro aprobada
en el prompt anterior. Los botones conservan sus estilos actuales.

## Fuente de verdad

El color primario se define en `src/styles/tokens.css`. El tema claro utiliza
`--primary: var(--clinic-violet)`, cuyo valor real ya existente es **#5350CC**,
y `--primary-foreground` blanco. El oscuro utiliza **#E4F222** y **#08090A**.
No se cambiaron esas definiciones ni los colores de hover, estados o controles.

Los tokens de compatibilidad del logo ahora son aliases:

```css
--brand-logo-background: var(--primary);
--brand-logo-foreground: var(--primary-foreground);
```

Se eliminaron sus dos overrides independientes en `.dark`. No hay referencias
circulares ni un estado de tema propio del logo. `src/styles/app.css` ya
consumía estos aliases, por lo que no fue necesario modificar esa hoja.

| Tema | Logo y botones: fondo | Logo y botones: texto |
| --- | --- | --- |
| Claro | Violeta ClinicApp `#5350CC` | Blanco `#FFFFFF` |
| Oscuro | Acid Lime `#E4F222` | Void `#08090A` |

Si cambia `--primary` o `--primary-foreground`, ambos componentes reciben los
nuevos valores automáticamente. Las pruebas cambian temporalmente ambos tokens
en el navegador y verifican esa propagación en los dos temas, sin alterar
geometría ni colores semánticos. Es una comprobación aislada: los valores de
producción permanecen intactos.

## Componente e instancias

Se reutilizó BrandLogo, definido en `src/shared/components/brand-logo.tsx`.
Su JSX, letras CA, dimensiones, radio, alineación y comportamiento no cambiaron;
solo se actualizó su comentario para documentar la dependencia compartida.

Las instancias existentes reciben el ajuste automáticamente:

- Login, Recuperar contraseña y Solicitar acceso, mediante AuthLayout.
- Configuración inicial.
- Sidebar móvil, expandido y contraído de todos los módulos.
- CA predeterminado de la vista previa institucional mediante InstitutionLogo.

El Header no tenía otra marca CA y no se añadió una duplicación. Las imágenes
institucionales, iniciales personalizadas, fotografías y colores de perfil
conservan sus valores y su presentación. Los estados clínicos, financieros y
semánticos no se conectaron a los aliases del logo.

## Archivos modificados

Rutas relativas a `ClinicApp-main`:

| Archivo | Cambio de esta entrega |
| --- | --- |
| `front/src/styles/tokens.css` | Aliases al primario compartido y eliminación del override neutro del logo oscuro. |
| `front/src/shared/components/brand-logo.tsx` | Comentario de documentación; JSX intacto. |
| `front/tests/auth-ui.spec.ts` | Propagación de tokens, contraste de CA, proporción, centrado y colores en los once anchos. |
| `front/tests/global-design-system.spec.ts` | Expectativa Acid Lime del logo oscuro en acceso y todos los módulos. |
| `front/tests/global-interactions.spec.ts` | Logo en menú móvil y ambas variantes de escritorio; geometría estable entre temas. |
| `front/tests/profile-integration.spec.ts` | Expectativa Acid Lime, conservando las comprobaciones de imágenes, perfiles y permisos. |
| `front/DESIGN_SYSTEM_PREMIUM_REPORT.md` | Enlace al informe vigente de este ajuste. |
| `front/SHARED_PRIMARY_LOGO_REPORT.md` | Este informe. |

No se modificó el componente Button ni su CSS, autenticación, rutas, API,
stores, formularios, calendarios, datos, cálculos, motor odontológico o matriz
periodontal. Se comprobaron **163 archivos fuente adicionales sin diferencias**
mediante SHA-256 respecto al inicio de esta entrega. Registro:
`test-results/shared-logo-before/source-check.json`.

## Verificación

Desde `front`:

```powershell
npm.cmd run build
npm.cmd run lint
$env:CLINIC_TEST_URL = 'http://localhost:5173'
$env:PLAYWRIGHT_JSON_OUTPUT_FILE = 'test-results/shared-logo-complete.json'
npm.cmd run test:e2e -- --output=test-results/shared-logo-complete --reporter=line,json --max-failures=3
$env:PLAYWRIGHT_JSON_OUTPUT_FILE = 'test-results/shared-logo-sidebar.json'
npm.cmd run test:e2e -- tests/global-interactions.spec.ts --grep 'sidebar, focus and stable theme geometry' --output=test-results/shared-logo-sidebar --reporter=line,json --max-failures=2
git diff --check
```

- Build: correcto, TypeScript y Vite.
- Lint: sin errores; seis avisos preexistentes de Fast Refresh y React Compiler.
- Resultado vigente: **77 pruebas verificadas y aprobadas**. La ejecución
  integral aprobó 75; las dos nuevas comprobaciones geométricas del sidebar
  exigían inicialmente 36 px exactos y Chrome devolvió 36.000001 px. Se corrigió
  la tolerancia de medición a dos decimales y ambas aprobaron al repetirse.
  No se cambió código de la aplicación para resolver esa aserción.
- Los dos registros originales se conservan; el último resultado de cada caso
  está reunido en `test-results/shared-logo-verification.json`: 77 aprobados,
  sin fallos pendientes.
- `git diff --check`: sin errores de whitespace.

Resoluciones incluidas en las comprobaciones de ambos temas: **320, 360, 375,
390, 430, 600, 768, 1024, 1280, 1440 y 1920 px**. El acceso comprueba centrado,
proporción cuadrada, colores y contraste de CA. Configuración inicial y la matriz
global comprueban las mismas resoluciones. El menú móvil comprueba el logo de
320 a 768 px; el sidebar expandido y contraído, de 1024 a 1920 px. Se compara
también la posición y tamaño del logo antes y después del cambio de tema.

Las pruebas existentes cubren persistencia, recarga, navegación, cierre de
sesión, formularios, imágenes personalizadas, permisos y funcionalidad clínica.
Las capturas actualizadas están en `test-results/premium-after`, con el
[comparador visual](http://localhost:5173/test-results/premium-comparison.html).
Ese comparador conserva un estado anterior de las entregas previas y muestra
el resultado actual en su columna Después.

## Límites y Git

Las comprobaciones responsive utilizan Chrome con viewports controlados;
queda pendiente una revisión en dispositivos físicos y con lector de pantalla.
Vite mantiene su advertencia preexistente de chunks superiores a 500 kB.

Se conservaron los cambios previos del repositorio. Su estado y huellas iniciales
están en `test-results/shared-logo-before`. No se hicieron commits ni cambios
fuera del frontend. Localhost se mantiene en el puerto 5173.
