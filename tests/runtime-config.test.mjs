import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { loadOrigin, validHost } from '../electron/runtime-config.cjs'
test('packaged host is configurable and rejects paths or remote URLs', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'live-canvas-config-'))
  try {
    assert.equal(loadOrigin(dir), 'live-canvas://app.live-canvas.local/')
    await writeFile(path.join(dir, 'runtime.json'), JSON.stringify({ host: 'canvas.example.com' }))
    assert.equal(loadOrigin(dir), 'live-canvas://canvas.example.com/')
    for (const host of ['https://example.com', '../outside', 'a/b', '', null])
      assert.equal(validHost(host), false)
    await writeFile(path.join(dir, 'runtime.json'), JSON.stringify({ host: '../outside' }))
    assert.throws(() => loadOrigin(dir), /Invalid Live Canvas host/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
