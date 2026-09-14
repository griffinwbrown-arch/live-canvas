import { _electron as electron } from 'playwright'
import path from 'node:path'
import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
const executablePath =
  process.env.LIVE_CANVAS_EXE || path.resolve('release/win-unpacked/Live Canvas.exe')
const app = await electron.launch({
  executablePath,
  args: ['--test'],
  env: { ...process.env, LIVE_CANVAS_DEV: 'http://127.0.0.1:1/should-not-load' },
})
const errors = []
try {
  const page = await app.firstWindow()
  page.setDefaultTimeout(20000)
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => {
    if (m.type() === 'error') console.log(m.text())
  })
  await page.waitForSelector('.tl-canvas')
  await page.waitForTimeout(6500)
  assert.ok(
    await page.locator('.tl-canvas').count(),
    'Licensed packaged editor must remain mounted',
  )
  assert.ok(
    page.url().startsWith('live-canvas://'),
    'Test must run the built renderer, not the development server',
  )
  const fixtureOpened = app.waitForEvent('window')
  await app.evaluate(async ({ BrowserWindow }) => {
    const w = new BrowserWindow({
      width: 600,
      height: 400,
      frame: false,
      show: false,
      webPreferences: { backgroundThrottling: false },
    })
    await w.loadURL(
      'data:text/html,' +
        encodeURIComponent(
          '<title>Packaged pointer test</title><body style="background:#ddebe3"><button style="position:absolute;left:100px;top:100px;width:220px;height:100px" onclick="this.textContent=\'Clicked successfully\'">Click target</button></body>',
        ),
    )
    w.showInactive()
  })
  const fixture = await fixtureOpened
  await page.getByRole('button', { name: 'Choose screen', exact: true }).click()
  await page.locator('.source-grid button').filter({ hasText: 'Packaged pointer test' }).click()
  await page.locator('.mode-button.live').waitFor()
  await page.getByRole('button', { name: 'Source options' }).click()
  await page.getByRole('button', { name: 'Fit', exact: true }).click()
  await page.keyboard.press('Escape')
  const zoom = page.getByRole('button', { name: 'Reset view zoom', exact: true })
  assert.equal(await zoom.innerText(), '100%')
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
  assert.equal(await zoom.innerText(), '125%')
  await zoom.click()
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      { x: 600, y: 450, id: 1 },
      { x: 800, y: 450, id: 2 },
    ],
  })
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [
      { x: 500, y: 450, id: 1 },
      { x: 900, y: 450, id: 2 },
    ],
  })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  assert.ok(parseInt(await zoom.innerText()) > 150)
  await zoom.click()
  await cdp.detach()
  await page.getByRole('button', { name: 'Interact with screen', exact: true }).click()
  await page.locator('.pointer-control:not(.starting)').waitFor()
  const box = await page.locator('.pointer-control').boundingBox()
  await page.mouse.click(box.x + box.width * 0.35, box.y + box.height * 0.375)
  await fixture.getByRole('button', { name: 'Clicked successfully' }).waitFor()
  await page.getByRole('button', { name: 'Freeze', exact: true }).click()
  await fs.mkdir('test-results', { recursive: true })
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()
      .find((w) => w.getTitle() === 'Live Canvas')
      .showInactive(),
  )
  const screenshot = await app.evaluate(async ({ BrowserWindow }) =>
    (
      await BrowserWindow.getAllWindows()
        .find((w) => w.getTitle() === 'Live Canvas')
        .webContents.capturePage(undefined, { stayHidden: false, stayAwake: true })
    ).toDataURL(),
  )
  await fs.writeFile('test-results/packaged.png', Buffer.from(screenshot.split(',')[1], 'base64'))
  assert.deepEqual(errors, [])
  console.log(
    JSON.stringify({
      passed: true,
      packagedRenderer: true,
      licensedCanvas: true,
      realWindowCapture: true,
      packagedNativePointer: true,
      packagedPinchZoom: true,
      rendererErrors: errors,
    }),
  )
} catch (e) {
  for (const p of app.windows())
    console.log(await p.title(), (await p.locator('body').innerText()).slice(-1800))
  throw e
} finally {
  await app.close()
}
