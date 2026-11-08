# Backlog de implementación

Planes de implementación por sección de la webapp: un archivo `.md` por sección, con qué cambia, cómo se implementa y cómo se valida. El backlog general de alto nivel está en [`documentacion/backlog.md`](../documentacion/backlog.md).

Cuando un plan queda implementado se elimina de esta carpeta: su detalle queda en [`documentacion/arquitectura-frontend.md`](../documentacion/arquitectura-frontend.md), los pendientes de backend en [`back/backlog.md`](../back/backlog.md) y el plan original en el historial de git.

## Alcance: solo frontend

Mientras no se indique lo contrario, los planes se implementan **solo en el frontend**, para mostrarlos a la clienta. No se toca el backend (`back/`).
- Los datos se guardan en el navegador a través de las funciones **Mock** de cada `*.api.ts`.
- Las funciones **Real** son el contrato futuro: llamadas HTTP con su `// TODO: conectar a endpoint real`.
- Los endpoints que mencionen los planes se anotan en `back/backlog.md` como pendientes de backend.

## Planes en curso

Ninguno por ahora.

---

## Planes completados

| Ítem | Contenido | Commits |
|---|---|---|
| 13. Simplificación de la historia clínica | Historia editable con "Guardar cambios", atenciones inmutables con notas aclaratorias, tratamientos realizados con costo editable, citas del paciente, resumen del paciente, lista global y exportación | `8a674aa`, `7ff025e` y siguientes |
| 12. Historia clínica según el formulario del consultorio | Antecedentes y alertas, datos del paciente compartidos con Pacientes, declaración de veracidad y registro profesional, página "Registrar atención" por pasos (evaluación, diagnósticos, pronóstico, diagnóstico periodontal), copia de alertas, plan por fases, exámenes solicitados con interconsulta, índices periodontales y exportación | Commit «Ítem 12 - Historia clínica según el formulario del consultorio» |

El detalle de lo implementado está en [`arquitectura-frontend.md` § Historia clínica odontológica](../documentacion/arquitectura-frontend.md#historia-clínica-odontológica).

## Pendientes por confirmar con la clínica

**Del ítem 13:**
- **Texto del consentimiento de datos:** la clínica debe proveer el texto legal. Mientras tanto se usa un texto provisional marcado como tal.
- **Ubicación del consentimiento de datos:** al ser sobre datos personales y no solo clínicos, ¿debería registrarse también (o en su lugar) en la ficha del paciente, al darlo de alta? La recepción no tiene acceso a la historia clínica.

**Del ítem 12:**
- **N.° de historia clínica:** se usa el formato automático `HC-000123`. ¿La clínica tiene una numeración propia que haya que respetar?
- **Elementos que usa (higiene oral):** lista definitiva de opciones. Hoy hay una lista provisional (cepillo, hilo, cepillo interdental, enjuague, irrigador), marcada como tal.
- **Registro profesional:** no hay pantalla para administrar profesionales; el registro de cada uno está cargado en los datos de ejemplo. ¿Se agrega una (por ejemplo, en Perfil institucional)?
- **Datos del cliente al dar de alta:** hoy estado civil, ocupación, empresa, nacionalidad, ciudad y parentesco se registran solo en la historia. ¿Recepción debe poder registrarlos al dar de alta al paciente?
- **Sugerencias de diagnóstico desde el odontograma:** hoy se ofrecen las caries y los diagnósticos por pieza del odontograma guardado. Confirmar si hacen falta otros hallazgos.
- **Pronóstico por pieza:** su relación con el odontograma sigue por mapear; por ahora es texto.
- **Nivel de inserción dentro del periodontograma:** se calcula y se muestra como índice (pérdida de inserción máxima), pero mostrarlo por sitio dentro del periodontograma requiere modificar la librería del editor.
- **Fila "Signo" del periodontograma y firmas** (paciente, profesional, evolución y periodontograma): siguen por definir.
- **Modo demostración:** los datos del paciente se guardan en memoria y vuelven a los de ejemplo al recargar; lo escrito en "Registrar atención" se pierde al recargar. Si para la demostración conviene conservarlos, se pueden guardar en el navegador.
