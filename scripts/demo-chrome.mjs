import { _electron as electron } from 'playwright'
import { createServer } from 'vite'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const out = new URL('../docs/demos/assets/', import.meta.url)
await fs.mkdir(out, { recursive: true })
const server = await createServer({ server: { port: 18437 } })
await server.listen()
const app = await electron.launch({
  args: ['.', '--test'],
  env: { ...process.env, LIVE_CANVAS_DEV: 'http://127.0.0.1:18437' },
})
try {
  const page = await app.firstWindow()
  await page.waitForSelector('.tl-canvas')
  await app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows()[0]
    w.setContentSize(1440, 900)
    w.showInactive()
  })
  await page.waitForTimeout(400)
  await page.locator('.source-label').evaluate((el) => (el.textContent = 'Region'))
  await page.locator('.mode-button').evaluate((el) => {
    el.className = 'mode-button live'
    el.removeAttribute('disabled')
    el.querySelectorAll('span')[1].textContent = 'Live'
  })
  await page
    .locator('.floating-toolbar')
    .screenshot({ path: path.join(fileURLToPath(out), 'toolbar.png') })
  await page.locator('.mode-button').evaluate((el) => {
    el.className = 'mode-button frozen'
    el.querySelectorAll('span')[1].textContent = 'Frozen'
  })
  await page
    .locator('.floating-toolbar')
    .screenshot({ path: path.join(fileURLToPath(out), 'toolbar-frozen.png') })
  const pnpm = new URL('../node_modules/.pnpm/', import.meta.url)
  const entries = await fs.readdir(pnpm)
  const folder = entries.find((name) => name.startsWith('@tldraw+editor@5.4.2_'))
  const content = await fs.readFile(
    new URL(folder + '/node_modules/@tldraw/editor/src/lib/watermarks.ts', pnpm),
    'utf8',
  )
  const svg = content.match(/watermarkDesktopSvg\s*=\s*'([^']+)'/)[1]
  await page.evaluate((svg) => {
    const box = document.createElement('div')
    box.id = 'demo-attribution'
    box.style.cssText =
      'position:fixed;left:20px;top:100px;width:240px;height:84px;padding:5px;border:3px solid #999;border-radius:5px;background:white;z-index:99999;box-sizing:border-box'
    box.innerHTML = svg
    const art = box.querySelector('svg')
    art.setAttribute('viewBox', '0 0 3001 1000')
    art.style.cssText = 'width:100%;height:100%'
    art.querySelectorAll('[fill="#000"]').forEach((el) => el.setAttribute('fill', '#999'))
    document.body.append(box)
  }, svg)
  await page
    .locator('#demo-attribution')
    .screenshot({ path: path.join(fileURLToPath(out), 'tldraw.png') })
  console.log('Captured toolbar and SDK attribution for the workflow mockups.')
} finally {
  await app.close()
  await server.close()
}
