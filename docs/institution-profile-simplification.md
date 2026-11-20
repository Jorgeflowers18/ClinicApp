# Simplificación del Perfil institucional

Fecha: 19 de noviembre de 2026. Ruta: `/perfil-institucion`.

## Resultado

- Se retiran la etiqueta, el input y la explicación de Texto del logo, junto con su separador y el espacio que ocupaban.
- Identidad visual conserva la marca, nombre, subtítulo opcional, Subir logo o Reemplazar imagen, Quitar cuando hay imagen y los mensajes reales de lectura/error/guardado. Sin imagen muestra «Iniciales generadas automáticamente».
- La ayuda del subtítulo se presenta mediante un icono junto a su etiqueta. Utiliza el Tooltip y Button existentes y responde a hover, teclado y toque; el botón es de tipo button y no envía el formulario. Escape y pulsar fuera cierran la ayuda.
- Los pares de campos comparten las filas de etiquetas, controles y errores mediante una subcuadrícula local. Se alinean las entradas incluso cuando una etiqueta ocupa dos líneas, manteniendo visibles los errores. En espacios pequeños los campos pasan a una columna.
- La vista previa cambia con el borrador; el menú mantiene la identidad confirmada hasta guardar. Se conservan cancelar, persistencia, imágenes, sedes y las protecciones contra errores y lecturas de imágenes obsoletas.

## Una única función de iniciales

`institutionInitials` se reutiliza en InstitutionMark, que sirve a la vista previa y al Sidebar, y en InstitutionLogo, que sirve a las pantallas de acceso mediante AuthLayout.

| Nombre | Iniciales |
| --- | --- |
| ClinicApp | CA |
| ClinicApp Odontología | CA |
| Dental Sonrisas | DS |
| Laboratorio Dental | LD |
| Odonto Vida | OV |
| Clínica San José | CS |
| Dental | DE |
| Élite Álamo | ÉÁ |
| A | AA |

Se toman las primeras letras de las primeras dos palabras, o las dos primeras letras de una sola palabra. ClinicApp como marca principal conserva CA. Se normaliza Unicode a NFC, se admiten espacios adicionales y se conservan caracteres acentuados. Para un nombre de una letra se repite esa letra; un nombre vacío usa CA como fallback visual, aunque el formulario sigue exigiendo un nombre válido para guardar.

Todas las iniciales institucionales usan los tokens existentes de los botones primarios. Los colores originales de las imágenes personalizadas no se alteran.

## Dependencia del antiguo Texto del logo

La auditoría encontró que AuthLayout enviaba `institution.logoText` a InstitutionLogo. Esa dependencia visual se sustituye por `institution.name`, del que se calculan las iniciales con la función compartida. Es el único ajuste en las pantallas de acceso: no cambia la autenticación, las rutas, los permisos ni sus formularios.

La propiedad `logoText` y su valor inicial se conservan en el registro existente para compatibilidad. No se pide editarla, no se borra de las configuraciones anteriores y no sustituye las iniciales automáticas. Las pruebas verifican que un valor antiguo ZZ permanece almacenado mientras el nombre determina lo mostrado en la vista previa, el Sidebar, Login y Solicitar acceso.

No se modifica el backend ni se introduce otra fuente de persistencia o generador de iniciales. Los avatares personales siguen siendo independientes de la identidad institucional.

## Archivos de esta corrección

| Archivo | Cambio |
| --- | --- |
| `front/src/modules/institution/lib/institution-initials.ts` | Generación centralizada según los ejemplos y la convención ClinicApp. |
| `front/src/modules/institution/pages/institution-profile-page.tsx` | Eliminación del campo manual, etiqueta con ayuda accesible y conservación de errores. |
| `front/src/modules/institution/pages/institution-profile-page.module.css` | Alineación de campos, botón de ayuda y retirada del separador obsoleto. |
| `front/src/modules/institution/components/institution-logo-controls.tsx` | Identidad visual compacta y acciones de imagen. |
| `front/src/modules/institution/types/institution.types.ts` | Documentación de `logoText` como dato legado. |
| `front/src/shared/components/brand-logo.tsx` | Iniciales automáticas desde el nombre institucional. |
| `front/src/shared/components/brand-logo.module.css` | Tokens de tema comunes para iniciales institucionales. |
| `front/src/modules/auth/components/auth-layout.tsx` | Envío del nombre en lugar de las iniciales manuales. |
| `front/tests/institution-simplification.spec.ts` | Ejemplos de iniciales, coherencia entre pantallas, tooltip y alineación. |
| `front/tests/institution-branding.spec.ts` | Expectativas de las nuevas reglas de iniciales. |
| `front/tests/institution-profile.spec.ts` | Conservación del dato legado sin editar un campo retirado. |
| `front/tests/profile-integration.spec.ts` | Ausencia del input manual y convención CA. |
| `front/tests/institution-identity.spec.ts` | Ayuda mediante icono en lugar de descripción inferior. |
| `docs/institution-profile-redesign.md` | Actualización de las reglas y dependencias de identidad. |
| `docs/institution-identity-personalization.md` | Actualización de la ayuda y compatibilidad. |
| `docs/institution-profile-simplification.md` | Este informe. |

Se conservan los cambios locales de la personalización institucional anterior.

## Validación

- `npm.cmd run build`: aprobado, incluyendo TypeScript (`tsc -b`) y build de producción.
- `npm.cmd run lint`: sin errores; tres advertencias previas de Fast Refresh en Button, Badge y Tabs.
- Pruebas nuevas de Playwright en Chrome: 5/5 aprobadas, con 15 ejemplos de la función y flujos de las pantallas en ambos temas.
- Regresión de identidad, marca, perfil institucional, sedes, perfiles personales, permisos, navegación y pantallas de acceso: 59/59 aprobadas. Total: 64 casos seleccionados aprobados entre ambas ejecuciones; no corresponde a la totalidad de la suite histórica del repositorio.
- Ayuda comprobada con ratón, teclado y toque: no altera las dimensiones del formulario y los errores siguen visibles y asociados a su campo.
- Alineación y ausencia de desbordamiento verificadas a 320, 375, 390, 430, 600, 768, 1024, 1440 y 1920 px. Capturas revisadas en modo claro y oscuro.
- Sin cambios en odontograma, periodontograma, bibliotecas, dependencias ni otros módulos. Los artefactos compilados conservan `odontogram-B0VyF-Zx.css` y `odontogram-33SQCvNn.js`.

Evidencia local bajo `front/test-results/institution-simplification-targeted-fixed` y `front/test-results/institution-simplification-regression`.

Para reproducir con localhost iniciado, desde `front`:

```powershell
$env:CLINIC_TEST_URL='http://127.0.0.1:5173'
npx.cmd playwright test tests/institution-simplification.spec.ts tests/institution-identity.spec.ts tests/institution-branding.spec.ts tests/institution-profile.spec.ts tests/profile-integration.spec.ts tests/navigation-iconography.spec.ts tests/auth-ui.spec.ts --workers=2 --reporter=line --output=test-results/institution-simplification-reproduction
```

La persistencia continúa siendo local por navegador mediante el mecanismo existente; no se agrega sincronización entre dispositivos.
