# Despliegue en producción (Droplet de DigitalOcean)

Cómo levantar ClinicApp en el VPS desde cero, qué hay que configurar a mano en el servidor y cómo se actualiza después. El detalle del backend (imagen, variables de la API, migraciones y problemas comunes) está en [`proceso-despliegue-back.md`](./proceso-despliegue-back.md).

## Cómo queda armado

```text
Internet ──HTTPS──> nginx (instalado en el VPS)
                     ├── /       archivos del front (/var/www/clinicapp)
                     └── /api/   ──> 127.0.0.1:5000 ──> contenedor "api" (.NET)
                                                          └── red interna de Docker ──> contenedor "db" (PostgreSQL)
```

- **nginx** atiende el HTTPS (certificado de Let's Encrypt), sirve el front y redirige `/api` a la API.
- **La API y PostgreSQL** corren en Docker con `back/docker-compose.yml`. Los puertos quedan solo en `127.0.0.1`: desde internet únicamente se llega a nginx.
- **Los datos** quedan en dos volúmenes de Docker que sobreviven a las actualizaciones:
  - `clinicapp_clinicapp-pgdata`: la base.
  - `clinicapp_clinicapp-attachments`: radiografías, fotos y PDF de la historia clínica.

Rutas que usa esta guía:
- **Repositorio:** `/home/dental-test/ClinicApp`.
- **Front publicado:** `/var/www/clinicapp`.
- **Respaldos:** `/var/backups/clinicapp`.

Si alguna cambia, hay que cambiarla también en los comandos.

---

## 1. Preparar el servidor (una sola vez)

**Antes de empezar hace falta:**
- Un Droplet con Ubuntu 24.04. Lo recomendado son 2 GB de RAM; con 1 GB funciona si tiene swap.
- Acceso por SSH con llave.
- Un dominio con un registro `A` que apunte a la IP del Droplet, por ejemplo `clinica.midominio.com`. Sin dominio no hay HTTPS, y sin HTTPS la sesión no funciona, porque la cookie de renovación es `Secure`.

```bash
# Sistema al día
sudo apt update && sudo apt upgrade -y

# Swap de 2 GB (si el Droplet tiene 1 GB de RAM y todavía no lo tiene: "free -h" lo muestra)
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Firewall: solo SSH, HTTP y HTTPS
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable

# nginx y certbot (HTTPS)
sudo apt install -y nginx certbot python3-certbot-nginx git

# Docker Engine con el plugin de compose (repositorio oficial de Docker)
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list
sudo apt update && sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER     # para usar docker sin sudo (cerrar y volver a abrir la sesión SSH)

# Node.js 22 LTS para compilar el front
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

**Importante:** Docker se salta el firewall (`ufw`) cuando publica un puerto. Por eso el compose publica la base y la API solo en `127.0.0.1`. No hay que cambiar eso.

## 2. Descargar el código

```bash
cd /home/dental-test
git clone https://github.com/Jorgeflowers18/ClinicApp.git
cd ClinicApp
git checkout main
```

## 3. Variables que se configuran en el VPS

Son dos archivos que **solo existen en el servidor**. Ninguno de los dos se sube al repositorio.

### 3.1 `back/.env`: base, API y secretos

```bash
cd /home/dental-test/ClinicApp/back
cp .env.example .env
nano .env          # completar con la tabla de abajo
chmod 600 .env     # solo lo lee su dueño
```

| Variable | Qué poner en producción | Cómo obtenerlo |
|---|---|---|
| `COMPOSE_PROFILES` | `api` (descomentarla). Así `docker compose up -d` levanta también las migraciones y la API. | — |
| `POSTGRES_DB` | `clinicapp` | — |
| `POSTGRES_USER` | `clinicapp` | — |
| `POSTGRES_PASSWORD` | Contraseña larga y aleatoria, **sin `;`** (va dentro de la cadena de conexión). | `openssl rand -base64 32 \| tr -d '/+=;'` |
| `POSTGRES_PORT` | `5433`. Solo se usa para entrar a la base desde el propio servidor. | — |
| `AUTH_SIGNING_KEY` | Clave aleatoria de 48 bytes o más. Si cambia, se cierran todas las sesiones. | `openssl rand -base64 48` |
| `FRONTEND_URL` | La URL pública, sin `/` al final: `https://clinica.midominio.com`. Arma los enlaces de contraseña. | — |
| `ALLOWED_HOSTS` | `clinica.midominio.com;localhost;127.0.0.1` | — |
| `SEED_ADMIN_EMAIL` | El correo del primer administrador. | — |
| `SEED_ADMIN_PASSWORD` | Su contraseña inicial, de 12 caracteres o más. **Se borra después del primer ingreso** (paso 7). | — |
| `SEED_ADMIN_NAME` | Su nombre, por ejemplo `María Torres`. | — |
| `API_PORT` | `5000` (nginx redirige ahí). | — |
| `API_MEM_LIMIT` / `DB_MEM_LIMIT` | `512m` cada uno con 1–2 GB de RAM. | — |
| `DOCKER_SUBNET` | `172.30.0.0/24`. Cambiarla solo si `docker network ls` muestra otra red con ese rango. | — |
| `NOTIFICATIONS_PROVIDER` | Vacío. Todavía no hay proveedor de envío (WhatsApp más adelante). | — |
| `API_IMAGE` / `API_IMAGE_TAG` | Sin tocar: la imagen se construye en el servidor. | — |

Lo que **no** va en el `.env` porque no es secreto ni cambia por servidor (vida de los tokens, zona horaria, intervalos de tareas) está en `back/src/ClinicApp.Api/appsettings.json`.

**Guardar una copia de `POSTGRES_PASSWORD` y `AUTH_SIGNING_KEY` en un gestor de contraseñas.** Sin la contraseña de la base no se pueden restaurar los respaldos en otro servidor.

### 3.2 `front/.env.production.local`: la dirección de la API para el front

El front lee la dirección de la API **al compilarse**. Sin este archivo usaría `http://localhost:5000/api` y no funcionaría en producción.

```bash
cd /home/dental-test/ClinicApp/front
echo "VITE_API_BASE_URL=/api" > .env.production.local
```

`/api` es relativo: el front y la API están en el mismo dominio, detrás de nginx. Git ignora `*.local`, así que `git pull` no lo toca.

## 4. Levantar la base y la API

```bash
cd /home/dental-test/ClinicApp/back
docker compose up -d --build
```

Primero construye la imagen (la primera vez tarda unos minutos). Después:
1. **db:** espera a que PostgreSQL esté listo.
2. **migrate:** aplica todas las migraciones y termina con "Done.".
3. **api:** arranca la API en `127.0.0.1:5000`. Al iniciar crea el administrador de `SEED_ADMIN_*`, si ese correo no existe.

**Comprobar:**

```bash
docker compose ps                          # db: healthy · migrate: exited (0) · api: running
docker compose logs migrate | tail -3      # ... Done.
curl -s http://127.0.0.1:5000/api/health   # Healthy
```

## 5. Compilar y publicar el front

```bash
cd /home/dental-test/ClinicApp/front
npm ci
npm run build
sudo mkdir -p /var/www/clinicapp
sudo rm -rf /var/www/clinicapp/*
sudo cp -r dist/. /var/www/clinicapp/
sudo chown -R www-data:www-data /var/www/clinicapp
```

## 6. nginx y HTTPS

Crear `/etc/nginx/sites-available/clinicapp` (cambiando el dominio):

```nginx
server {
    listen 80;
    server_name clinica.midominio.com;

    root /var/www/clinicapp;
    index index.html;

    # API: solo nginx llega a ella (127.0.0.1).
    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 25m;   # adjuntos de hasta 20 MB
    }

    # Archivos con hash en el nombre: se pueden guardar en caché mucho tiempo.
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Front (SPA): cualquier otra ruta devuelve index.html.
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/clinicapp /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

# Certificado HTTPS y redirección de http a https (pide un correo para avisos de vencimiento)
sudo certbot --nginx -d clinica.midominio.com --redirect
```

certbot agrega el bloque `listen 443 ssl` y renueva el certificado solo (`systemctl list-timers | grep certbot`).

**IP real de los usuarios:** la API confía en el `X-Forwarded-For` que llega desde la red de Docker (`DOCKER_SUBNET`). Así el límite de intentos de inicio de sesión es por persona y no de toda la clínica. Para eso nginx debe mandar los dos encabezados `X-Forwarded-*` de arriba.

## 7. Primer ingreso

1. Abrir `https://clinica.midominio.com` e iniciar sesión con `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`.
2. Completar el perfil y el **Perfil institucional** (nombre, logo y sedes).
3. En **Administración**, en este orden:
   1. crear los **Profesionales** y **Consultorios**;
   2. crear las cuentas en **Usuarios**. Cada cuenta nueva muestra un enlace para que la persona elija su contraseña; se lo pasa el administrador.
4. Borrar `SEED_ADMIN_EMAIL` y `SEED_ADMIN_PASSWORD` de `back/.env` y aplicar con `docker compose up -d`.

## 8. Respaldos (obligatorios: son historias clínicas)

Se respaldan **la base y los adjuntos**, todos los días. Crear `/usr/local/bin/clinicapp-backup.sh`:

```bash
#!/bin/sh
set -e
DEST=/var/backups/clinicapp
DAY=$(date +%F)
mkdir -p "$DEST"
docker exec clinicapp-db pg_dump -U clinicapp -Fc clinicapp > "$DEST/db-$DAY.dump"
docker run --rm -v clinicapp_clinicapp-attachments:/data:ro -v "$DEST":/backup alpine \
  tar czf "/backup/adjuntos-$DAY.tar.gz" -C /data .
find "$DEST" -type f -mtime +14 -delete     # conserva 14 días
```

```bash
sudo chmod 700 /usr/local/bin/clinicapp-backup.sh
sudo crontab -e      # agregar: 30 2 * * * /usr/local/bin/clinicapp-backup.sh
```

**Copia fuera del Droplet:** si el Droplet se pierde, se pierden también los respaldos que están en él. Hay que copiar `/var/backups/clinicapp` todos los días, por ejemplo a DigitalOcean Spaces con `rclone`. Activar además los backups semanales del Droplet en el panel de DigitalOcean.

**Restaurar:**

```bash
cd /home/dental-test/ClinicApp/back
docker compose stop api
docker exec -i clinicapp-db pg_restore -U clinicapp -d clinicapp --clean --if-exists < /var/backups/clinicapp/db-AAAA-MM-DD.dump
docker run --rm -v clinicapp_clinicapp-attachments:/data -v /var/backups/clinicapp:/backup alpine \
  sh -c "rm -rf /data/* && tar xzf /backup/adjuntos-AAAA-MM-DD.tar.gz -C /data"
docker compose up -d
```

## 9. Actualizar cuando hay cambios en main

**API** (aplica sola las migraciones nuevas):

```bash
cd /home/dental-test/ClinicApp
git pull
cd back
docker compose up -d --build
docker image prune -f        # borra las imágenes viejas
```

**Si las migraciones fallan, la API no se reinicia:** sigue la versión anterior. Ver qué pasó con `docker compose logs migrate`.

**Front:** repetir el paso 5 (`git pull` ya está hecho).

**Volver a una versión anterior:**
1. `git checkout <commit>`
2. `docker compose up -d --build`

Las migraciones no se deshacen solas: si la versión nueva cambió la base, restaurar el respaldo de antes de actualizar (paso 8). Por eso conviene correr `clinicapp-backup.sh` a mano antes de cada actualización.

## 10. Validar que todo está arriba

```bash
uname -r                                     # kernel del Droplet (6.8.x en Ubuntu 24.04)
free -h                                      # memoria y swap (2.0Gi de swap con 1 GB de RAM)
systemctl is-active nginx                    # active
curl -s http://localhost | grep -o "<title>.*</title>"
cd /home/dental-test/ClinicApp/back && docker compose ps    # db (healthy), api (running), migrate (exited 0)
curl -s http://127.0.0.1:5000/api/health                    # Healthy
docker stats --no-stream                                    # memoria de cada contenedor
docker compose logs --tail 50 api                           # últimos mensajes de la API
sudo certbot certificates                                   # vencimiento del certificado
ls -lh /var/backups/clinicapp | tail -4                     # respaldos de los últimos días
```

## Lista de seguridad

- [ ] `back/.env` con `chmod 600`; `POSTGRES_PASSWORD` y `AUTH_SIGNING_KEY` aleatorias y guardadas en un gestor de contraseñas.
- [ ] `SEED_ADMIN_*` borradas después del primer ingreso.
- [ ] `ufw` activo con solo SSH, 80 y 443. `docker compose ps` muestra los puertos de db y api en `127.0.0.1`.
- [ ] HTTPS con redirección desde http (certbot `--redirect`).
- [ ] Respaldos diarios funcionando **y copiados fuera del Droplet**. Probar una restauración al menos una vez.
- [ ] SSH solo con llave: `PasswordAuthentication no` en `/etc/ssh/sshd_config`.
