/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_USE_MOCK_API: string
  /** Módulos que ya usan la API mientras el resto sigue en modo mock, separados por coma (ver `shared/lib/env.ts`). */
  readonly VITE_API_MODULES?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
