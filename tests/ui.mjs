import { _electron as electron } from 'playwright'
import { createServer } from 'vite'
import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
const server = await createServer({ server: { port: 18435 } })
await server.listen()
const app = await electron.launch({
  args: ['.', '--test'],
  env: { ...process.env, LIVE_CANVAS_DEV: 'http://127.0.0.1:18435' },
})
const page = await app.firstWindow()
page.setDefaultTimeout(15000)
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
const shot = async (name) => {
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  )
  const data = await app.evaluate(async ({ BrowserWindow }) =>
    (
      await BrowserWindow.getAllWindows()
        .find((w) => w.getTitle() === 'Live Canvas')
        .webContents.capturePage(undefined, { stayAwake: true })
    )
      .toPNG()
      .toString('base64'),
  )
  await fs.writeFile(`test-results/${name}.png`, Buffer.from(data, 'base64'))
}
const bar = page.getByRole('toolbar', { name: 'Canvas toolbar' })
try {
  await fs.mkdir('test-results', { recursive: true })
  await app.evaluate(({ BrowserWindow, ipcMain }) => {
    BrowserWindow.getAllWindows()[0].showInactive()
    ipcMain.removeHandler('copy-image')
    ipcMain.handle('copy-image', (_, data) => {
      globalThis.copiedCanvas = data
      return true
    })
    ipcMain.removeHandler('sources')
    ipcMain.handle('sources', () => [
      {
        id: 'screen:test',
        name: 'Reference window',
        displayId: '1',
        thumbnail:
          'data:image/svg+xml,' +
          encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#e7edf4"/><text x="40" y="90" font-family="sans-serif" fill="#283849">Reference window</text></svg>',
          ),
      },
    ])
    ipcMain.removeHandler('select-source')
    ipcMain.handle('select-source', () => {})
    ipcMain.removeHandler('set-control')
    ipcMain.handle('set-control', () => {})
    ipcMain.removeHandler('pointer-input')
    ipcMain.handle('pointer-input', (_, data) => {
      globalThis.lastPointer = data
      globalThis.pointerCount = (globalThis.pointerCount || 0) + 1
      if (globalThis.holdPointer)
        return new Promise((resolve) => {
          globalThis.releasePointer = resolve
        })
    })
  })
  await page.waitForSelector('.tl-canvas')
  const viewport = await page.evaluate(() => ({ w: innerWidth, h: innerHeight }))
  assert.deepEqual(
    await page.locator('.surface').evaluate((el) => ({ w: el.clientWidth, h: el.clientHeight })),
    viewport,
  )
  await shot('ui-blank')
  for (const line of [
    [300, 280, 520, 400],
    [760, 510, 1050, 620],
  ]) {
    await page.mouse.move(line[0], line[1])
    await page.mouse.down()
    await page.mouse.move(line[2], line[3], { steps: 15 })
    await page.mouse.up()
  }
  await page.waitForFunction(() => document.querySelectorAll('.tl-shape').length === 2)
  await bar.getByRole('button', { name: 'Copy image', exact: true }).click()
  await page.getByRole('status').filter({ hasText: 'Copied picture' }).waitFor()
  const before = await app.evaluate(() => globalThis.copiedCanvas)
  await bar.getByRole('button', { name: 'Clear', exact: true }).click()
  await page.waitForFunction(() => document.querySelectorAll('.tl-shape').length === 0)
  await bar.getByRole('button', { name: 'Undo', exact: true }).click()
  await page.waitForFunction(() => document.querySelectorAll('.tl-shape').length === 2)
  assert.equal(
    await bar.getByRole('button', { name: 'Pen', exact: true }).getAttribute('aria-pressed'),
    'true',
    'Undo should let the user keep drawing',
  )
  await bar.getByRole('button', { name: 'Copy image', exact: true }).click()
  await page.getByRole('status').filter({ hasText: 'Copied picture' }).waitFor()
  const after = await app.evaluate(() => globalThis.copiedCanvas)
  assert.equal(after, before, 'One undo must restore the exact cleared artwork')
  await bar.getByRole('button', { name: 'Hide toolbar' }).click()
  await page.getByRole('button', { name: 'Show toolbar' }).waitFor()
  await page.waitForFunction(
    () => getComputedStyle(document.querySelector('.floating-toolbar')).opacity === '0',
  )
  const compact = await page.locator('.compact-controls').boundingBox()
  assert.ok(compact.width < 180 && compact.height < 60)
  assert.deepEqual(
    await page.locator('.surface').evaluate((el) => ({ w: el.clientWidth, h: el.clientHeight })),
    viewport,
  )
  await shot('ui-collapsed')
  await page.getByRole('button', { name: 'Clear annotations', exact: true }).click()
  await page.waitForFunction(() => document.querySelectorAll('.tl-shape').length === 0)
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await page.waitForFunction(() => document.querySelectorAll('.tl-shape').length === 2)
  await page.getByRole('button', { name: 'Show toolbar' }).click()
  await bar.getByRole('button', { name: 'Color and stroke' }).click()
  await page.getByRole('button', { name: 'blue ink' }).click()
  await page.getByRole('button', { name: 'L stroke', exact: true }).click()
  await page.keyboard.press('Escape')
  assert.equal(
    await bar
      .getByRole('button', { name: 'Color and stroke' })
      .evaluate((el) => el === document.activeElement),
    true,
  )
  await page.evaluate(() => {
    const c = document.createElement('canvas')
    c.width = 1600
    c.height = 900
    const x = c.getContext('2d')
    let count = 0
    const draw = () => {
      x.fillStyle = '#e4ebf3'
      x.fillRect(0, 0, 1600, 900)
      x.fillStyle = '#24364b'
      x.fillRect(0, 0, 1600, 115)
      x.fillStyle = '#fff'
      x.font = '24px sans-serif'
      x.fillText('Reference window', 80, 72)
      x.fillStyle = '#34485e'
      x.font = '48px sans-serif'
      x.fillText('Live source', 150, 270)
      x.font = '24px sans-serif'
      x.fillText('Screen content stays beneath your annotations.', 150, 325)
      x.fillStyle = '#ccd9e6'
      x.fillRect(150, 405, 1300, 320)
      x.fillStyle = '#7a98b7'
      x.fillRect(150, 710, 1300, 15)
      x.fillStyle = `rgb(${count++ % 255},80,110)`
      x.fillRect(1500, 840, 60, 20)
      requestAnimationFrame(draw)
    }
    draw()
    navigator.mediaDevices.getDisplayMedia = async () => c.captureStream(30)
  })
  await bar.getByRole('button', { name: 'Source options' }).click()
  await page.getByRole('button', { name: 'Choose screen or window' }).click()
  await page.getByRole('dialog').waitFor()
  await shot('ui-source-picker')
  await page.locator('.source-grid button').first().click()
  await page.locator('.mode-button.live').waitFor()
  await bar.getByRole('button', { name: 'Clear', exact: true }).click()
  await page.waitForFunction(() => document.querySelectorAll('.tl-shape').length === 0)
  await bar.getByRole('button', { name: 'Pen', exact: true }).click()
  await page.waitForTimeout(150)
  await page.mouse.move(300, 410)
  await page.mouse.down()
  await page.mouse.move(820, 410, { steps: 24 })
  await page.mouse.up()
  await page.waitForFunction(() => document.querySelectorAll('.tl-shape').length === 1)
  await shot('ui-live')
  await bar.getByRole('button', { name: 'Source options' }).click()
  await page.getByRole('button', { name: 'Fit', exact: true }).click()
  await page.keyboard.press('Escape')
  await bar.getByRole('button', { name: 'Select', exact: true }).click()
  assert.equal(
    await page.locator('.pointer-control').count(),
    0,
    'Select must edit annotations while live',
  )
  const shape = page.locator('.tl-shape').first()
  const original = await shape.boundingBox()
  const eventCount = await app.evaluate(() => globalThis.pointerCount || 0)
  await page.mouse.move(original.x + original.width / 2, original.y + original.height / 2)
  await page.mouse.down()
  await page.mouse.move(
    original.x + original.width / 2 + 80,
    original.y + original.height / 2 + 60,
    { steps: 12 },
  )
  await page.mouse.up()
  const moved = await shape.boundingBox()
  assert.ok(
    Math.abs(moved.x - original.x - 80) < 3 && Math.abs(moved.y - original.y - 60) < 3,
    'Live annotations must drag normally',
  )
  assert.equal(
    await app.evaluate(() => globalThis.pointerCount || 0),
    eventCount,
    'Annotation drag must not reach source',
  )
  assert.equal(await page.locator('.mode-button.live').count(), 1)
  // Crop, zoom back beyond that crop, and keep ink in source coordinates.
  await bar.getByRole('button', { name: 'Source options' }).click()
  await page.getByRole('button', { name: 'Crop view', exact: true }).click()
  await page.mouse.move(360, 225)
  await page.mouse.down()
  await page.mouse.move(1080, 675, { steps: 8 })
  await page.mouse.up()
  const zoomLabel = page.getByRole('button', { name: 'Reset view zoom', exact: true })
  const zoom = async () => parseInt(await zoomLabel.innerText())
  const cropZoom = await zoom()
  assert.ok(cropZoom > 150)
  const cropShape = await shape.boundingBox()
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
  const larger = await shape.boundingBox()
  assert.ok(Math.abs(larger.width / cropShape.width - 1.25) < 0.03, 'Ink scales with the image')
  await zoomLabel.click()
  assert.equal(await zoom(), cropZoom, 'Reset returns to the chosen crop')
  const cdp = await page.context().newCDPSession(page)
  const touch = (type, points) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: points.map(([x, y, id]) => ({ x, y, id, radiusX: 3, radiusY: 3, force: 1 })),
    })
  const countBeforeTouch = await app.evaluate(() => globalThis.pointerCount || 0)
  await touch('touchStart', [
    [400, 450, 1],
    [1000, 450, 2],
  ])
  for (let n = 1; n <= 8; n++)
    await touch('touchMove', [
      [400 + n * 25, 450, 1],
      [1000 - n * 25, 450, 2],
    ])
  await touch('touchEnd', [])
  await page.waitForTimeout(100)
  assert.equal(await zoom(), 100, 'Pinch out from a crop must reveal the full source')
  assert.equal(await page.locator('.tl-shape').count(), 1, 'Touch navigation must not draw ink')
  assert.equal(await app.evaluate(() => globalThis.pointerCount || 0), countBeforeTouch)
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
  await shot('ui-zoom')
  await page.mouse.move(720, 450)
  await page.keyboard.down('Control')
  await page.mouse.wheel(0, 300)
  await page.keyboard.up('Control')
  await page.waitForTimeout(100)
  assert.equal(await zoom(), 100, 'Ctrl+wheel zooms the picture')
  await bar.getByRole('button', { name: 'Source options' }).click()
  await page.getByRole('button', { name: 'Reset crop', exact: true }).click()
  await cdp.detach()
  await bar.getByRole('button', { name: 'Interact with screen', exact: true }).click()
  await page.locator('.pointer-control:not(.starting)').waitFor()
  const remote = await page.locator('.pointer-control').boundingBox()
  await page.mouse.click(remote.x + remote.width * 0.5, remote.y + remote.height * 0.5)
  await page.waitForTimeout(80)
  const mapped = await app.evaluate(() => globalThis.lastPointer)
  assert.ok(Math.abs(mapped.x - 0.5) < 0.002 && Math.abs(mapped.y - 0.5) < 0.002)
  const beforeControlZoom = await app.evaluate(() => globalThis.pointerCount || 0)
  const controlCdp = await page.context().newCDPSession(page)
  await controlCdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      { x: 600, y: 450, id: 1 },
      { x: 800, y: 450, id: 2 },
    ],
  })
  await controlCdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [
      { x: 500, y: 450, id: 1 },
      { x: 900, y: 450, id: 2 },
    ],
  })
  await controlCdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await page.waitForTimeout(100)
  assert.ok((await zoom()) > 150)
  assert.equal(
    await app.evaluate(() => globalThis.pointerCount || 0),
    beforeControlZoom,
    'Pinch must not send remote input in screen-control mode',
  )
  await controlCdp.detach()
  await page.keyboard.press('Escape')
  assert.equal(await page.locator('.pointer-control').count(), 0, 'Escape must exit screen control')
  await bar.getByRole('button', { name: 'Interact with screen', exact: true }).click()
  await page.locator('.pointer-control:not(.starting)').waitFor()
  await app.evaluate(() => {
    globalThis.holdPointer = true
  })
  const beforeQueued = await app.evaluate(() => globalThis.pointerCount || 0)
  await page.mouse.move(700, 400)
  await page.waitForTimeout(80)
  await page.mouse.down()
  await page.mouse.move(750, 440)
  await page.mouse.up()
  await bar.getByRole('button', { name: 'Select', exact: true }).click()
  await app.evaluate(() => {
    globalThis.holdPointer = false
    globalThis.releasePointer?.()
  })
  await page.waitForTimeout(100)
  assert.equal(
    await app.evaluate(() => globalThis.pointerCount || 0),
    beforeQueued + 1,
    'Exiting control must discard queued input',
  )
  await bar.getByRole('button', { name: 'Freeze', exact: true }).click()
  assert.equal(await page.locator('.pointer-control').count(), 0)
  await bar.getByRole('button', { name: 'Pen', exact: true }).click()
  await bar.getByRole('button', { name: 'Full screen', exact: true }).click()
  await page.waitForFunction(async () => (await window.desktop.windowState()).fullscreen)
  await bar.getByRole('button', { name: 'Exit full screen', exact: true }).click()
  await page.waitForFunction(async () => !(await window.desktop.windowState()).fullscreen)
  await app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows()[0]
    w.setMinimumSize(320, 400)
    w.setContentSize(800, 650)
  })
  await page.waitForFunction(() => innerWidth === 800)
  await shot('ui-800')
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].webContents.setZoomFactor(1.25),
  )
  await page.waitForFunction(() => innerWidth === 640)
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].webContents.setZoomFactor(1),
  )
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setContentSize(390, 844),
  )
  await page.waitForFunction(() => innerWidth === 390)
  await shot('ui-390')
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
  await bar.getByRole('button', { name: 'More options' }).click()
  const pop = await page.locator('.toolbar-popover').boundingBox()
  assert.ok(pop.x >= 0 && pop.x + pop.width <= 390)
  await page.keyboard.press('Escape')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  assert.equal(
    await page
      .locator('.floating-toolbar')
      .evaluate((el) => getComputedStyle(el).transitionDuration),
    '0s',
  )
  assert.deepEqual(errors, [])
  console.log(
    JSON.stringify({
      passed: true,
      fullViewport: true,
      clearUndoExact: true,
      collapsedQuickActions: true,
      sourcePointerMapping: true,
      liveAnnotationDrag: true,
      pinchZoom: true,
      cropZoomReset: true,
      inkZoomAlignment: true,
      annotationInputIsolated: true,
      escapeExitsControl: true,
      fullScreenToggle: true,
      zoom125Percent: true,
      widths: [1440, 800, 390],
      rendererErrors: errors,
    }),
  )
} catch (error) {
  console.log((await page.locator('body').innerText()).slice(-2000), errors)
  await shot('ui-failure').catch(() => {})
  throw error
} finally {
  await app.close()
  await server.close()
}
