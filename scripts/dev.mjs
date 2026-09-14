import { spawn } from 'node:child_process'
import { createServer } from 'vite'
import electron from 'electron'
const server = await createServer()
await server.listen()
const child = spawn(electron, ['.'], {
  stdio: 'inherit',
  env: { ...process.env, LIVE_CANVAS_DEV: 'http://127.0.0.1:18431' },
})
child.on('exit', async (code) => {
  await server.close()
  process.exit(code ?? 0)
})
process.on('SIGINT', () => child.kill())
