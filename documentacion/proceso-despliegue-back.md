# Despliegue del backend (API .NET + PostgreSQL)

Cómo se empaqueta y se despliega el backend en el VPS, y qué hacer cuando algo falla. La guía completa del servidor (preparar el Droplet, nginx, HTTPS, publicar el front y el primer ingreso) está en [`proceso-despliegue-prod.md`](./proceso-despliegue-prod.md). Este documento cubre la parte del backend en detalle.

## 1. Piezas

| Archivo | Qué hace |
|---|---|
| [`back/Dockerfile`](../back/Dockerfile) | Construye la imagen de la API y la del bundle de migraciones. |
| [`back/docker-compose.yml`](../back/docker-compose.yml) | Define los servicios `db`, `migrate` y `api`, los volúmenes y la red. |
| [`back/.env.example`](../back/.env.example) | Plantilla del `back/.env`: en desarrollo, solo la base; en el servidor, también los secretos. |
| [`back/.dockerignore`](../back/.dockerignore) | Deja fuera de la imagen las pruebas, la documentación, `bin/`/`obj/`, el `.env` y `App_Data/`. |

### Etapas del `Dockerfile`

| Etapa | Imagen base | Contenido |
|---|---|---|
| `build` | `mcr.microsoft.com/dotnet/sdk:10.0` | Restaura, publica la API en Release y genera el bundle de migraciones (`dotnet ef migrations bundle`). No llega al servidor como contenedor. |
| `migrate` | `mcr.microsoft.com/dotnet/aspnet:10.0` | Solo el ejecutable `efbundle`: aplica las migraciones pendientes y termina. |
| `api` | `mcr.microsoft.com/dotnet/aspnet:10.0` | La API publicada, sin SDK, con el usuario sin privilegios `app` (uid 1654), escuchando en el puerto 8080. |

**Notas sobre la imagen:**
- **Sin `global.json`:** el `global.json` fija la versión exacta del SDK de los equipos de desarrollo (10.0.404), y la imagen trae otra banda del mismo .NET 10.
- **Primero el `.csproj`:** se copia antes que el código, así Docker reutiliza la capa de paquetes mientras no cambien las dependencias.

### Servicios del compose

| Servicio | Perfil | Qué hace | Puerto en el VPS |
|---|---|---|---|
| `db` | siempre | PostgreSQL 17 (`clinicapp-db`). Volumen `clinicapp-pgdata`. | `127.0.0.1:${POSTGRES_PORT}` (5433) |
| `migrate` | `api` | Corre `efbundle` y termina. Espera a que `db` esté sana. | — |
| `api` | `api` | La API. Arranca solo si `migrate` terminó bien. Volumen `clinicapp-attachments` en `/app/data/attachments`. | `127.0.0.1:${API_PORT}` (5000) → 8080 |

- **Desarrollo:** sin `COMPOSE_PROFILES`, `docker compose up -d` levanta solo `db`, y la API se corre con `dotnet run`.
- **Servidor:** `COMPOSE_PROFILES=api` en el `.env` hace que levante los tres servicios.

**Red `backend`:** la subred es fija (`DOCKER_SUBNET`, por defecto `172.30.0.0/24`) por dos motivos:
- la API llega a la base por el nombre `db`, sin pasar por un puerto publicado;
- la API confía en el `X-Forwarded-For` de esa red. nginx, que está en el VPS, llega por el puerto publicado, y la API lo ve como la puerta de enlace de la red.

**Puertos:** los dos se publican solo en `127.0.0.1`, porque Docker se salta `ufw` y un puerto publicado sin IP quedaría abierto a internet.

**Recursos:**
- **Memoria:** `mem_limit` de 512 MB por servicio (`API_MEM_LIMIT` y `DB_MEM_LIMIT`). La API usa el GC de estación de trabajo (`DOTNET_gcServer=0`): en reposo ocupa unos 85 MB y la base unos 40 MB.
- **Logs:** tienen tope de 5 archivos de 10 MB por contenedor.

## 2. Configuración: del `.env` a la API

La API lee su configuración de `appsettings.json` más las variables de entorno. El `__` equivale a `:`: `Auth__SigningKey` es `Auth:SigningKey`. El compose arma esas variables a partir de `back/.env`:

