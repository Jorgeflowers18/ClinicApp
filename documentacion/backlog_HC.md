# Backlog HC — Historia clínica odontológica integral

Elementos oficiales de entrevista tomados del formulario en papel que usa el consultorio ("Historia Clínica Odontológica Integral" de CEOT Estudio Dental, Dra. María Cristina Torres Paz). Es la base para los planes de implementación y validación de las mejoras en la página de historia clínica.

**Fuente:** fotos del formulario (`fotos_dental/foto_1` a `foto_7`). Se revisaron la **foto_1** (página 1), la **foto_2** (página 2), la **foto_3** (página 3), la **foto_4_1** (página 4), la **foto_4** (página 5), la **foto_5** (página 6) y la **foto_7** (página 7).

Este archivo registra los elementos a implementar a futuro y sus observaciones; el detalle técnico se define al momento de implementar.

Cada etiqueta indica en **Pertenece a** la sección de la página donde se implementa:
- **Historial Clínico:** datos del paciente que se mantienen entre visitas y se actualizan cuando cambian.
- **Consulta:** datos que se registran en cada visita porque pueden cambiar de una consulta a otra.

| Etiqueta | Pertenece a | Fuente |
|---|---|---|
| Datos del Cliente | Historial Clínico | foto_1, sección 1 |
| Datos de Consulta | Consulta | foto_1, sección 2 |
| Datos de Antecedentes Médicos | Historial Clínico | foto_1, sección 3 |
| Datos de Alergias, Medicamentos y Alertas | Historial Clínico | foto_2, sección 4 |
| Datos de Hábitos y Factores de Riesgo | Historial Clínico | foto_2, sección 5 |
| Datos de Antecedentes Odontológicos | Historial Clínico | foto_2, sección 6 |
| Datos de Signos Vitales y Evaluación de Riesgo | Consulta | foto_2, sección 7 |
| Datos de Examen Extraoral | Consulta | foto_3, sección 8 |
| Datos de Examen Intraoral | Consulta | foto_3, sección 9 |
| Datos de Evaluación de Dolor y Riesgo | Consulta | foto_3, sección 10 |
| Datos de Exámenes Complementarios | Consulta o Historial Clínico (según cada documento) | foto_3, sección 11 |
| Datos de Odontograma | Consulta | foto_4_1, sección 12 |
| Datos de Diagnósticos | Consulta | foto_4, sección 13 |
| Datos de Pronóstico | Consulta | foto_4, sección 14 |
| Datos de Plan de Tratamiento por Fases | Consulta | foto_4, sección 15 |
| Datos de Evolución Clínica | Consulta | foto_4, sección 16 |
| Datos de Declaración de Veracidad | Historial Clínico | foto_4, sección 17 |
| Datos de Antecedentes y Síntomas Periodontales | Historial Clínico | foto_5, sección 18 |
| Datos de Índices Periodontales | Consulta | foto_5, sección 19 |
| Datos de Diagnóstico Periodontal | Consulta | foto_5, sección 20 |
| Datos de Pronóstico Periodontal y Plan | Consulta | foto_5, sección 21 |
| Datos de Periodontograma | Consulta | foto_7, página 7 (sin número de sección) |

**Elementos repetidos:** cuando un elemento del papel aparece en más de una sección, se implementa una sola vez. En la sección nueva se marca "ya registrado en…" y en la sección original "también aparece en…".

---

## Datos del Cliente

