# Decisiones del backend — ClinicApp

Decisiones de tecnología y base de datos para la API, tomadas a partir del análisis de la base de pacientes de la clínica y de los módulos del frontend. El reparto del trabajo está en [`back/backlog-desgloce.md`](../back/backlog-desgloce.md) y el detalle de los endpoints en [`back/backlog.md`](../back/backlog.md).

---

## 1. Tecnología: .NET 10 con ASP.NET Core Web API

| Decisión | Motivo |
|---|---|
| **.NET 10** | Es la versión LTS (soporte largo, hasta noviembre de 2028). Para un sistema que se va a mantener conviene más que una versión de soporte corto. |
| **ASP.NET Core Web API con controladores** (`[ApiController]`) | Cada módulo es una clase con sus endpoints, fácil de leer y de aprender. `[ApiController]` devuelve los errores `400` en el formato `ValidationProblemDetails`, que es el que ya espera el frontend (`shared/lib/http.ts`). |
| **Entity Framework Core** con migraciones | Las tablas se definen como clases de C# y los cambios del esquema quedan versionados en el repositorio. |
| **Un solo proyecto con carpetas por módulo** | La misma organización que `front/src/modules/`. Para el tamaño del sistema, separar en varios proyectos («Clean Architecture») agrega complejidad sin beneficio. Si un módulo crece mucho, se puede separar después. |
| **ASP.NET Core Identity + JWT** | Usuarios, contraseñas cifradas y roles con la librería oficial, sin programar la seguridad de contraseñas a mano. Se implementa en la fase 0 junto con `auth`. |
| **Prefijo `/api` y puerto `5000` en desarrollo** | Coincide con `VITE_API_BASE_URL=http://localhost:5000/api` del frontend. |

## 2. Base de datos: PostgreSQL en Docker

| Opción | Veredicto | Motivo |
|---|---|---|
| **PostgreSQL** | ✅ Elegida | Gratis, liviana, muy bien soportada por EF Core (Npgsql). Tiene columnas `jsonb` para guardar estructuras anidadas. |
| SQL Server Express | ❌ | En Linux pide mínimo 2 GB de RAM y limita cada base a 10 GB. Demasiado para el Droplet. |
| SQLite | ❌ | Un solo escritor a la vez, migraciones limitadas y poco soporte de JSON. Solo sirve para prototipos. |
| MySQL | ❌ | Sin ventaja frente a PostgreSQL; su soporte de JSON en EF Core es más pobre. |

**Cómo se usa PostgreSQL:**
- **Tablas relacionales** para lo que se busca, filtra o suma: pacientes, citas, profesionales, tratamientos, inventario, pagos.
- **Columnas `jsonb`** para las estructuras anidadas de la historia clínica que el frontend ya maneja como un solo objeto: odontograma, periodontograma, antecedentes y la evaluación de cada atención. Así no hace falta una tabla por cada casilla del formulario.
- **Nombres en minúsculas con guion bajo** (`snake_case`, por ejemplo `treatment_assignments`), la convención de PostgreSQL, para no tener que escribir los nombres entre comillas en SQL.
- **Identificadores UUID**, porque el frontend ya genera UUID para atenciones y tratamientos propuestos.

**Docker:**
- **En desarrollo**, PostgreSQL corre en un contenedor de Docker (`back/docker-compose.yml`) que se levanta y se apaga cuando se necesita. Los datos se guardan en un volumen y no se pierden al apagar el contenedor.
- **En producción**, PostgreSQL también corre en Docker en el mismo Droplet, sin exponer su puerto a internet.

## 3. Despliegue

