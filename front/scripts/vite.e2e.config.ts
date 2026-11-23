// Vite de las pruebas E2E: la configuración del proyecto con su propia caché de dependencias. Si compartiera
// `node_modules/.vite` con el Vite de desarrollo, se reoptimizarían entre sí y la página cargaría dos copias de React.
// `run-api-e2e.mjs` borra esta caché antes de cada corrida, así nunca se reutiliza una optimización de otra
// configuración. Las rutas se importan sin carga perezosa, así que el escaneo normal (index.html y odontogram.html)
// ya encuentra todas las dependencias.
import config from "../vite.config"

export default { ...config, cacheDir: "node_modules/.vite-e2e" }
