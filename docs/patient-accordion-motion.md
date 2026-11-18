# Acordeón animado de creación y edición de pacientes

Se mantiene el modal y el formulario compartidos existentes. Los cambios de sección cierran primero el panel visible y abren después el último solicitado. La altura del modal sigue la transición sin desplazar el fondo de la aplicación.

## Implementación

- `front/src/modules/patients/hooks/use-patient-accordion.ts`: coordinador exclusivo para formularios de pacientes. Un único identificador activo, un identificador de salida transitorio y una referencia a la última solicitud. Observa el atributo `hidden` que Base UI aplica al completar su transición para permitir la siguiente apertura. No utiliza temporizadores rígidos.
- `front/src/modules/patients/components/patient-form.tsx`: conecta el coordinador al Accordion existente. Los accesos a una sección concreta y la validación esperan a que termine el despliegue antes de enfocar. El desplazamiento se limita al contenedor correspondiente y ocurre solamente si el campo queda fuera de su área visible.
- `front/src/modules/patients/components/patient-ui.tsx`: mantiene los campos montados. Los paneles cerrados o en salida usan `inert` y `aria-hidden`, además de los atributos accesibles de Base UI. Si se contrae un panel con el foco dentro, este vuelve a su encabezado.
- `front/src/modules/patients/patients.css`: altura entre cero y el valor numérico medido por Base UI, opacidad y curva `ease-in-out`. Cierre de 160 ms, apertura de 200 ms y giro de flecha de 200 ms. Se desactiva el anclaje automático y se reserva el espacio de la barra de desplazamiento del modal. Movimiento reducido sin transición del panel.

Las transiciones de altura utilizan `--accordion-panel-height`, medido por la biblioteca instalada. No se anima directamente `height: auto`. Los clics durante una salida actualizan la solicitud pendiente, y una apertura puede interrumpirse para comenzar un cierre desde su tamaño interpolado.

Se conservan `keepMounted`, `shouldUnregister: false`, los valores iniciales, el reset por identidad del paciente, los errores, el payload y los servicios. No se crean formularios alternativos ni se cambian los guardados, rutas o confirmaciones de descarte.

## Verificación

Las pruebas y evidencias están en `front/test-results/patient-accordion-motion/`. Resultado: **48 casos únicos aprobados, sin fallos pendientes**. `final-results.json` consolida el resultado por caso, sustituyendo únicamente los casos vueltos a ejecutar; conserva la referencia al informe de cada ejecución.

- 8 casos nuevos en `front/tests/patient-accordion-motion.spec.ts`: mediciones por fotograma de altura, opacidad, secuencia y fondo estable; ambos modos y temas; clics rápidos, aperturas interrumpidas, cierre con teclado, paneles inertes y funcionamiento sin animaciones CSS; validación y guardados reales de creación/edición a 375 y 1024 px.
- 38 regresiones de `patient-single-accordion`, `patient-edit-modal`, `patients-redesign` y `patients-ui-refinement`: conservación completa de campos, estados reales, servicios, errores de servidor, prevención de doble envío, descarte, foco, menús, filtros, paginación, accesos directos y pestañas. Incluyen movimiento reducido y anchos de 320, 360, 375, 390, 430, 600, 768, 1024, 1280, 1440 y 1920 px.
- 2 pruebas clínicas existentes de `dental-history`: odontograma, plan, consentimiento, documentos, guardado y exportaciones; antecedentes, alertas y datos del paciente.
- Se actualizaron únicamente las esperas de dos pruebas responsive existentes (`patients-redesign.spec.ts` y `patients-ui-refinement.spec.ts`) para medir y enfocar después del despliegue. Antes suponían una apertura inmediata. Se conservan sus aserciones de datos y geometría.
- Compilación TypeScript/Vite y lint. Permanecen las cinco advertencias previas de lint y el aviso de tamaño de chunks de Vite.

`motion-timings.json` contiene 12 mediciones reales: cierre completado entre 184 y 202 ms desde la solicitud y secuencia completa entre 402 y 433 ms. Los tiempos incluyen los fotogramas que Base UI utiliza para preparar y completar los estilos, además de las duraciones CSS.

## Revisión visual y alcance

Abrir `front/test-results/patient-accordion-motion/review.html`: reproducciones de fotogramas reales de Chrome en ambos temas a 1440 y 375 px, capturas finales y comparación inicial. Se revisaron estados intermedios de cierre y apertura, sin superposición, así como el contenido de Consentimientos y la posición del pie en móvil.

`scope-verification.json` compara los archivos existentes con sus hashes anteriores al cambio. Los archivos de API, tipos, validación, rutas, modales compartidos, Header, Sidebar, temas, historia clínica, dependencias y biblioteca del odontograma conservan su contenido. Las capturas del odontograma son idénticas byte por byte en claro y oscuro.

No se instalaron dependencias ni se realizaron commits, pushes, resets o cambios de rama. Las evidencias no contienen credenciales nuevas ni datos reales de pacientes; utilizan las cuentas y registros de demostración del proyecto.