- **API:** corre en el mismo Droplet de DigitalOcean que el frontend, como servicio del sistema, con nginx delante: `/` sirve el frontend y `/api` se redirige a la API.
- **Memoria:** la API y PostgreSQL usan juntas unos 300–400 MB de RAM. Hay que revisar la memoria del Droplet (`free -h`): con 1 GB funciona gracias al swap de 2 GB y con 2 GB va holgado.
- **HTTPS con dominio:** es necesario antes de salir a producción con datos reales. La cookie de sesión (`httpOnly`, `Secure`) no funciona por HTTP en una IP.
- **Respaldos:** `pg_dump` diario programado, además de los backups del Droplet. Se trata de historias clínicas: los respaldos no son opcionales.
- **Adjuntos** (radiografías, fotos, PDF): por ahora en el disco del Droplet, dentro de los respaldos. Si crecen mucho, se pasan a DigitalOcean Spaces.
- **Zona horaria de la clínica:** Ecuador (UTC−5). Las fechas se guardan en UTC y los reportes se calculan en la hora de la clínica.

## 4. Análisis de la base de pacientes actual

Base exportada por la clínica (`documentacion/Pacientes 1.csv`). El archivo tiene datos personales reales: está excluido del repositorio en `.gitignore` y no se copia a ningún otro lugar.

**Volumen:** 820 pacientes. Es muy poco para cualquier base de datos, incluso multiplicado por 100. Lo que más va a crecer son los adjuntos, no las tablas.

| Año de la última cita | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 | Sin cita |
|---|---|---|---|---|---|---|---|
| Pacientes | 3 | 117 | 89 | 80 | 119 | 226 | 186 |

**Correspondencia con los campos de la app:**

| Columna del archivo | Campo de la app | Calidad de los datos |
|---|---|---|
| Ficha | N.° de historia clínica | Del 0 al 825, sin repetidos. |
| Nombre | Nombres y Apellidos | Un solo campo. 184 nombres tienen 29 o 30 letras: el sistema anterior los cortó a 30 caracteres. Separar nombres de apellidos es ambiguo («del Cisne»). |
| N.° Id | Cédula / pasaporte | 647 tienen 10 dígitos (631 son cédulas válidas). 173 no son cédulas (de 1 a 9 dígitos). 25 están repetidas. |
| Género | Sexo / género | Mujer 481, Hombre 337. |
| F.Nac | Fecha de nacimiento | 816 correctas; 4 con errores (por ejemplo, el año 1688). |
| Edad | — | Se descarta: la app la calcula. |
| Teléfono1 | Teléfono | 755 celulares válidos (92 %). 41 vacíos o con menos de 7 dígitos. |
| Teléfono2 | — | Solo 37 pacientes. |
| Correo | Correo | Solo 31 pacientes (4 %). |
| Dirección | Dirección | 149 pacientes. |
| ultimacita | Última visita | 634 con fecha y hora. |
| Especialidad | — (no existe en la app) | Od. General 659, Ortodoncia 63, Endodoncia 44, Odontopediatría 21, Cirugía 17, Prótesis 13, Periodoncia 1. |
| Observaciones | Notas | 59 pacientes, textos cortos de tratamiento. |

El archivo está en codificación Latin-1 (no UTF-8) y tiene 2 filas mal formadas.

**Consecuencias para el diseño:**
- **El número de ficha identifica al paciente**, no la cédula. La cédula no puede ser obligatoria ni única en la base de datos mientras haya repetidas y valores de relleno.
- **Importación de una sola vez** con un script propio: lee Latin-1, limpia los datos y marca a los pacientes incompletos como «datos por completar». No puede usar las mismas validaciones que el formulario de alta.
- **Notificaciones:** con solo 4 % de correos, el aviso por email casi no llega. El canal útil es el celular (SMS o WhatsApp).

## 5. Por confirmar con la clínica

1. **Número de ficha:** ¿se conserva como N.° de historia clínica (Ficha 4 → `HC-000004`) y los pacientes nuevos siguen desde el 826? Es lo recomendado.
2. **Nombres cortados y cédulas de relleno:** ¿se importan como están, para que la clínica los corrija con el tiempo, o se revisan antes de importar?
3. **Especialidad y Observaciones:** ¿pasan a las notas del paciente o la especialidad debe ser un dato propio?
4. **Segundo teléfono:** ¿se agrega el campo en la app o va a las notas?
5. **Canal de notificaciones:** ¿SMS o WhatsApp?
