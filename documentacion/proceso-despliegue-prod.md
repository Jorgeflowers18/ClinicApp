# Despliegue en el Droplet de DigitalOcean

En el Droplet:
- **nginx** está instalado directamente en el servidor: sirve el front (`/var/www/clinicapp`), atiende el HTTPS y redirige `/api` a la API.
- **La API y PostgreSQL** corren en Docker con `back/docker-compose.yml`. Los puertos de los dos quedan solo en `127.0.0.1`.

## Front: cada vez que hay cambios en main

```bash
cd /home/dental-test/ClinicApp
git pull
cd front
npm ci
npm run build
sudo rm -rf /var/www/clinicapp/*
sudo cp -r dist/. /var/www/clinicapp/
sudo chown -R www-data:www-data /var/www/clinicapp
```

## API: la primera vez

1. **Docker con el plugin de compose** (`docker compose version`). Ya está instalado si PostgreSQL corre en Docker.
2. **El archivo `back/.env` del servidor.** Se copia de `.env.example` y se completa:
   - `COMPOSE_PROFILES=api` (así `docker compose up -d` levanta también las migraciones y la API).
   - `POSTGRES_PASSWORD`: aleatoria, con `openssl rand -base64 32`, sin `;`.
   - `AUTH_SIGNING_KEY`: aleatoria, con `openssl rand -base64 48`.
   - `FRONTEND_URL`, por ejemplo `https://clinica.midominio.com`.
   - `ALLOWED_HOSTS`, por ejemplo `clinica.midominio.com;localhost;127.0.0.1`.
   - `SEED_ADMIN_EMAIL` y `SEED_ADMIN_PASSWORD`: el administrador inicial, con una contraseña de 12 caracteres o más.
3. **Proteger el `.env`:** `chmod 600 back/.env`. Lo lee solo su dueño y nunca se sube al repositorio.
4. **Levantar:** `cd back && docker compose up -d --build`.
   - Construye la imagen.
   - Aplica las migraciones (el servicio `migrate` termina con "Done.").
   - Arranca la API en `127.0.0.1:5000`.
5. **Después del primer ingreso:** borrar `SEED_ADMIN_EMAIL` y `SEED_ADMIN_PASSWORD` del `.env`. El resto de las cuentas se crean desde **Administración → Usuarios**.
6. **Configurar nginx:** agregar `/api` al bloque `server` del dominio (el HTTPS se configura con certbot):

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:5000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 25m;   # adjuntos de hasta 20 MB
}
```

La API confía en el `X-Forwarded-For` que llega desde la red de Docker (`DOCKER_SUBNET`, por defecto `172.30.0.0/24`). Gracias a eso ve la IP real de cada usuario, y el límite de intentos de inicio de sesión es por persona y no de toda la clínica.

## API: cada vez que hay cambios en main

```bash
cd /home/dental-test/ClinicApp
git pull
cd back
docker compose up -d --build     # reconstruye, aplica las migraciones nuevas y reinicia la API
docker image prune -f            # borra las imágenes viejas
```

Si las migraciones fallan, la API no se reinicia: sigue la versión anterior. Ver qué pasó con `docker compose logs migrate`.

## Respaldos

**Los respaldos no son opcionales: son historias clínicas.** Se respaldan dos cosas:
- **La base:** `docker exec clinicapp-db pg_dump -U clinicapp -Fc clinicapp > /var/backups/clinicapp/db-$(date +%F).dump` (diario, con cron).
- **Los adjuntos** (volumen `clinicapp_clinicapp-attachments`): `docker run --rm -v clinicapp_clinicapp-attachments:/data -v /var/backups/clinicapp:/backup alpine tar czf /backup/adjuntos-$(date +%F).tar.gz -C /data .`.

Copiar los respaldos fuera del Droplet (por ejemplo a DigitalOcean Spaces): si el Droplet se pierde, se pierden con él.

## Validar que todo está arriba

```bash
uname -r                      # debería mostrar 6.8.0-146-generic
systemctl is-active nginx     # debería decir active
free -h                       # el swap debería mostrar 2.0Gi
curl -s http://localhost | grep -o "<title>.*</title>"
cd /home/dental-test/ClinicApp/back && docker compose ps     # db (healthy), api (running), migrate (exited 0)
curl -s http://127.0.0.1:5000/api/health                    # Healthy
docker stats --no-stream                                    # memoria de cada contenedor
```