| En `back/.env` | Variable en el contenedor | Clave de configuración | Notas |
|---|---|---|---|
| — | `ASPNETCORE_ENVIRONMENT=Production` | — | Fija en el compose. |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | `ConnectionStrings__Default` | `ConnectionStrings:Default` | `Host=db;Port=5432;...`. La contraseña no puede llevar `;`. |
| `AUTH_SIGNING_KEY` | `Auth__SigningKey` | `Auth:SigningKey` | Obligatoria, de 32 caracteres o más: sin ella la API no arranca. |
| `FRONTEND_URL` | `Auth__FrontendBaseUrl`, `Cors__AllowedOrigins__0` | `Auth:FrontendBaseUrl`, `Cors:AllowedOrigins` | Obligatoria: con ella se arman los enlaces para elegir la contraseña. |
| `ALLOWED_HOSTS` | `AllowedHosts` | `AllowedHosts` | Por defecto `*`. |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_ADMIN_NAME` | `Seed__AdminEmail`, ... | `Seed:*` | Crea el admin inicial si ese correo no existe (contraseña de 12 caracteres o más). Se borran después del primer ingreso. |
| — | `Attachments__RootPath=/app/data/attachments` | `Attachments:RootPath` | Fija: es donde se monta el volumen. |
| `NOTIFICATIONS_PROVIDER` | `Notifications__Provider` | `Notifications:Provider` | Vacío: no se envía ni se registra nada. |
| `DOCKER_SUBNET` | `ForwardedHeaders__KnownNetworks__0` | `ForwardedHeaders:KnownNetworks` | Red en la que se confía para el `X-Forwarded-For`. |
| — | `TZ=America/Guayaquil` | — | La zona de la clínica para los cálculos es `Clinic:TimeZone` (`appsettings.json`). |

**Qué va en `appsettings.json` y no en el `.env`:** lo que no es secreto ni cambia por servidor.
- vida de los tokens: 15 minutos el access token; 7 días con "Recordarme"; 12 horas sin él;
- vida de los enlaces: 60 minutos el de recuperación y 72 horas el que genera el admin;
- zona horaria e intervalos de las tareas en segundo plano.

Si hace falta cambiar alguno solo en el servidor, se puede agregar al `environment:` del servicio `api` (por ejemplo `Auth__RefreshTokenDays: "14"`) sin tocar el código.

**Qué cambia con `Production`:**
- no se publican `/openapi/v1.json` ni Scalar;
- no se crean las cuentas de prueba (`admin@clinica.com`, etc.);
- los errores 500 no muestran el detalle: se registra en el log junto al `traceId`.

## 3. Primer despliegue (resumen)

Detalle y valores en [`proceso-despliegue-prod.md`](./proceso-despliegue-prod.md) §§ 3 y 4.

```bash
cd /home/dental-test/ClinicApp/back
cp .env.example .env && nano .env && chmod 600 .env    # COMPOSE_PROFILES=api y los secretos
docker compose up -d --build
docker compose ps                          # db: healthy · migrate: exited (0) · api: running
docker compose logs migrate | tail -3      # ... Done.
curl -s http://127.0.0.1:5000/api/health   # Healthy
```

## 4. Migraciones

**Al cambiar el modelo** (en desarrollo):
1. Crear la migración con `dotnet ef migrations add <Nombre> --project src/ClinicApp.Api`.
2. Probarla con `dotnet ef database update` y con las pruebas.
3. Hacer commit.

**En el servidor no hay que hacer nada aparte:** en cada despliegue, `migrate` aplica las migraciones pendientes antes de que arranque la API nueva. Si no hay ninguna, dice "No migrations were applied" y termina.

```bash
docker compose run --rm migrate      # aplicar las migraciones sin reiniciar la API
docker compose logs migrate          # qué hizo la última vez
```

**Antes de desplegar una migración que borra o transforma datos,** respaldar la base (`/usr/local/bin/clinicapp-backup.sh`). Las migraciones no se deshacen solas.

## 5. Actualizar

```bash
cd /home/dental-test/ClinicApp && git pull
cd back
/usr/local/bin/clinicapp-backup.sh     # respaldo previo (recomendado)
docker compose up -d --build           # reconstruye, migra y reinicia solo lo que cambió
docker image prune -f                  # borra las imágenes viejas
```

**Qué pasa durante la actualización:**
- **Si `migrate` falla,** `api` no se reinicia y sigue corriendo la versión anterior.
- **Corte del servicio:** mientras se recrea el contenedor de la API, el servicio se corta unos segundos.

**Volver a una versión anterior:**
1. `git checkout <commit>`
2. `docker compose up -d --build`
3. Si la versión nueva había cambiado la base, restaurar el respaldo previo: [`proceso-despliegue-prod.md`](./proceso-despliegue-prod.md) § 8.

## 6. Probar la imagen antes de desplegar

Para comprobar en la propia computadora que la imagen funciona (migraciones, configuración de producción, adjuntos):

1. **En `back/.env`, agregar:**
   - `AUTH_SIGNING_KEY`: una clave de prueba de 32 caracteres o más;
   - `FRONTEND_URL=http://localhost:5173`;
   - `API_PORT=5001` (si `dotnet run` ya usa el 5000).
