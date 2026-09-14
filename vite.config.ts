import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { createRequire } from 'node:module'
import path from 'node:path'
const { validHost } = createRequire(import.meta.url)(path.resolve('electron/runtime-config.cjs'))

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const host = env.LIVE_CANVAS_HOST || 'app.live-canvas.local'
  if (!validHost(host))
    throw new Error('LIVE_CANVAS_HOST must be a hostname, without a protocol or path.')
  return {
    plugins: [
      react(),
      {
        name: 'local-runtime-config',
        generateBundle() {
          this.emitFile({
            type: 'asset',
            fileName: 'runtime.json',
            source: JSON.stringify({ host }),
          })
        },
      },
    ],
    base: './',
    optimizeDeps: { exclude: ['@tldraw/assets'] },
    server: {
      host: '127.0.0.1',
      port: 18431,
      strictPort: true,
      watch: { ignored: ['**/release/**', '**/packaging/**', '**/test-results/**'] },
    },
  }
})
