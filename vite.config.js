import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const FRAME_ANCESTORS =
  "frame-ancestors 'self' https://sizor.online https://*.sizor.online http://localhost:5173 http://127.0.0.1:5173 http://localhost:3000 http://127.0.0.1:3000"

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiPort = env.PORT || '8787'

  return {
    plugins: [react(), tailwindcss()],
    preview: {
      headers: {
        'Content-Security-Policy': FRAME_ANCESTORS,
      },
    },
    server: {
      port: 5173,
      headers: {
        'Content-Security-Policy': FRAME_ANCESTORS,
      },
      proxy: {
        '/api': {
          target: `http://localhost:${apiPort}`,
          changeOrigin: true,
        },
      },
    },
  }
})
