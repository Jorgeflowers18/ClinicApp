# Iconografía y botón de navegación

Implementado el 14 de noviembre de 2026.

Los nueve accesos utilizan Lucide React de contorno, con tamaño de 22 px y trazo de 2 px. Se conservan los grupos GENERAL, ATENCIÓN CLÍNICA, GESTIÓN y COMUNICACIÓN.

| Módulo | Icono |
| --- | --- |
| Panel | LayoutDashboard |
| Pacientes | UsersRound |
| Citas | CalendarDays |
| Historial clínico | ClipboardList |
| Tratamientos | Stethoscope |
| Inventario | Package |
| Finanzas | Wallet |
| Reportes | ChartNoAxesCombined |
| Notificaciones | Bell |

El único botón del Header alterna Menu/X con una transición de 180 ms y mantiene su área de interacción de 44 × 44 px. Controla el sidebar de escritorio y el menú superpuesto móvil. No hay un segundo botón de cierre dentro del sidebar. En móvil el panel comienza debajo del Header para mantener accesible el mismo control; la asociación con el panel utiliza el handle público de Base UI. Se conserva el cierre al navegar, pulsar fuera o usar Escape, con retorno de foco al botón.

Los iconos normales son gris azulado en claro y gris claro en oscuro. Hover y selección utilizan el primario del tema: violeta #5350CC o Acid Lime #E4F222. El hover oscuro usa Graphite. Se mantiene el indicador lateral del módulo activo y se respeta la preferencia de movimiento reducido.

## Archivos de implementación

- `front/src/app/nav-config.ts`
- `front/src/app/layout/app-layout.tsx`
- `front/src/app/layout/app-layout.css`

Se añadió `front/tests/navigation-iconography.spec.ts`. La comparación con las copias y hashes previos confirma que únicamente se modificaron esos tres archivos de implementación, y que las rutas, etiquetas y permisos de los accesos permanecen iguales. Los archivos del switch de tema, autenticación y notificaciones no cambiaron en esta corrección.

## Validación

- `npm run build`: correcto; conserva el aviso de tamaño de algunos chunks.
- `npm run lint`: sin errores; cinco advertencias existentes.
- Playwright: **37 pruebas aprobadas**, sin fallos, omisiones ni reintentos, en `navigation-iconography`, `navigation-shell`, `global-interactions` y `header-theme-switch`.
- Ambos temas en 320, 360, 375, 390, 430, 600, 768, 1024, 1280, 1440 y 1920 px. Comprobados apertura/cierre, iconos y colores, ausencia de desbordamiento horizontal, teclado, tacto, movimiento reducido, permisos y notificaciones.
- Capturas revisadas visualmente en móvil y escritorio. Evidencia local en `front/test-results/navigation-iconography/`: `final-e2e.json`, `measurements.json`, `build.log`, `lint.log` y `after/` con 24 capturas de ambos estados y temas en 390, 768 y 1440 px.

El servidor habitual permanece disponible en http://localhost:5173. No se crearon commits ni se publicaron cambios en GitHub.
