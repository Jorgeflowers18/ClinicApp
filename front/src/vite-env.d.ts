/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Dirección de la API, por ejemplo `http://localhost:5000/api`. */
  readonly VITE_API_BASE_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
