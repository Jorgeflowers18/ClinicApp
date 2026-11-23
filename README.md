# ClinicApp

Sistema web de gestión integral para una clínica: pacientes, citas, historial clínico, tratamientos e inventario.

## Estructura del repositorio

- [`front/`](front/) — Frontend (React + TypeScript + Vite). Ver [`documentacion/arquitectura-frontend.md`](documentacion/arquitectura-frontend.md) para la arquitectura completa.
- [`back/`](back/) — API REST en .NET (por inicializar).
- [`documentacion/`](documentacion/) — Documentación de arquitectura del proyecto.

## Empezar

```bash
cd front
npm install
npm run dev
```

La app usa la API de `back/` (ver `front/README.md`). El modo demostración, sin back, está en la rama `jf/front-demo-mocks`.
