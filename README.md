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

La app corre en modo mock (`VITE_USE_MOCK_API=true`) hasta que la API en `back/` esté disponible. Cuentas de prueba en la pantalla de login.
