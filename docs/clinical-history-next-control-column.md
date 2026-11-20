# Columna «Próximo control»

18 de noviembre de 2026.

Se aplicó el último bloque del documento: ajuste exclusivamente visual, conservando el guion «—» y sin introducir estados, indicadores ni etiquetas.

## Cambios

- `front/src/modules/clinical-history/pages/clinical-history-list-page.tsx`: la columna usa una clase local y el guion reutiliza `text-muted-foreground`. Las fechas siguen utilizando el mismo `shortDate` y `formatDateOnly` con locale `es-EC`.
- Nuevo `front/src/modules/clinical-history/pages/clinical-history-list.module.css`: ancho intrínseco dentro del layout automático de la tabla, texto alineado a la izquierda y padding horizontal de 10 px. La clase se aplica únicamente a la cabecera y las celdas de esta columna.

No se modificaron otras columnas, componentes compartidos ni CSS global. El espacio liberado se reparte mediante el layout automático existente, dando más ancho a Motivo y Diagnóstico. No se agregaron contenedores alrededor de las fechas; solo el guion tiene un span de presentación para su color secundario.

## Validación

- TypeScript y build aprobados.
- Lint sin errores; conserva cinco advertencias preexistentes ajenas al cambio. Build conserva el aviso existente sobre paquetes grandes.
- Dos regresiones existentes aprobadas: rutas del historial y apertura de una atención desde la tabla; restricciones de acceso de recepción.
- Revisión en Chrome: 320, 375, 390, 430, 600, 768, 1024, 1280, 1440 y 1920 px; ambos temas y ambos estados del sidebar cuando corresponde. Se registraron 30 distribuciones antes y 30 después.
- Fechas visibles sin recortes; valores y guiones idénticos antes/después. Se mantiene la presentación móvil mediante tarjetas, sin desbordamiento horizontal global.
- A 1440 px, columna de aproximadamente 146 → 115 px; a 1920 px, 209 → 115 px. Las filas mantienen 46 px en los casos medidos.
- Capturas comparativas: `front/test-results/next-control/before/` y `after/`. Medidas, registros de build/lint y resultado consolidado en `front/test-results/next-control/verification.json`.

Las comprobaciones usaron contextos de navegador aislados con dos fechas de ejemplo y dos valores faltantes. El almacenamiento de cada contexto se comparó antes y después de revisar la presentación, sin modificaciones. No se accedió al almacenamiento del navegador del usuario.

Se compararon por SHA-256 los 376 archivos existentes al comenzar: solo cambió la página del listado y 375 permanecieron idénticos. API, datos, contratos, cálculos, exportaciones, permisos, navegación, odontograma y periodontograma conservan sus archivos. Se añadieron únicamente el módulo CSS y este informe, además de evidencias locales de verificación.

Sin commits, pushes ni dependencias nuevas. Disponible en `http://localhost:5173/historial-clinico`.
