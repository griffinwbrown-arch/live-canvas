import { _electron as electron } from 'playwright'
import { createServer } from 'vite'
import fs from 'node:fs/promises'
import assert from 'node:assert/strict'

// Screenshots use only a generated demo screen. Never capture the user's desktop.
const server = await createServer({ server: { port: 18436 } })
await server.listen()
const app = await electron.launch({
  args: ['.', '--test'],
  env: { ...process.env, LIVE_CANVAS_DEV: 'http://127.0.0.1:18436' },
})
const page = await app.firstWindow()
page.setDefaultTimeout(15000)
const out = new URL('../docs/screenshots/', import.meta.url)
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
const bar = page.getByRole('toolbar', { name: 'Canvas toolbar' })
const shot = async (name) => {
  await page.mouse.move(12, 880)
  await page.waitForTimeout(300)
  const data = await app.evaluate(async ({ BrowserWindow }) =>
    (await BrowserWindow.getAllWindows()[0].webContents.capturePage(undefined, { stayAwake: true }))
      .toPNG()
      .toString('base64'),
  )
  await fs.writeFile(new URL(`${name}.png`, out), Buffer.from(data, 'base64'))
}
const drag = async (x, y, toX, toY) => {
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(toX, toY, { steps: 18 })
  await page.mouse.up()
}
try {
  await fs.mkdir(out, { recursive: true })
  await app.evaluate(({ BrowserWindow, ipcMain }) => {
    const w = BrowserWindow.getAllWindows()[0]
    w.setContentSize(1440, 900)
    w.webContents.setZoomFactor(1)
    w.showInactive()
    ipcMain.removeHandler('sources')
    ipcMain.handle('sources', () => [
      { id: 'screen:demo', name: 'Product review', displayId: '1', thumbnail: '' },
    ])
    ipcMain.removeHandler('select-source')
    ipcMain.handle('select-source', () => {})
    ipcMain.removeHandler('copy-image')
    ipcMain.handle('copy-image', (_, data) => {
      globalThis.demoExport = data
      return true
    })
  })
  await page.waitForSelector('.tl-canvas')
  await page.evaluate(() => {
    const c = document.createElement('canvas')
    c.width = 1440
    c.height = 900
    const x = c.getContext('2d')
    const rect = (a, b, w, h, r, color) => {
      x.fillStyle = color
      x.beginPath()
      x.roundRect(a, b, w, h, r)
      x.fill()
    }
    const text = (value, a, b, size, color = '#263a36', weight = 400) => {
      x.font = `${weight} ${size}px Segoe UI`
      x.fillStyle = color
      x.fillText(value, a, b)
    }
    const draw = () => {
      rect(0, 0, 1440, 900, 0, '#f5f5ee')
      text('PAPER STUDY', 82, 155, 15, '#34534a', 700)
      text('Product / Collections / Studio', 900, 155, 14, '#52685e')
      text('A little space to think.', 82, 265, 50, '#234b40', 650)
      text('Tools for slower mornings and better ideas.', 84, 311, 20, '#67756e')
      rect(84, 373, 686, 368, 20, '#dce5d6')
      x.save()
      x.translate(420, 555)
      x.rotate(-0.12)
      rect(-155, -133, 272, 282, 12, '#fcfbf3')
      rect(-151, -133, 18, 282, 4, '#35584b')
      for (let n = 0; n < 9; n++) {
        x.strokeStyle = '#dce3d5'
        x.lineWidth = 1
        x.beginPath()
        x.moveTo(-109, -68 + n * 22)
        x.lineTo(88, -68 + n * 22)
        x.stroke()
      }
      text('Start somewhere.', -108, -91, 17, '#315b4b', 600)
      x.restore()
      rect(586, 430, 12, 252, 5, '#b48955')
      text('01 / EVERYDAY NOTES', 115, 711, 12, '#45624f', 600)
      text('The everyday notebook', 844, 421, 30, '#264d40', 600)
      text('120 pages. One place for your next idea.', 846, 465, 17, '#67756e')
      text('$24', 846, 520, 30, '#264d40', 600)
      text('Color', 846, 576, 13, '#67756e')
      rect(846, 598, 32, 32, 16, '#345e4d')
      rect(891, 598, 32, 32, 16, '#c6a374')
      rect(936, 598, 32, 32, 16, '#788f92')
      rect(846, 665, 480, 62, 12, '#2f5948')
      text('Add to bag', 1029, 705, 18, '#ffffff', 600)
      text('Free shipping on orders over $50', 925, 761, 14, '#67756e')
      text('DEMO STORE / SYNTHETIC SCREEN', 84, 838, 11, '#7c8981')
      requestAnimationFrame(draw)
    }
    draw()
    navigator.mediaDevices.getDisplayMedia = async () => c.captureStream(30)
  })
  await page.getByRole('button', { name: 'Choose screen', exact: true }).click()
  await page.locator('.source-grid button').click()
  await page.locator('.mode-button.live').waitFor()
  await bar.getByRole('button', { name: 'Color and stroke' }).click()
  await page.getByRole('button', { name: 'blue ink' }).click()
  await page.keyboard.press('Escape')
  await bar.getByRole('button', { name: 'Shapes', exact: true }).click()
  await page.getByRole('button', { name: 'rectangle', exact: true }).click()
  await drag(826, 650, 1340, 740)
  await bar.getByRole('button', { name: 'Arrow', exact: true }).click()
  await drag(1360, 335, 1315, 647)
  await bar.getByRole('button', { name: 'Text', exact: true }).click()
  await page.mouse.click(945, 277)
  await page.locator('[contenteditable="true"]').last().waitFor({ state: 'visible' })
  await page.locator('[contenteditable="true"]').last().fill('Make the next step obvious.')
  await page.keyboard.press('Escape')
  await bar.getByRole('button', { name: 'Pen', exact: true }).click()
  await drag(115, 328, 481, 330)
  await page.waitForFunction(() => document.querySelectorAll('.tl-shape').length === 4)
  await page.waitForTimeout(5200)
  await shot('annotate')
  await bar.getByRole('button', { name: 'Copy image', exact: true }).click()
  await page.getByRole('status').filter({ hasText: 'Copied picture' }).waitFor()
  const exported = await app.evaluate(() => globalThis.demoExport)
  await fs.writeFile(new URL('export.png', out), Buffer.from(exported.split(',')[1], 'base64'))
  await bar.getByRole('button', { name: 'Hide toolbar', exact: true }).click()
  await page.waitForTimeout(5200)
  await shot('present')
  await page.getByRole('button', { name: 'Show toolbar', exact: true }).click()
  await bar.getByRole('button', { name: 'Source options', exact: true }).click()
  await page.getByRole('button', { name: 'Crop view', exact: true }).click()
  await drag(760, 350, 1400, 750)
  await page.waitForTimeout(5200)
  await shot('focus')
  assert.deepEqual(errors, [])
  console.log('Saved four app screenshots using synthetic content only.')
} finally {
  await app.close()
  await server.close()
}
