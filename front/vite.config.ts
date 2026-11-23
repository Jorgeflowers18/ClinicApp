import { realpathSync } from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Ruta real del disco (en Windows, con la letra de la unidad como la usa Vite: "C:\…"). Si la terminal arranca en
// "c:\…", el alias quedaba en minúscula y la raíz en mayúscula: Vite trataba el mismo archivo como dos módulos y
// la página cargaba dos copias de React o del store de sesión ("Invalid hook call", página en blanco).
const src = realpathSync.native(path.resolve(import.meta.dirname, './src'))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': src,
    },
  },
  server: {
    port: 5173,
  },
  build: {
    rolldownOptions: {
      input: {
        app: path.resolve(import.meta.dirname, 'index.html'),
        odontogram: path.resolve(import.meta.dirname, 'odontogram.html'),
      },
    },
  },
})
