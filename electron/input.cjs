const { spawn } = require('node:child_process')
const path = require('node:path')
const { app } = require('electron')
class InputBridge {
  constructor() {
    this.child = null
    this.pending = new Map()
    this.sequence = 0
    this.ready = null
  }
  start() {
    if (this.ready) return this.ready
    this.ready = new Promise((resolve, reject) => {
      const helper = app.isPackaged
        ? path.join(process.resourcesPath, 'input', 'input-bridge.ps1')
        : path.join(__dirname, 'input-bridge.ps1')
      const child = (this.child = spawn(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', helper],
        { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] },
      ))
      let output = '',
        errors = ''
      const timeout = setTimeout(() => {
        reject(Error('Pointer control could not start.'))
        child.kill()
      }, 15000)
      child.stderr.on('data', (chunk) => {
        errors = (errors + chunk.toString()).slice(-4000)
      })
      child.stdout.on('data', (chunk) => {
        output += chunk.toString()
        let end
        while ((end = output.indexOf('\n')) !== -1) {
          const line = output.slice(0, end).trim()
          output = output.slice(end + 1)
          if (line === 'READY') {
            clearTimeout(timeout)
            resolve()
            continue
          }
          const [id, status, message] = line.split('\t'),
            pending = this.pending.get(id)
          if (pending) {
            this.pending.delete(id)
            clearTimeout(pending.timeout)
            status === 'OK'
              ? pending.resolve()
              : pending.reject(Error(message || 'Pointer input failed.'))
          }
        }
      })
      const fail = (error) => {
        clearTimeout(timeout)
        reject(error)
        this.ready = null
        this.child = null
        for (const p of this.pending.values()) {
          clearTimeout(p.timeout)
          p.reject(error)
        }
        this.pending.clear()
      }
      child.stdin.on('error', fail)
      child.on('error', fail)
      child.on('exit', () => fail(Error(errors || 'Pointer control stopped.')))
    })
    return this.ready
  }
  async send(fields) {
    await this.start()
    const id = String(++this.sequence)
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id)
        reject(Error('Pointer input timed out.'))
      }, 3000)
      this.pending.set(id, { resolve, reject, timeout })
      this.child.stdin.write([id, ...fields].join('\t') + '\n')
    })
  }
  release() {
    return this.child ? this.send(['release']) : Promise.resolve()
  }
  close() {
    if (this.child) this.child.stdin.end()
  }
}
module.exports = { InputBridge }
