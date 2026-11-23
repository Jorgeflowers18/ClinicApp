/** Configuración de la app, leída de las variables `VITE_*` (ver `.env.example`). */
export const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000/api",
} as const