- **Pertenece a:** Historial Clínico
- **Fuente:** foto_1, sección "1. Identificación del paciente".
- **También aparece en:** el encabezado de [Datos de Periodontograma](#datos-de-periodontograma) (paciente, C.I., N.° de historia clínica, edad, teléfono y ocupación).

1. N.° de historia clínica
2. Fecha de apertura
3. Fecha de actualización
4. Apellidos y nombres
5. Cédula / pasaporte
6. Fecha de nacimiento
7. Edad (se calcula a partir de la fecha de nacimiento)
8. Sexo / género (si desea informar)
9. Estado civil
10. Ocupación
11. Empresa / institución
12. Nacionalidad
13. Dirección domiciliaria
14. Ciudad / provincia
15. Teléfono
16. Correo electrónico
17. Contacto de emergencia / parentesco
18. Teléfono de emergencia

## Datos de Consulta

- **Pertenece a:** Consulta
- **Fuente:** foto_1, sección "2. Motivo de consulta y enfermedad actual".

1. Motivo de consulta
2. Inicio, evolución, intensidad, factores desencadenantes y tratamientos previos

## Datos de Antecedentes Médicos

- **Pertenece a:** Historial Clínico
- **Fuente:** foto_1, sección "3. Antecedentes médicos personales y familiares".

1. Hipertensión arterial
2. Diabetes mellitus (también aparece en la sección 18 y en factores modificadores de la sección 20)
3. Cardiopatía / arritmia
4. Enfermedad renal
5. Enfermedad hepática
6. Trastorno tiroideo
7. Asma / EPOC
8. Epilepsia / convulsiones
9. Trastorno hemorrágico
10. Anemia
11. Osteoporosis
12. Cáncer / radioterapia / quimioterapia
13. Enfermedad autoinmune
14. Enfermedad infectocontagiosa
15. Hospitalizaciones previas (con detalle en texto: cuál, cuándo)
16. Cirugías previas (con detalle en texto: cuál, cuándo)
17. Embarazo / lactancia
18. Ansiedad / depresión
19. Otro (con detalle en texto libre)
20. Niega antecedentes relevantes (excluyente: no se puede marcar junto con otros antecedentes)
21. **Tipo de antecedente: Personal o Familiar** (punto agregado; no está en el papel)

## Datos de Alergias, Medicamentos y Alertas

- **Pertenece a:** Historial Clínico
- **Fuente:** foto_2, sección "4. Alergias, medicamentos y alertas".
- **También aparece en:** "Alerta médica" de [Datos de Periodontograma](#datos-de-periodontograma).

Alergias y medicamentos son listas dinámicas: se agregan las filas necesarias, sin el tope del papel (2 alergias, 3 medicamentos).

**Alergias** (por cada fila):
1. Alergia / reacción
2. Medicamento o sustancia
3. Manifestación y gravedad

**Medicación actual** (por cada fila):
4. Medicamento actual
5. Dosis / frecuencia
6. Indicación / médico tratante

**Alertas** (casillas de verificación):
7. Anticoagulantes / antiagregantes
8. Bifosfonatos / antirresortivos
9. Corticoides
10. Inmunosupresores
11. Insulina / hipoglucemiantes
12. Profilaxis antibiótica indicada
13. Marcapasos / prótesis valvular
14. Alergia a látex

## Datos de Hábitos y Factores de Riesgo

- **Pertenece a:** Historial Clínico
- **Fuente:** foto_2, sección "5. Hábitos y factores de riesgo".

Cada factor se marca **Sí / No** y tiene sus características:

1. Tabaco / vapeo: Sí / No. Características: tipo, cantidad, años. (También aparece en la sección 18 y en factores modificadores de la sección 20.)
2. Alcohol / sustancias: Sí / No. Características: tipo / frecuencia.
3. Bruxismo / apretamiento: Sí / No. Características: **elegible** (Diurno / Nocturno / Ambos), no texto libre.
4. Respiración oral: Sí / No. Sin características.
5. Higiene oral: Sí / No (también aparece como "higiene deficiente" en la sección 18). Detalle:
   - Calidad: **Adecuada / Deficiente**.
   - Cepillado: veces por día.
   - **Elementos que usa:** lista para elegir lo que usa el paciente (elemento agregado; en el papel solo dice "hilo/interdental"). Las opciones de la lista se definirán a futuro.
6. Dieta cariogénica: Sí / No. Características: frecuencia.

## Datos de Antecedentes Odontológicos

- **Pertenece a:** Historial Clínico
- **Fuente:** foto_2, sección "6. Antecedentes odontológicos".

1. Atención odontológica previa
2. Experiencia negativa / ansiedad
3. Sangrado gingival
4. Movilidad dental (también aparece en la sección 18)
5. Pérdida dentaria
6. Trauma dentoalveolar
7. Tratamiento periodontal (también aparece en la sección 18 como "Tratamiento periodontal previo")
8. Cirugía oral
9. Implantes
10. Ortodoncia
11. Endodoncia
12. Prótesis
13. Reacción a anestesia local
14. Complicaciones posoperatorias
15. Última consulta, tratamientos realizados y observaciones (texto libre)

## Datos de Signos Vitales y Evaluación de Riesgo

- **Pertenece a:** Consulta (pueden cambiar entre consultas)
- **Fuente:** foto_2, sección "7. Signos vitales y evaluación de riesgo".

**Signos vitales:**
1. PA (mmHg)
2. FC (lpm)
3. FR (rpm)
4. SpO₂ (%)
5. Temperatura (°C)
6. Peso (kg)
7. Talla (cm)

En el papel peso y talla comparten una casilla; se separan en dos campos para poder calcular el IMC.

**Clasificación ASA** (se elige una):
8. ASA I / ASA II / ASA III / ASA IV

**Evaluación de riesgo para la atención o cirugía** (casillas de verificación):
9. Riesgo hemorrágico
10. Riesgo infeccioso
11. Interconsulta requerida (mismo elemento que "Interconsulta médica" de [Datos de Exámenes Complementarios](#datos-de-exámenes-complementarios))
12. Apto para atención ambulatoria

## Datos de Examen Extraoral

- **Pertenece a:** Consulta
- **Fuente:** foto_3, sección "8. Examen extraoral".

Cada estructura tiene tres estados: **Normal / Alterado / No evaluado** (por defecto **No evaluado**). El **Hallazgo** (texto) es obligatorio solo en Alterado. Un botón **"Marcar todo como normal"** marca todas las estructuras de la sección como Normal.

1. Simetría facial
2. Ganglios
3. ATM / ruidos / dolor
4. Apertura bucal / desviación
5. Músculos masticatorios
6. Piel y labios

## Datos de Examen Intraoral

- **Pertenece a:** Consulta
- **Fuente:** foto_3, sección "9. Examen intraoral".

Mismo formato que el examen extraoral: estados **Normal / Alterado / No evaluado** (por defecto No evaluado), hallazgo obligatorio en Alterado y botón **"Marcar todo como normal"**.

1. Mucosa labial / yugal
2. Paladar / orofaringe
3. Lengua / piso de boca
4. Glándulas salivales / flujo
5. Frenillos
6. Encía / periodonto
7. Oclusión
8. Prótesis / aparatos

## Datos de Evaluación de Dolor y Riesgo

- **Pertenece a:** Consulta
- **Fuente:** foto_3, sección "10. Evaluación de dolor y riesgo".

**Dolor:**
1. Dolor EVA (escala de 0 a 10)
2. Localización
3. Tipo / duración / irradiación

**Riesgos** (se elige un solo nivel: Bajo / Moderado / Alto, más los factores en texto):
4. Riesgo de caries: nivel y factores
5. Riesgo periodontal: nivel y factores

## Datos de Exámenes Complementarios

- **Pertenece a:** Consulta o Historial Clínico, según cada documento.
- **Fuente:** foto_3, sección "11. Exámenes complementarios".

Cada examen puede tener documentos asociados, y cada documento se clasifica en:
- **Historial Clínico:** documento que se sube directamente a la historia del paciente (por ejemplo, una radiografía que el paciente ya trae).
- **Requerimiento de consulta:** examen que se solicita para una cirugía o consulta; el documento se sube cuando llega el resultado.

1. Radiografía periapical
2. Bitewing
3. Panorámica
4. CBCT
5. Fotografías clínicas
6. Modelos / escaneo intraoral
7. Pruebas pulpares
8. Laboratorio clínico
9. Interconsulta médica: mismo elemento que "Interconsulta requerida" de [Datos de Signos Vitales y Evaluación de Riesgo](#datos-de-signos-vitales-y-evaluación-de-riesgo). Debe estar en una página que permita ingresar el documento de análisis enviado por el especialista solicitado.
10. Biopsia / histopatología
11. Hallazgos relevantes (texto libre)

## Datos de Odontograma

- **Pertenece a:** Consulta
- **Fuente:** foto_4_1, sección "12. Odontograma gráfico – dentición permanente y temporal".

El papel marca las superficies comprometidas con colores y símbolos. El odontograma ya implementado cubre estos elementos; no es necesario modificarlo para que coincida con el papel por el momento.

| Elemento del papel | ¿Implementado? | Observación |
|---|---|---|
| Dentición permanente (18–48) | ✅ Sí | Numeración FDI. |
| Dentición temporal (51–85) | ⚠️ Soportado | Verificar que sea fácil de encontrar y usar en pantalla. |
| 5 superficies por pieza | ✅ Sí | Caries y obturaciones por superficie. |
| Rojo: caries / tratamiento requerido | ✅ Sí | Caries por superficie (escala ICDAS). |
| X roja: extracción indicada | ✅ Sí | "Extracción planificada". |
| Círculo / contorno: corona o prótesis fija | ✅ Sí | Varios tipos de corona y puente. |
| E: endodoncia | ✅ Sí | "Obturación radicular" y variantes. |
| S: sellante | ✅ Sí | "Sellado de fisuras". |
| Azul: tratamiento existente | ✅ Sí, con otra forma | El odontograma separa la vista **Estado** (lo existente) de la vista **Plan** (lo que se va a hacer), en lugar de usar rojo/azul. |
| X azul: pieza ausente | ✅ Sí | "Ausentes". |
| I: implante | ✅ Sí | "Implante". |
| F: fractura / fisura | ✅ Sí | "Fractura dental" y "Corona fracturada". |
| Otro | ✅ Sí | Muchas más condiciones y notas por pieza. |

**Registro complementario** (tabla del papel: pieza / región, diagnóstico / superficies, tratamiento propuesto, prioridad, y observaciones): no se implementa como tabla aparte. Se cubre con [Datos de Diagnósticos](#datos-de-diagnósticos) (pieza, diagnóstico y prioridad) y [Datos de Plan de Tratamiento por Fases](#datos-de-plan-de-tratamiento-por-fases) (tratamiento propuesto). Las observaciones ya existen en las notas de la visita y en las notas por pieza del odontograma.

## Datos de Diagnósticos

- **Pertenece a:** Consulta
- **Fuente:** foto_4, sección "13. Diagnósticos".

Lista sin límite de filas (el papel trae 5). Los diagnósticos se toman del odontograma.

1. N.°
2. Diagnóstico clínico / CIE-10
3. Pieza / región
4. Prioridad: Alta / Media / Baja

**Observación:** mapear qué diagnósticos ya registra el odontograma para verificar si ya están implementados o si hay que mostrarlos de forma más accesible.

## Datos de Pronóstico

- **Pertenece a:** Consulta
- **Fuente:** foto_4, sección "14. Pronóstico".

1. Pronóstico: Favorable / Reservado / Desfavorable / Depende de adherencia o control sistémico
2. Pronóstico general y por piezas (texto libre; también aparece en la sección 21)

**Observación:** el pronóstico depende del estado de las piezas en el odontograma. Mapear esa relación y definir después cómo implementarlo.

## Datos de Plan de Tratamiento por Fases

- **Pertenece a:** Consulta
- **Fuente:** foto_4, sección "15. Plan de tratamiento por fases".

Por cada fase: procedimientos, fecha prevista y costo / observaciones.

1. Urgencia
2. Sistémica / interconsulta
3. Higiénica / periodontal básica
4. Quirúrgica / implantológica
5. Restauradora / endodóntica
6. Protésica / ortodóncica
7. Mantenimiento

Las fases higiénica, quirúrgica y de mantenimiento también aparecen en la sección 21 ("Plan de fase higiénica, quirúrgica y mantenimiento").

**Observación:** la fase y la fecha prevista se agregan a cada ítem del plan de tratamiento actual, que ya se conecta con los tratamientos del paciente. Así, el compilado de la historia clínica reúne todos los registros realizados.

## Datos de Evolución Clínica

- **Pertenece a:** Consulta
- **Fuente:** foto_4, sección "16. Evolución clínica".

Columnas del registro (el papel trae 4 filas):

1. Fecha
2. Procedimiento / pieza
3. Materiales / anestesia / lote
4. Indicaciones y evolución
5. Firma

**Observación:** cada visita ya es una entrada de evolución. Cómo conectar estas columnas con las visitas o reutilizarlas se definirá después.

## Datos de Declaración de Veracidad

- **Pertenece a:** Historial Clínico
- **Fuente:** foto_4, sección "17. Declaración de veracidad del paciente".

Texto de la declaración: *"Declaro que la información suministrada es verdadera y completa. Me comprometo a informar cualquier cambio en mi estado de salud, medicamentos, embarazo, alergias o indicaciones médicas antes de cada atención."*

1. Aceptación de la declaración (casilla de verificación; elemento agregado)
2. Paciente / representante
3. C.I.
4. Firma del paciente
5. Fecha
6. Profesional tratante
7. Registro profesional (dato nuevo del profesional; hoy no existe en la app)
8. Firma / sello del profesional
9. Fecha

**Observación:** la forma de firmar se definirá a futuro.

## Datos de Antecedentes y Síntomas Periodontales

- **Pertenece a:** Historial Clínico
- **Fuente:** foto_5, sección "18. Antecedentes y síntomas periodontales".

1. Sangrado espontáneo
2. Sangrado al cepillado
3. Halitosis
4. Supuración
5. Movilidad: ya registrado en [Datos de Antecedentes Odontológicos](#datos-de-antecedentes-odontológicos) ("Movilidad dental"); no se repite.
6. Migración dentaria
7. Sensibilidad radicular
8. Dolor gingival
9. Pérdida dentaria por periodontitis
10. Tratamiento periodontal previo: ya registrado en [Datos de Antecedentes Odontológicos](#datos-de-antecedentes-odontológicos) ("Tratamiento periodontal"); no se repite.
11. Historia familiar de periodontitis
12. Tabaquismo / vapeo: ya registrado en [Datos de Hábitos y Factores de Riesgo](#datos-de-hábitos-y-factores-de-riesgo) ("Tabaco / vapeo"); no se repite.
13. Diabetes / HbA1c elevada: ya registrado en [Datos de Antecedentes Médicos](#datos-de-antecedentes-médicos) ("Diabetes mellitus"); no se repite.
14. Estrés / higiene deficiente: la parte de higiene ya está registrada en [Datos de Hábitos y Factores de Riesgo](#datos-de-hábitos-y-factores-de-riesgo) ("Higiene oral"); el estrés sí es un elemento nuevo.

## Datos de Índices Periodontales

- **Pertenece a:** Consulta
- **Fuente:** foto_5, sección "19. Índices y parámetros generales".

En el papel cada parámetro tiene tres columnas: Registro, Fecha inicial y Reevaluación.

1. Índice de placa (%)
2. Sangrado al sondaje (%)
3. Profundidad de sondaje máxima (mm)
4. Pérdida de inserción clínica máxima (mm)
5. Dientes presentes / perdidos por periodontitis
6. Defectos mucogingivales / recesiones
7. Movilidad / furcaciones

**Observación:** los índices se toman del periodontograma, no se escriben a mano. La app ya calcula varios (placa, sangrado al sondaje, recesiones, movilidad y furcación) y muestra su evolución por visita, que equivale a "Fecha inicial / Reevaluación". Falta mapear cuáles no se calculan todavía; por ejemplo, la profundidad de sondaje máxima y la pérdida de inserción clínica máxima.

## Datos de Diagnóstico Periodontal

- **Pertenece a:** Consulta
- **Fuente:** foto_5, sección "20. Diagnóstico periodontal 2017" (clasificación internacional de 2017).

En cada componente se elige una sola opción:

1. Salud gingival / gingivitis: Salud / Gingivitis inducida por biofilm / No inducida
2. Periodontitis: Estadio I / II / III / IV
3. Extensión: Localizada (<30%) / Generalizada / Patrón molar-incisivo
4. Grado: A / B / C
5. Estabilidad: Estable / En remisión o control / Inestable
6. Enfermedades periimplantarias (en general, no por implante): Salud / Mucositis / Periimplantitis / Deficiencia de tejidos

**Factores modificadores** (campos de texto separados):

7. Tabaquismo (relacionado con "Tabaco / vapeo" de [Datos de Hábitos y Factores de Riesgo](#datos-de-hábitos-y-factores-de-riesgo))
8. Diabetes / HbA1c (relacionado con "Diabetes mellitus" de [Datos de Antecedentes Médicos](#datos-de-antecedentes-médicos))
9. Otros

## Datos de Pronóstico Periodontal y Plan

- **Pertenece a:** Consulta
- **Fuente:** foto_5, sección "21. Pronóstico periodontal y plan".

1. Pronóstico general y por pieza: ya registrado en [Datos de Pronóstico](#datos-de-pronóstico); no se repite.
2. Plan de fase higiénica, quirúrgica y mantenimiento: ya registrado en [Datos de Plan de Tratamiento por Fases](#datos-de-plan-de-tratamiento-por-fases); no se repite.
3. Intervalo de mantenimiento: 3 meses / 4 meses / 6 meses / Otro (texto)
4. Fecha de reevaluación: es el mismo dato que el **próximo control** que ya tiene la visita; no se repite (también aparece en [Datos de Periodontograma](#datos-de-periodontograma)).
5. Objetivos de control (**objetivo a futuro**): Placa < ___ %, Sangrado < ___ %, PS residual objetivo ___ mm.

## Datos de Periodontograma

- **Pertenece a:** Consulta
- **Fuente:** foto_7, página 7 "Periodontograma integral — Registro gráfico periodontal".

**Encabezado:**

| Elemento del papel | Estado |
|---|---|
| Paciente, C.I. / pasaporte, Historia clínica, Edad, Teléfono, Ocupación | Ya registrado en [Datos del Cliente](#datos-del-cliente); no se repite. |
| Fecha | Ya registrado: es la fecha de la visita. |
| Examinador | Ya registrado: por ahora es solo el profesional de la visita. |
| Alerta médica | Ya registrado en [Datos de Alergias, Medicamentos y Alertas](#datos-de-alergias-medicamentos-y-alertas); no se repite. |
| Observaciones | Ya registrado: bastan las notas de la visita y las notas por pieza que ya tiene el sistema. |

**Registro gráfico:** 4 bloques (superior vestibular y palatino, piezas 18–28; inferior lingual y vestibular, piezas 48–38), cada uno con el dibujo de las piezas y una tabla por pieza. El periodontograma ya implementado cubre este registro:

| Elemento del papel | ¿Implementado? | Observación |
|---|---|---|
| 4 caras (vestibular / palatino superior, lingual / vestibular inferior) | ✅ Sí | Registro por cara y por sitio. |
| Signo | ⚠️ Por definir | Primera fila de cada tabla; falta definir qué se anota. |
| P.B.: profundidad de bolsa | ✅ Sí | |
| N.I.: nivel de inserción | ⚠️ Parcial | Se registra el margen gingival; el nivel de inserción se obtiene sumándolo a la profundidad, pero no se muestra como dato propio. Relacionado con la "pérdida de inserción clínica máxima" de [Datos de Índices Periodontales](#datos-de-índices-periodontales). |
| MOV.: movilidad (solo en caras vestibulares) | ✅ Sí | |
| SANGRA: sangrado al sondaje | ✅ Sí | También como porcentaje. |
| PLACA: biofilm visible | ✅ Sí | También como índice O'Leary. |
| CÁLCULO: cálculo detectable | ✅ Sí | |
| Trazo gráfico del margen y la bolsa | ✅ Sí | |
| Furcación | ➕ Extra | No está en el papel; el periodontograma la incluye. |

**Pie del registro:**

| Elemento del papel | Estado |
|---|---|
| Profesional (Dra. María Cristina Torres Paz, impreso) | Ya registrado: profesional de la visita. |
| Firma / sello profesional | Pendiente a futuro junto con las demás firmas. |
| Fecha de reevaluación | Ya registrado: es el próximo control de la visita. |

---

## Decisiones confirmadas

- **Edad:** se calcula a partir de la fecha de nacimiento.
- **Hospitalizaciones previas y Cirugías previas:** llevan un detalle en texto (cuál, cuándo).
- **Niega antecedentes relevantes:** es excluyente con el resto de antecedentes.
- **Bruxismo:** opciones Diurno / Nocturno / Ambos.
- **Higiene oral, elementos que usa:** la lista de opciones se creará a futuro.
- **Peso y talla:** dos campos (peso en kg y talla en cm).
- **Temperatura:** en °C.
- **Examen extraoral e intraoral:** tres estados por estructura (Normal / Alterado / No evaluado), con **No evaluado** por defecto; hallazgo obligatorio solo en Alterado; botón "Marcar todo como normal" por sección.
- **Riesgo de caries y periodontal:** se elige un solo nivel (Bajo / Moderado / Alto).
- **Exámenes complementarios:** cada documento se clasifica como Historial Clínico o Requerimiento de consulta.
- **Interconsulta:** "Interconsulta requerida" (sección 7) e "Interconsulta médica" (sección 11) son el mismo elemento, con carga del documento de análisis del especialista.
- **Odontograma:** el implementado cubre la sección 12; no se modifica para que coincida con la simbología del papel por el momento. El registro complementario se cubre con Diagnósticos y Plan de tratamiento.
- **Diagnósticos:** se toman del odontograma, sin límite de filas; prioridad Alta / Media / Baja.
- **Plan de tratamiento por fases:** fase y fecha prevista como parte de cada ítem del plan actual, conectado a los tratamientos del paciente.
- **Declaración de veracidad:** se agrega una casilla de aceptación; la firma se define a futuro.
- **Registro profesional:** se agrega como dato del profesional.
- **Elementos repetidos:** se implementan una sola vez y se marcan en ambas secciones.
- **Índices periodontales:** se toman del periodontograma; falta mapear los que todavía no se calculan.
- **Diagnóstico periodontal:** una opción por componente; factores modificadores como campos de texto separados; enfermedades periimplantarias en general.
- **Fecha de reevaluación:** es el mismo dato que el próximo control de la visita.
- **Objetivos de control:** quedan como objetivo a futuro.
- **Periodontograma:** el implementado cubre la página 7; el encabezado ya está registrado en otras secciones; el examinador es por ahora el profesional de la visita; las observaciones usan las notas que ya tiene el sistema.

## Puntos por confirmar

- **Odontograma, dentición temporal:** verificar que sea fácil de encontrar y usar en pantalla.
- **Pronóstico:** mapear su relación con el estado de las piezas en el odontograma.
- **Evolución clínica:** definir cómo conectar sus columnas con las visitas.
- **Firmas:** definir cómo se firma (paciente, profesional, evolución y periodontograma).
- **Periodontograma, fila "Signo":** definir qué se anota en esa fila.
- **Periodontograma, nivel de inserción:** mostrarlo como dato propio.

- **Datos del Cliente:** muchos de estos campos ya existen en el registro del paciente (módulo Pacientes). Definir si se editan desde el Historial Clínico, desde Pacientes o en ambos lugares sobre el mismo dato.
