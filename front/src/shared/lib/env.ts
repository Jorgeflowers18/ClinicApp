/**
 * Módulos que se conectan a la API uno por uno (plan 0 de `docs/planes-implementacion`).
 * Los nombres son los de los planes: un módulo pasa a la API solo cuando ya lo están los que necesita.
 */
export const apiModules = [
  "auth", "institution", "patients", "agenda", "treatments", "inventory",
  "clinical-history", "notifications", "finance", "reports",
] as const
export type ApiModule = (typeof apiModules)[number]

const useMockApi = import.meta.env.VITE_USE_MOCK_API !== "false"

/** `VITE_API_MODULES=auth,patients` → esos módulos usan la API aunque el resto siga en modo mock. */
const realModules: ReadonlySet<string> = new Set(
  (import.meta.env.VITE_API_MODULES ?? "").split(",").map((name) => name.trim()).filter(Boolean)
)

export const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000/api",
  /** Modo demostración global. Con `false`, todos los módulos usan la API. */
  useMockApi,
  /** ¿Este módulo usa la API? Sí con `VITE_USE_MOCK_API=false`, o si está en `VITE_API_MODULES`. */
  usesApi(module: ApiModule): boolean {
    return !useMockApi || realModules.has(module)
  },
} as const
