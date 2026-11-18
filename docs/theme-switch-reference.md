# Interruptor visual de tema

Implementado y verificado el 14 de noviembre de 2026.

El control del Header se adaptó a la referencia: píldora con profundidad suave, selector blanco y un icono descubierto en el extremo opuesto. En claro, el selector está a la izquierda y el sol utiliza el violeta existente; en oscuro, está a la derecha, la luna es clara y el borde del selector utiliza Acid Lime. Los colores provienen de los tokens actuales.

Se conserva el área de interacción de 64 × 44 px y la misma posición junto a la campana y el avatar. El Header y sus otros controles mantienen sus dimensiones y distribución.

## Archivos

- `front/src/app/layout/header-theme-switch.tsx`: conserva el Switch, `resolvedTheme`, `setTheme`, etiqueta accesible y tooltip existentes. Añade únicamente la referencia al elemento y la animación visual del selector.
- `front/src/app/layout/header-theme-switch.module.css`: forma, círculo blanco, iconos descubiertos, bordes, superficies, sombras y foco visible.
- `front/tests/header-theme-switch.spec.ts`: cinco casos nuevos para la referencia visual, movimiento real, inversión rápida, teclado, persistencia, movimiento reducido y uso táctil.
- `front/tests/phase4-density.spec.ts`: ajusta la expectativa visual del selector anterior de color sólido al nuevo selector blanco; mantiene sus verificaciones funcionales.
- `docs/theme-switch-reference.md`: este informe.

## Tema y animación

`next-themes` sigue siendo la única fuente del tema y utiliza la misma preferencia almacenada. No se agregan estados de tema ni se modifica el proveedor. Se conserva su inicialización actual: claro por defecto y preferencia guardada cuando existe.

El proveedor desactiva deliberadamente las transiciones CSS de toda la aplicación al cambiar de tema. Por eso el selector usa una animación local de 220 ms mediante Web Animations, sin activar transiciones en otras pantallas. La inversión parte de la posición visual actual y cancela el movimiento anterior para evitar saltos al pulsar repetidamente.

Con `prefers-reduced-motion: reduce`, el cambio de tema y posición es inmediato. No se inicia una animación al restaurar el tema después de recargar. El control conserva `role="switch"`, `aria-checked`, teclado, foco visible, tooltip según el tema y un área táctil de al menos 44 px.

## Validación real

- **Build correcto**, sin errores de TypeScript.
- **Lint correcto**, con las cinco advertencias anteriores del proyecto y ninguna nueva.
- **37 casos de Playwright aprobados**, sin fallos, omisiones ni casos inestables: cinco nuevos del interruptor, 18 de navegación/campana/tema, 12 de autenticación y dos del selector/navegación existentes.
- Se comprobó la animación real en su punto intermedio, su duración, la inversión repetida, clic, tabulación, Espacio, toque en móvil, recarga y sincronización del tema entre pestañas.
- Se comprobó el cambio inmediato con movimiento reducido y la ausencia de animación inicial al recargar.
- Responsive en ambos temas a **320, 360, 375, 390, 430, 600, 768, 1024, 1280, 1440 y 1920 px**.
- La campana conserva su contador, filtros, permisos, estados de error y lectura, según sus pruebas existentes. No se modificó ningún archivo de notificaciones.
- Se generaron 12 capturas anteriores y 12 posteriores, con control y Header a 320, 768 y 1440 px en ambos temas. Los seis pares del Header conservan exactamente los mismos píxeles **fuera del área del selector** y las mismas dimensiones.
- Los hashes anteriores y posteriores confirman que solo cambiaron los dos archivos del componente y la expectativa visual de una prueba existente; se agregó la prueba específica. No cambiaron AppLayout, Sidebar, navegación, autenticación, notificaciones, proveedores, tokens ni módulos.

Los artefactos locales están en `front/test-results/theme-switch-reference`: `review.html`, `verification.json`, capturas `before/after`, mediciones, resultados de Playwright y registros de build/lint. Están ignorados por Git.

La implementación reutiliza el componente funcional existente y no utiliza la imagen como elemento decorativo. No se instalaron dependencias ni se realizaron operaciones de publicación o cambios de rama. El localhost habitual se mantiene en el puerto 5173.
