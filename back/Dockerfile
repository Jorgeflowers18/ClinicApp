# Imagen de la API de ClinicApp (y de sus migraciones). La usa docker-compose.yml con el perfil "api".
#
#   Construir:  docker compose --profile api build      (desde la carpeta back/)
#
# Tres etapas:
#   build    compila la API y el "bundle" de migraciones con el SDK (no llega al servidor).
#   migrate  solo el bundle: aplica las migraciones pendientes y termina.
#   api      la API publicada, sobre la imagen de ASP.NET (sin SDK), con un usuario sin privilegios.

# ─────────────── build ───────────────
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Sin global.json: fija la versión exacta del SDK de los equipos de desarrollo, y la imagen trae otra banda
# del mismo .NET 10.
COPY dotnet-tools.json ./
RUN dotnet tool restore

# Primero solo el .csproj: mientras no cambien los paquetes, Docker reutiliza esta capa y no los descarga.
COPY src/ClinicApp.Api/ClinicApp.Api.csproj src/ClinicApp.Api/
RUN dotnet restore src/ClinicApp.Api/ClinicApp.Api.csproj

COPY src/ClinicApp.Api/ src/ClinicApp.Api/
RUN dotnet publish src/ClinicApp.Api/ClinicApp.Api.csproj -c Release -o /out/api --no-restore -p:UseAppHost=false

# Ejecutable que aplica las migraciones pendientes (no necesita el SDK en el servidor).
RUN dotnet ef migrations bundle --project src/ClinicApp.Api --configuration Release --output /out/efbundle --verbose

# ─────────────── migrate ───────────────
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS migrate
WORKDIR /migrate
COPY --from=build /out/efbundle ./efbundle
USER $APP_UID
# Toma la cadena de conexión y la configuración de las variables de entorno, igual que la API.
ENTRYPOINT ["./efbundle"]

# ─────────────── api ───────────────
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS api
WORKDIR /app
COPY --from=build /out/api ./

# Carpeta de los adjuntos (Attachments__RootPath). Se crea con el usuario de la app como dueño: así el volumen
# que se monta encima hereda los permisos y la API puede escribir sin correr como root.
RUN mkdir -p /app/data/attachments && chown -R "$APP_UID" /app/data

USER $APP_UID
ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "ClinicApp.Api.dll"]
