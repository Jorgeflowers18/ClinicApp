// Vite de las pruebas E2E: la configuración del proyecto con su propia caché de dependencias. Si compartiera
// `node_modules/.vite` con el Vite de desarrollo, se reoptimizarían entre sí y la página cargaría dos copias de React.
import config from "../vite.config"

export default {
  ...config,
  cacheDir: "node_modules/.vite-e2e",
  // Todas las pantallas (también las rutas perezosas) desde el inicio: si Vite descubre una dependencia nueva
  // al navegar, recarga la página en medio de una prueba.
  optimizeDeps: { entries: ["index.html", "odontogram.html", "src/**/*.tsx"] },
}
