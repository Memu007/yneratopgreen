import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Backend de una instalación nativa. Es el destino por defecto del proxy de
// desarrollo: antes era 'http://localhost', o sea el :80 del nginx que sólo
// existe con el perfil fullstack de Docker, así que sin Docker toda llamada a
// /api moría en ECONNREFUSED.
const BACKEND_NATIVO = 'http://localhost:8000'

// Qué commit es este artefacto. Railway pone `RAILWAY_GIT_COMMIT_SHA` con el
// SHA completo del commit que disparó el despliegue; fuera de Railway no
// existe. Se lee de `process.env` y no de `loadEnv` a propósito: `loadEnv` sólo
// trae las que empiezan con VITE_, y ésta no es nuestra, es de la plataforma.
//
// Sin variable no se inventa nada: queda un valor que se lee como lo que es y
// que no puede confundirse con un SHA —tiene guiones y no es hexadecimal—.
// Y si viene, se usa TAL CUAL: recortarla haría que dos artefactos distintos
// se vieran iguales, que es justo lo que esto tiene que impedir.
const SIN_REVISION = 'sin-revision-local'
const revision = (process.env.RAILWAY_GIT_COMMIT_SHA || '').trim() || SIN_REVISION

// La revisión viaja en la metadata del documento: no se ve, no se imprime en
// consola y no agrega ninguna superficie de diseño, pero un `curl` la lee.
function revisionEnElDocumento() {
  return {
    name: 'revision-en-el-documento',
    transformIndexHtml() {
      return [{
        tag: 'meta',
        attrs: { name: 'topgreen:revision', content: revision },
        injectTo: 'head' as const,
      }]
    },
  }
}

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
    plugins: [react(), revisionEnElDocumento()],
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
