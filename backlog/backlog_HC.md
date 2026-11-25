# Backlog HC — Historia clínica odontológica integral

Lo que **falta** de los elementos del formulario en papel del consultorio: "Historia Clínica Odontológica Integral" de CEOT Estudio Dental (Dra. María Cristina Torres Paz), páginas 1 a 7.

**Ya está implementado** (revisado el 2026-11-24), y por eso se retiró de este archivo:
- **Datos del paciente (sección 1):** los 18 datos. Son el mismo registro del módulo Pacientes y se editan en la historia y en Pacientes.
- **Antecedentes (secciones 3 a 6):**
  - los 19 antecedentes médicos, personales o familiares, con "Niega antecedentes" excluyente;
  - alergias, medicación y las 8 alertas;
  - hábitos;
  - antecedentes odontológicos.
- **Datos de cada atención (secciones 2 y 7 a 11):**
  - motivo y enfermedad actual;
  - signos vitales, ASA y riesgos;
  - examen extraoral e intraoral;
  - dolor y riesgos de caries y periodontal;
  - exámenes complementarios, con la interconsulta y la carga del resultado.
- **Odontograma, diagnósticos y plan (secciones 12 a 16):**
  - odontograma (sección 12);
  - diagnósticos con prioridad (13);
  - pronóstico (14);
  - plan por fases con fecha prevista (15);
  - evolución: materiales, anestesia y lote en cada atención (16).
- **Declaración de veracidad (sección 17):** con el registro profesional.
- **Parte periodontal (secciones 18 a 21 y página 7):**
  - antecedentes periodontales (18);
  - índices periodontales, con profundidad de sondaje máxima, pérdida de inserción máxima y dientes perdidos por periodontitis (19);
  - diagnóstico periodontal 2017 (20);
  - intervalo de mantenimiento (21);
  - periodontograma (página 7).

El detalle de lo hecho está en [`arquitectura-frontend.md` § Historia clínica odontológica](../documentacion/arquitectura-frontend.md#historia-clínica-odontológica). La versión completa de este archivo, con todos los elementos del papel, está en el historial de git.

---

## Pendiente de implementar

| # | Elemento | Sección del papel | Qué falta |
|---|---|---|---|
| 1 | **Firmas** | 16 (evolución), 17 (declaración), página 7 (periodontograma), consentimiento | Definir cómo se firma: dibujo en pantalla, firma electrónica o documento escaneado. Hoy la pantalla dice "Pendiente de definir". |
| 2 | **Objetivos de control** | 21 | Placa < ___ %, Sangrado < ___ % y PS residual objetivo ___ mm, para compararlos con los índices de cada control. Quedó como objetivo a futuro. |
| 3 | **Nivel de inserción por sitio** | Página 7 (fila N.I.) | Hoy se calcula y se muestra como índice (pérdida de inserción máxima). Mostrarlo en cada sitio del periodontograma requiere modificar la librería del editor. |
| 4 | **Fila "Signo" del periodontograma** | Página 7 | Definir qué se anota en esa fila. |
| 5 | **Pronóstico por pieza** | 14 y 21 | Hoy es texto libre. Falta relacionarlo con el estado de cada pieza en el odontograma. |

## Por confirmar con la clínica

- **"Elementos que usa" (higiene oral):** la lista actual es provisional: cepillo, hilo, cepillo interdental, enjuague e irrigador. Falta la lista definitiva.
- **Texto del consentimiento de datos:** la clínica debe dar el texto legal. Hoy se muestra uno marcado como provisional.
- **Dónde se registra el consentimiento de datos:** al ser sobre datos personales y no solo clínicos, ¿debería registrarse también al dar de alta al paciente? Recepción no tiene acceso a la historia clínica.
- **N.° de historia clínica:** se usa el formato automático `HC-000123`. ¿La clínica tiene una numeración propia que haya que respetar?
- **Diagnósticos sugeridos desde el odontograma:** hoy se ofrecen las caries y los diagnósticos por pieza. ¿Hacen falta otros hallazgos?
- **Dentición temporal en el odontograma (piezas 51–85):** está soportada. Falta confirmar con el personal que sea fácil de encontrar y de usar.
