import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Backend de una instalación nativa. Es el destino por defecto del proxy de
// desarrollo: antes era 'http://localhost', o sea el :80 del nginx que sólo
// existe con el perfil fullstack de Docker, así que sin Docker toda llamada a
// /api moría en ECONNREFUSED.
const BACKEND_NATIVO = 'http://localhost:8000'

// VITE_API_URL manda si está definida. Trae el sufijo /api, así que del valor
// se toma sólo el origen; un valor relativo como '/api' no tiene origen propio
// y ya es del mismo host que la página.
function origenDelBackend(apiUrl: string | undefined): string {
  if (!apiUrl) return BACKEND_NATIVO
  if (!/^https?:\/\//i.test(apiUrl)) return BACKEND_NATIVO
  return new URL(apiUrl).origin
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())
  const destino = origenDelBackend(env.VITE_API_URL)

  return {
    plugins: [react()],
    server: {
      allowedHosts: [
        'localhost'
      ],
      proxy: {
        '/api': {
          target: destino,
          changeOrigin: true,
          secure: false,
        },
        // Las imágenes subidas las sirve el backend en /uploads. Sin este
        // proxy, con VITE_IMAGES_URL sin definir el navegador se las pedía al
        // servidor de Vite, que no las tiene, y devolvía 404.
        '/uploads': {
          target: destino,
          changeOrigin: true,
          secure: false,
        }
      }
    }
  }
})
