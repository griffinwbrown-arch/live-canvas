import { _electron as electron } from 'playwright'
import { createServer } from 'vite'
import assert from 'node:assert/strict'
const server = await createServer({ server: { port: 18433 } })
await server.listen()
const app = await electron.launch({
  args: ['.', '--test'],
  env: { ...process.env, LIVE_CANVAS_DEV: 'http://127.0.0.1:18433' },
})
try {
  const page = await app.firstWindow()
  page.setDefaultTimeout(20000)
  await page.waitForSelector('.tl-canvas')
  await page.evaluate(() =>
    window.desktop.onCapture((data) => {
      window.lastCapture = data
    }),
  )
  let nextWindow = app.waitForEvent('window')
  await page.getByRole('button', { name: 'Source options' }).click()
  await page.getByRole('button', { name: 'Capture region', exact: true }).click()
  let crop = await nextWindow
  await crop.waitForFunction(() => document.querySelector('img')?.naturalWidth > 0)
  const closed = crop.waitForEvent('close')
  await crop.keyboard.press('Escape').catch((error) => {
    if (!crop.isClosed()) throw error
  })
  await closed
  assert.equal(await page.locator('.mode-button').innerText(), 'Canvas')
  nextWindow = app.waitForEvent('window')
  await page.getByRole('button', { name: 'Source options' }).click()
  await page.getByRole('button', { name: 'Capture region', exact: true }).click()
  crop = await nextWindow
  await crop.waitForFunction(() => document.querySelector('img')?.naturalWidth > 0)
  const size = await crop.evaluate(() => ({ w: innerWidth, h: innerHeight }))
  await crop.mouse.move(size.w * 0.2, size.h * 0.2)
  await crop.mouse.down()
  await crop.mouse.move(size.w * 0.6, size.h * 0.6, { steps: 8 })
  await crop.mouse.up().catch((error) => {
    if (!crop.isClosed()) throw error
  })
  await page.waitForFunction(() => window.lastCapture)
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach((w) => w.hide()))
  const capture = await page.evaluate(() => window.lastCapture)
  assert.ok(Math.abs(capture.crop.w - 0.4) < 0.01 && Math.abs(capture.crop.h - 0.4) < 0.01)
  await page.locator('.mode-button.live').waitFor()
  console.log(
    JSON.stringify({
      passed: true,
      overlayCancel: true,
      overlayCapture: true,
      receivedCrop: capture.crop,
      liveStreamStarted: true,
    }),
  )
} finally {
  await app.close()
  await server.close()
}