2. **Levantar:** `docker compose --profile api up -d --build`.
3. **Probar:** `curl http://127.0.0.1:5001/api/health`.
4. **Apagar** la API y el bundle con `docker compose --profile api stop api migrate`, y quitar esas líneas del `.env`.

**Ojo:**
- Usa la **misma base de desarrollo** (`clinicapp-db`): las migraciones se aplican ahí, igual que con `dotnet ef database update`.
- En modo `Production` no existen las cuentas de prueba: para entrar, poner también `SEED_ADMIN_*`.

## 7. Operación diaria

```bash
cd /home/dental-test/ClinicApp/back
docker compose ps                                   # estado de los servicios
docker compose logs -f --tail 100 api               # logs de la API en vivo
docker compose restart api                          # reiniciar solo la API
docker stats --no-stream                            # memoria y CPU
docker exec -it clinicapp-db psql -U clinicapp -d clinicapp    # consola SQL
```

Respaldos y restauración de la base y de los adjuntos: [`proceso-despliegue-prod.md`](./proceso-despliegue-prod.md) § 8.

## 8. Problemas comunes

| Síntoma | Causa y solución |
|---|---|
| `api` se reinicia en bucle y el log dice "Falta 'Auth:SigningKey'" o "Falta 'Auth:FrontendBaseUrl'". | Faltan `AUTH_SIGNING_KEY` o `FRONTEND_URL` en `back/.env` (o la clave tiene menos de 32 caracteres). Corregirlos y correr `docker compose up -d`. |
| `migrate` termina con error y `api` no arranca. | `docker compose logs migrate` muestra la migración y el error de PostgreSQL. Corregir, volver a desplegar o restaurar el respaldo. |
| Se cambió `POSTGRES_PASSWORD` en el `.env` y ahora la API no entra a la base. | PostgreSQL toma la contraseña **solo al crear el volumen**. Volver a la contraseña anterior, o cambiarla también en la base: `docker exec -it clinicapp-db psql -U clinicapp -d clinicapp -c "ALTER USER clinicapp PASSWORD 'nueva';"` y después `docker compose up -d`. |
| No se creó el administrador inicial. | `SEED_ADMIN_PASSWORD` tiene menos de 12 caracteres (`docker compose logs api` lo dice), o ese correo ya existe. |
| Todos los usuarios reciben "Demasiados intentos" a la vez. | La API no ve la IP real. Revisar que nginx mande `X-Forwarded-For` y que `DOCKER_SUBNET` sea la subred de la red `clinicapp_backend` (`docker network inspect clinicapp_backend`). |
| "ports are not available" al levantar. | Otro proceso usa el puerto: `sudo ss -ltnp \| grep 5000`. Cambiar `API_PORT` (y el `proxy_pass` de nginx) o `POSTGRES_PORT`. |
| Docker rechaza la red porque la subred se superpone con otra. | Cambiar `DOCKER_SUBNET` a un rango libre (por ejemplo `172.31.0.0/24`) y correr `docker compose up -d`. |
| La sesión se pierde al recargar o el login no guarda la cookie. | Falta HTTPS: la cookie de renovación es `Secure`. También puede ser que nginx no mande `X-Forwarded-Proto`. |
| Un adjunto no se puede subir. | Si son más de 20 MB, es el límite de la API. Si nginx responde 413, falta `client_max_body_size 25m` en el bloque `/api/`. |

## 9. Seguridad del backend

- `back/.env` con `chmod 600` y nunca en el repositorio, igual que `back/.dockerignore` lo deja fuera de la imagen.
- La API corre sin privilegios (usuario `app`), y la base y la API solo escuchan en `127.0.0.1`.
- **Si cambia `AUTH_SIGNING_KEY`, se cierran todas las sesiones.** Sirve para expulsar a todos si se filtró la clave.
- **Respaldos:** la base y los adjuntos tienen datos de salud. Los respaldos deben copiarse fuera del Droplet y probarse restaurando al menos una vez.
