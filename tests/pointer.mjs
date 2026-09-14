import { _electron as electron } from 'playwright'
import { createServer } from 'vite'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
const server = await createServer({ server: { port: 18434 }, cacheDir: '.vite-pointer' })
await server.listen()
const app = await electron.launch({
  args: ['.', '--test'],
  env: { ...process.env, LIVE_CANVAS_DEV: 'http://127.0.0.1:18434' },
})
const errors = []
try {
  const page = await app.firstWindow()
  page.setDefaultTimeout(15000)
  page.on('pageerror', (e) => errors.push(e.message))
  await page.waitForSelector('.tl-canvas')
  const fixtureOpened = app.waitForEvent('window')
  await app.evaluate(async ({ BrowserWindow }) => {
    const w = new BrowserWindow({
      title: 'Pointer test source',
      x: 50,
      y: 50,
      width: 800,
      height: 600,
      frame: false,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        backgroundThrottling: false,
      },
    })
    await w.loadURL(
      'data:text/html,' +
        encodeURIComponent(
          `<!doctype html><title>Pointer test source</title><style>body{margin:0;background:#e0ede6;font:20px Segoe UI;color:#193c30}h1{margin:35px}input{position:absolute;left:160px;top:140px;width:300px;height:50px;font-size:22px}#drag{position:absolute;left:160px;top:270px;width:180px;height:90px;background:#accac0;padding:15px}#scroll{position:absolute;left:430px;top:270px;width:280px;height:230px;overflow:auto;background:white}#scroll div{height:1600px;padding:20px}</style><h1>Pointer control test</h1><input placeholder="Click and type here"><div id="drag">Drag here</div><div id="scroll"><div>Scroll this panel</div></div><script>window.events=[];for(const type of ['mousedown','mouseup','mousemove','dblclick','contextmenu','wheel','keydown','keyup'])document.addEventListener(type,e=>{events.push({type,x:e.clientX,y:e.clientY,buttons:e.buttons,key:e.key,deltaY:e.deltaY});if(type==='contextmenu')e.preventDefault()});document.querySelector('#drag').addEventListener('mousedown',()=>window.dragging=true);document.addEventListener('mouseup',()=>window.dragging=false);</script>`,
        ),
    )
    w.showInactive()
  })
  const fixture = await fixtureOpened
  await page.getByRole('button', { name: 'Choose screen', exact: true }).click()
  await page.locator('.source-grid button').filter({ hasText: 'Pointer test source' }).click()
  await page.locator('.mode-button.live').waitFor()
  console.log('Source capture ready')
  await page.getByRole('button', { name: 'Source options' }).click()
  await page.getByRole('button', { name: 'Fit', exact: true }).click()
  await page.keyboard.press('Escape')
  const select = page.getByRole('button', { name: 'Interact with screen', exact: true })
  if (await select.count()) await select.click()
  else
    await page
      .getByRole('button', { name: /^Select/ })
      .first()
      .click()
  await page.locator('.pointer-control:not(.starting)').waitFor()
  const surface = await page.locator('.pointer-control').boundingBox()
  const at = (x, y) => ({
    x: surface.x + (x / 800) * surface.width,
    y: surface.y + (y / 600) * surface.height,
  })
  let p = at(240, 160)
  await page.mouse.click(p.x, p.y)
  await fixture.waitForFunction(() => events.some((e) => e.type === 'mouseup'))
  const click = await fixture.evaluate(() => events.find((e) => e.type === 'mousedown'))
  assert.ok(Math.abs(click.x - 240) < 5 && Math.abs(click.y - 160) < 5, JSON.stringify(click))
  console.log('Native click received', click)
  assert.ok(
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .find((w) => w.getTitle() === 'Pointer test source')
        .isFocused(),
    ),
    'Completed clicks must focus the real source for keyboard input',
  )
  // Focus returns to the real source after a completed gesture. Normal typing goes to that app.
  await fixture.keyboard.type('Kamvas pointer')
  assert.equal(await fixture.locator('input').inputValue(), 'Kamvas pointer')
  await fixture.evaluate(() => (events = []))
  p = at(220, 300)
  await page.mouse.move(p.x, p.y)
  await page.mouse.down()
  p = at(330, 380)
  await page.mouse.move(p.x, p.y, { steps: 12 })
  await page.mouse.up()
  await fixture.waitForFunction(() => events.some((e) => e.type === 'mouseup'))
  const drag = await fixture.evaluate(() =>
    events.filter((e) => e.type === 'mousemove' && e.buttons === 1),
  )
  assert.ok(drag.length > 1, 'Drag moves must retain the button state')
  p = at(530, 340)
  await page.mouse.move(p.x, p.y)
  await page.mouse.wheel(0, 300)
  await page.waitForTimeout(500)
  console.log(
    'Scroll diagnostic',
    await fixture.evaluate(() => ({
      events: events.slice(-5),
      scroll: document.querySelector('#scroll').scrollTop,
    })),
  )
  await fixture.waitForFunction(() => document.querySelector('#scroll').scrollTop > 0)
  for (let i = 0; i < 5; i++) {
    const before = await fixture.locator('#scroll').evaluate((el) => el.scrollTop)
    let from = at(350, 250)
    await page.mouse.move(from.x, from.y)
    let to = at(530, 340)
    await page.mouse.move(to.x, to.y)
    await page.mouse.wheel(0, 80)
    await fixture.waitForFunction(
      (value) => document.querySelector('#scroll').scrollTop > value,
      before,
      { timeout: 5000 },
    )
  }
  console.log('Drag and native scrolling received')
  await page.getByRole('button', { name: 'Source options' }).click()
  await page.getByRole('button', { name: 'Crop view', exact: true }).click()
  await page.mouse.move(surface.x + surface.width * 0.25, surface.y + surface.height * 0.25)
  await page.mouse.down()
  await page.mouse.move(surface.x + surface.width * 0.75, surface.y + surface.height * 0.75, {
    steps: 8,
  })
  await page.mouse.up()
  await page.locator('.pointer-control:not(.starting)').waitFor()
  const croppedSurface = await page.locator('.pointer-control').boundingBox()
  await fixture.evaluate(() => (events = []))
  await page.mouse.click(
    croppedSurface.x + croppedSurface.width * 0.5,
    croppedSurface.y + croppedSurface.height * 0.5,
  )
  await fixture.waitForFunction(() => events.some((e) => e.type === 'mouseup'))
  const croppedClick = await fixture.evaluate(() => events.find((e) => e.type === 'mousedown'))
  assert.ok(
    Math.abs(croppedClick.x - 400) < 5 && Math.abs(croppedClick.y - 300) < 5,
    JSON.stringify(croppedClick),
  )
  await page.getByRole('button', { name: 'Freeze', exact: true }).click()
  assert.equal(
    await page.locator('.pointer-control').count(),
    0,
    'Frozen images must not send source input',
  )
  await fs.mkdir('test-results', { recursive: true })
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()
      .find((w) => w.getTitle() === 'Live Canvas')
      .showInactive(),
  )
  const image = await app.evaluate(async ({ BrowserWindow }) =>
    (
      await BrowserWindow.getAllWindows()
        .find((w) => w.getTitle() === 'Live Canvas')
        .webContents.capturePage(undefined, { stayAwake: true })
    )
      .toPNG()
      .toString('base64'),
  )
  await fs.writeFile('test-results/pointer.png', Buffer.from(image, 'base64'))
  assert.deepEqual(errors, [])
  console.log(
    JSON.stringify({
      passed: true,
      nativeClick: click,
      nativeDragMoves: drag.length,
      nativeScroll: true,
      sourceTyping: true,
      cropMapping: croppedClick,
      frozenDisablesControl: true,
      rendererErrors: errors,
    }),
  )
} catch (e) {
  console.error(e)
  for (const p of app.windows()) {
    console.log(await p.title(), (await p.locator('body').innerText()).slice(-1400))
  }
  throw e
} finally {
  await app.close()
  await server.close()
}
