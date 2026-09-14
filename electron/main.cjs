const {
  app,
  BrowserWindow,
  desktopCapturer,
  screen,
  session,
  ipcMain,
  clipboard,
  ClipboardItem,
  nativeImage,
  dialog,
  globalShortcut,
  Menu,
  protocol,
  net,
} = require('electron')
const { pathToFileURL } = require('node:url')
const path = require('node:path')
const fs = require('node:fs')
const { InputBridge } = require('./input.cjs')
const input = new InputBridge()
let controlledSource = null,
  selectedSource = null,
  controlGeneration = 0
let main,
  overlay,
  cropData,
  selectedId,
  prefs = {}
const testing = process.argv.includes('--test')
const { loadOrigin } = require('./runtime-config.cjs')
const APP_ORIGIN = loadOrigin()
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'live-canvas',
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true },
  },
])
if (testing)
  app.setPath('userData', path.join(app.getPath('temp'), 'live-canvas-package-test-profile'))
app.setAppUserModelId('com.griffinbrown.livecanvas')
if (app.isPackaged && !testing) {
  if (!app.requestSingleInstanceLock()) {
    app.quit()
    process.exit(0)
  }
  app.on('second-instance', () => {
    if (main) {
      if (main.isMinimized()) main.restore()
      main.show()
      main.focus()
    }
  })
}
const prefsPath = () => path.join(app.getPath('userData'), 'preferences.json')
function savePrefs() {
  fs.writeFileSync(prefsPath(), JSON.stringify(prefs))
}
async function sources(thumbnailSize = { width: 320, height: 180 }) {
  return desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize })
}
function moveTo(id) {
  const display = screen.getAllDisplays().find((d) => d.id === Number(id))
  if (!display) throw Error('That display is no longer connected.')
  const b = display.workArea
  const full = main.isFullScreen()
  if (full) main.setFullScreen(false)
  main.unmaximize()
  main.setBounds({
    x: b.x + 24,
    y: b.y + 24,
    width: Math.max(600, b.width - 48),
    height: Math.max(480, b.height - 48),
  })
  main.maximize()
  if (full) main.setFullScreen(true)
  prefs.displayId = display.id
  savePrefs()
}
async function cropScreen(usePointer = false) {
  if (overlay) return
  const selected = selectedId
    ? (await sources({ width: 0, height: 0 })).find((s) => s.id === selectedId)
    : null
  const display = usePointer
    ? screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
    : screen.getAllDisplays().find((d) => String(d.id) === selected?.display_id) ||
      screen.getPrimaryDisplay()
  const list = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: {
      width: Math.round(display.size.width * display.scaleFactor),
      height: Math.round(display.size.height * display.scaleFactor),
    },
  })
  const source = list.find((s) => s.display_id === String(display.id))
  if (!source || source.thumbnail.isEmpty()) throw Error('Could not capture this monitor.')
  cropData = { image: source.thumbnail.toDataURL(), sourceId: source.id }
  overlay = new BrowserWindow({
    ...display.bounds,
    frame: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    resizable: false,
    movable: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'crop-preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  overlay.setMenu(null)
  overlay.once('ready-to-show', () => {
    overlay.show()
    overlay.focus()
  })
  overlay.on('closed', () => {
    overlay = null
    cropData = null
  })
  await overlay.loadFile(path.join(__dirname, 'crop.html'))
}
function imageFrom(data) {
  if (
    typeof data !== 'string' ||
    !data.startsWith('data:image/png;base64,') ||
    data.length > 100_000_000
  )
    throw Error('Invalid or oversized image.')
  const image = nativeImage.createFromDataURL(data)
  if (image.isEmpty()) throw Error('The image is empty.')
  return image
}
app.whenReady().then(async () => {
  protocol.handle('live-canvas', (request) => {
    const url = new URL(request.url)
    if (url.hostname !== new URL(APP_ORIGIN).hostname || request.method !== 'GET')
      return new Response('Not found', { status: 404 })
    const root = path.join(__dirname, '../dist')
    let file
    try {
      file = path.resolve(
        root,
        '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname),
      )
    } catch {
      return new Response('Invalid path', { status: 400 })
    }
    const relative = path.relative(root, file)
    if (relative.startsWith('..') || path.isAbsolute(relative))
      return new Response('Not found', { status: 404 })
    return net.fetch(pathToFileURL(file).toString())
  })
  try {
    prefs = JSON.parse(fs.readFileSync(prefsPath(), 'utf8'))
  } catch {}
  main = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 600,
    minHeight: 420,
    frame: false,
    show: false,
    backgroundColor: '#ffffff',
    title: 'Live Canvas',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  })
  main.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  main.webContents.on('will-navigate', (e) => e.preventDefault())
  const handle = (name, fn) =>
    ipcMain.handle(name, (event, ...args) => {
      if (event.sender !== main.webContents || event.senderFrame !== main.webContents.mainFrame)
        throw Error('Unsupported sender')
      return fn(...args)
    })
  handle('sources', async () =>
    (await sources())
      .filter((s) => !s.name.includes('Live Canvas') && !s.name.includes('Select capture area'))
      .map((s) => ({
        id: s.id,
        name: s.name,
        displayId: s.display_id,
        thumbnail: s.thumbnail.toDataURL(),
      })),
  )
  handle('select-source', async (id) => {
    const source = (await sources({ width: 0, height: 0 })).find((s) => s.id === id)
    if (!source) throw Error('Source is no longer available.')
    controlGeneration++
    controlledSource = null
    await input.release()
    selectedId = id
    selectedSource = source
  })
  handle('set-control', async (id) => {
    const generation = ++controlGeneration
    controlledSource = null
    await input.release()
    if (!id) return
    if (id !== selectedId) throw Error('Select a live source before using pointer control.')
    const source = selectedSource
    if (!source) throw Error('The captured source is no longer available.')
    await input.start()
    if (generation === controlGeneration) controlledSource = source
  })
  handle('pointer-input', async (event) => {
    if (!controlledSource) return
    const allowed = ['move', 'down', 'up', 'wheel', 'leave', 'keyDown', 'keyUp', 'release']
    if (!event || !allowed.includes(event.kind)) throw Error('Unsupported pointer action.')
    if (event.kind === 'release') return input.release()
    if (![event.x, event.y].every((v) => Number.isFinite(v) && v >= 0 && v <= 1))
      throw Error('Pointer is outside the captured source.')
    const button = Number(event.button) || 0,
      buttons = Number(event.buttons) || 0,
      modifiers = Number(event.modifiers) || 0
    if (
      ![0, 1, 2].includes(button) ||
      !Number.isInteger(buttons) ||
      buttons < 0 ||
      buttons > 7 ||
      !Number.isInteger(modifiers) ||
      modifiers < 0 ||
      modifiers > 15
    )
      throw Error('Invalid pointer state.')
    let handle = 0,
      x = event.x,
      y = event.y
    if (controlledSource.id.startsWith('screen:')) {
      const display = screen
        .getAllDisplays()
        .find((d) => String(d.id) === controlledSource.display_id)
      if (!display) {
        controlledSource = null
        await input.release()
        throw Error('The source monitor was disconnected.')
      }
      const point = screen.dipToScreenPoint({
        x: Math.round(display.bounds.x + x * (display.bounds.width - 1)),
        y: Math.round(display.bounds.y + y * (display.bounds.height - 1)),
      })
      x = point.x
      y = point.y
    } else if (controlledSource.id.startsWith('window:'))
      handle = Number(controlledSource.id.split(':')[1])
    else throw Error('This source does not support pointer control.')
    if (!Number.isSafeInteger(handle)) throw Error('Invalid source window.')
    const excluded = main.getNativeWindowHandle().readBigUInt64LE().toString()
    const dx = Math.round(Math.max(-1200, Math.min(1200, Number(event.dx) || 0))),
      dy = Math.round(Math.max(-1200, Math.min(1200, Number(event.dy) || 0)))
    const key = Math.round(Math.max(0, Math.min(255, Number(event.keyCode) || 0)))
    const text =
      typeof event.text === 'string' && event.text.length <= 2
        ? Buffer.from(event.text).toString('base64')
        : ''
    await input.send([
      event.kind,
      handle,
      excluded,
      x,
      y,
      button,
      buttons,
      dx,
      dy,
      modifiers,
      key,
      text,
    ])
  })
  session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
    try {
      if (request.frame !== main.webContents.mainFrame || !selectedId) return callback({})
      const source = (await sources({ width: 0, height: 0 })).find((s) => s.id === selectedId)
      callback(source ? { video: source } : {})
    } catch {
      callback({})
    }
  })
  handle('displays', () =>
    screen.getAllDisplays().map((d) => ({
      id: d.id,
      label: d.label || `Display ${d.id}`,
      current: screen.getDisplayMatching(main.getBounds()).id === d.id,
    })),
  )
  handle('move-to', moveTo)
  handle('window-state', () => ({ fullscreen: main.isFullScreen() }))
  handle('window-action', (action) => {
    if (action === 'minimize') main.minimize()
    else if (action === 'close') main.close()
    else if (action === 'fullscreen') main.setFullScreen(!main.isFullScreen())
  })
  const fullScreenChanged = (fullscreen) => {
    prefs.fullscreen = fullscreen
    if (!testing) savePrefs()
    main.webContents.send('window-state', { fullscreen })
  }
  main.on('enter-full-screen', () => fullScreenChanged(true))
  main.on('leave-full-screen', () => fullScreenChanged(false))
  handle('crop-screen', cropScreen)
  handle('copy-image', async (data) => {
    await clipboard.write([
      new ClipboardItem({
        'image/png': new Blob([imageFrom(data).toPNG()], { type: 'image/png' }),
      }),
    ])
    return true
  })
  handle('clipboard-image', async () => {
    for (const item of await clipboard.read()) {
      if (item.types.includes('image/png')) {
        const blob = await item.getType('image/png')
        return nativeImage.createFromBuffer(Buffer.from(await blob.arrayBuffer())).toDataURL()
      }
    }
    return null
  })
  handle('save-image', async (data) => {
    const image = imageFrom(data)
    const result = await dialog.showSaveDialog(main, {
      defaultPath: path.join(
        app.getPath('pictures'),
        `Live Canvas ${new Date().toISOString().replace(/[:.]/g, '-')}.png`,
      ),
      filters: [{ name: 'PNG image', extensions: ['png'] }],
    })
    if (result.canceled || !result.filePath) return null
    await fs.promises.writeFile(result.filePath, image.toPNG())
    return result.filePath
  })
  ipcMain.handle('crop-ready', (e) => (e.sender === overlay?.webContents ? cropData?.image : null))
  ipcMain.on('crop-cancel', (e) => {
    if (e.sender === overlay?.webContents) overlay.close()
  })
  ipcMain.on('crop-commit', (e, rect) => {
    if (e.sender !== overlay?.webContents || !cropData) return
    if (
      !rect ||
      !['x', 'y', 'w', 'h'].every((k) => Number.isFinite(rect[k])) ||
      rect.x < 0 ||
      rect.y < 0 ||
      rect.w <= 0 ||
      rect.h <= 0 ||
      rect.x + rect.w > 1.001 ||
      rect.y + rect.h > 1.001
    )
      return
    const capture = { sourceId: cropData.sourceId, crop: rect }
    overlay.close()
    main.show()
    main.focus()
    main.webContents.send('capture', capture)
  })
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: 'Canvas',
        submenu: [
          {
            label: 'Capture screen region',
            accelerator: 'CommandOrControl+Alt+S',
            click: () =>
              cropScreen().catch((e) => main.webContents.send('command', { error: e.message })),
          },
          {
            label: 'Paste screenshot',
            accelerator: 'CommandOrControl+Shift+V',
            click: () => main.webContents.send('command', 'paste'),
          },
          { type: 'separator' },
          { role: 'quit' },
        ],
      },
      { label: 'View', submenu: [{ role: 'togglefullscreen' }, { role: 'toggleDevTools' }] },
    ]),
  )
  main.setMenuBarVisibility(false)
  main.webContents.on('render-process-gone', () => {
    controlGeneration++
    controlledSource = null
    void input.release().catch(() => {})
  })
  if (!app.isPackaged && process.env.LIVE_CANVAS_DEV)
    await main.loadURL(process.env.LIVE_CANVAS_DEV)
  else await main.loadURL(APP_ORIGIN)
  if (!testing) {
    const display =
      screen.getAllDisplays().find((d) => d.id === prefs.displayId) ||
      screen.getAllDisplays().find((d) => /huion|kamvas|kanvas/i.test(d.label))
    if (display) moveTo(display.id)
    if (prefs.fullscreen !== false) main.setFullScreen(true)
    main.show()
    const registered = globalShortcut.register('CommandOrControl+Alt+S', () =>
      cropScreen(true).catch((e) => main.webContents.send('command', { error: e.message })),
    )
    if (!registered)
      setTimeout(
        () =>
          main.webContents.send('command', {
            error: 'The capture shortcut is in use. Use the Capture region button.',
          }),
        1500,
      )
    console.log(
      `Live Canvas opened on ${screen.getDisplayMatching(main.getBounds()).label || 'selected display'}. Capture shortcut: ${registered ? 'ready' : 'unavailable'}.`,
    )
  }
})
app.on('window-all-closed', () => app.quit())
app.on('will-quit', () => globalShortcut.unregisterAll())
app.on('before-quit', () => {
  controlledSource = null
  input.close()
})
