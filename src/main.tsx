import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Box, Editor, Tldraw } from 'tldraw'
import { getAssetUrlsByImport } from '@tldraw/assets/imports.vite'
import {
  FULL,
  canvasView,
  navigateView,
  cropFromView,
  pixelRect,
  rectFromPoints,
} from './geometry.mjs'
import 'tldraw/tldraw.css'
import './style.css'
import { PointerControl } from './PointerControl'
import { useViewGestures } from './useViewGestures'
import { CanvasChrome } from './CanvasChrome'
const components = {
  Background: () => null,
  PageMenu: null,
  NavigationPanel: null,
  ZoomMenu: null,
  Toolbar: null,
  StylePanel: null,
  MainMenu: null,
  ActionsMenu: null,
  QuickActions: null,
  HelperButtons: null,
}
const camera = { isLocked: true, wheelBehavior: 'none' as const, zoomSteps: [0.125, 1, 8] }
const assetUrls = getAssetUrlsByImport((url) => new URL(url, document.baseURI).href)
const readBlob = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = reject
    r.readAsDataURL(blob)
  })
const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image()
    i.onload = () => resolve(i)
    i.onerror = reject
    i.src = src
  })
function App() {
  const editor = useRef<Editor | null>(null)
  const stage = useRef<HTMLDivElement>(null)
  const background = useRef<HTMLCanvasElement>(null)
  const media = useRef<HTMLVideoElement | HTMLImageElement | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const [size, setSize] = useState({ w: 1600, h: 900 })
  const [crop, setCrop] = useState<CaptureRect>({ ...FULL })
  const [area, setArea] = useState({ width: 1000, height: 650 })
  const [mode, setMode] = useState<'blank' | 'live' | 'frozen' | 'image'>('blank')
  const [label, setLabel] = useState('Whiteboard')
  const [sources, setSources] = useState<Source[] | null>(null)
  const [displays, setDisplays] = useState<{ id: number; label: string; current: boolean }[]>([])
  const [status, setStatus] = useState('')
  const [toastVisible, setToastVisible] = useState(false)
  const [fit, setFit] = useState(false)
  const [controlling, setControlling] = useState(false)
  useEffect(() => {
    setControlling(false)
  }, [mode])
  const [toolbarHidden, setToolbarHidden] = useState(false)
  const [busy, setBusy] = useState(false)
  const [selecting, setSelecting] = useState<'crop' | 'snip' | null>(null)
  const [selection, setSelection] = useState<CaptureRect | null>(null)
  const drag = useRef<{ x: number; y: number } | null>(null)
  const [ready, setReady] = useState(false)
  const sourceAttempt = useRef(0)
  const sourceId = useRef('')
  const frozenFrame = useRef<HTMLCanvasElement | null>(null)
  const [navigation, setNavigation] = useState<{ x: number; y: number; z: number } | null>(null)
  useLayoutEffect(() => {
    setNavigation(null)
  }, [crop, size, fit])
  const view = canvasView(
    size.w,
    size.h,
    crop,
    Math.max(1, area.width),
    Math.max(1, area.height),
    fit,
    navigation,
  )
  const state = useRef({ mode, crop, size, view })
  state.current = { mode, crop, size, view }
  const navigate = (
    scale: number,
    from?: { x: number; y: number },
    to?: { x: number; y: number },
  ) => {
    const s = state.current
    const next = navigateView(s.view, s.size.w, s.size.h, area.width, area.height, scale, from, to)
    state.current = {
      ...s,
      view: canvasView(s.size.w, s.size.h, s.crop, area.width, area.height, fit, next),
    }
    setNavigation(next)
  }
  useViewGestures(stage, mode !== 'blank' && !selecting && !sources && !busy, navigate)
  const sourceDialog = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!status) return
    setToastVisible(true)
    const timer = setTimeout(() => setToastVisible(false), 5000)
    return () => clearTimeout(timer)
  }, [status])
  useEffect(() => {
    if (!sources) return
    const frame = requestAnimationFrame(() =>
      sourceDialog.current?.querySelector<HTMLButtonElement>('button')?.focus(),
    )
    return () => {
      cancelAnimationFrame(frame)
      document.querySelector<HTMLButtonElement>('.source-button')?.focus()
    }
  }, [sources])
  const fail = (error: unknown) =>
    setStatus(error instanceof Error ? error.message : 'Something went wrong. Please try again.')
  const stopStream = () => {
    stream.current?.getTracks().forEach((t) => {
      t.onended = null
      t.stop()
    })
    stream.current = null
  }
  const paint = useCallback(() => {
    const target = background.current
    if (!target) return
    const s = state.current
    const b = s.view.page
    const w = Math.max(1, Math.round(b.w)),
      h = Math.max(1, Math.round(b.h))
    if (target.width !== w) target.width = w
    if (target.height !== h) target.height = h
    const ctx = target.getContext('2d')!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, w, h)
    const source = s.mode === 'frozen' ? frozenFrame.current : media.current
    const c = s.view.source
    if (
      s.mode !== 'blank' &&
      source &&
      (!(source instanceof HTMLVideoElement) || source.readyState >= 2)
    )
      ctx.drawImage(source, c.x, c.y, c.w, c.h, c.x - b.x, c.y - b.y, c.w, c.h)
  }, [])
  useEffect(() => {
    let id = 0,
      lastTime = -1
    const tick = () => {
      const v = media.current
      if (
        state.current.mode === 'live' &&
        v instanceof HTMLVideoElement &&
        v.currentTime !== lastTime
      ) {
        lastTime = v.currentTime
        paint()
      }
      id = requestAnimationFrame(tick)
    }
    id = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(id)
      stopStream()
    }
  }, [paint])
  useLayoutEffect(() => {
    paint()
  }, [mode, crop, size, area, fit, navigation, paint])
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) =>
      setArea({ width: entry.contentRect.width, height: entry.contentRect.height }),
    )
    if (stage.current) observer.observe(stage.current)
    return () => observer.disconnect()
  }, [])
  useLayoutEffect(() => {
    const z = view.zoom
    editor.current?.setCameraOptions({ zoomSteps: [Math.min(0.125, z), Math.max(8, z)] })
    editor.current?.setCamera(
      { x: -view.page.x, y: -view.page.y, z },
      { force: true, immediate: true },
    )
  }, [view.page.x, view.page.y, view.zoom, ready])
  const startCapture = async (id?: string, nextCrop: CaptureRect = { ...FULL }) => {
    const attempt = ++sourceAttempt.current
    setBusy(true)
    let next: MediaStream | null = null
    try {
      if (id && window.desktop) await window.desktop.selectSource(id)
      next = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30, max: 30 } },
        audio: false,
      })
      const video = document.createElement('video')
      video.muted = true
      video.srcObject = next
      await video.play()
      if (attempt !== sourceAttempt.current) {
        next.getTracks().forEach((t) => t.stop())
        return
      }
      stopStream()
      media.current = video
      stream.current = next
      sourceId.current = id || ''
      const track = next.getVideoTracks()[0]
      track.onended = () => {
        freezeFrame()
        setMode('frozen')
        setStatus('Screen sharing ended. The last frame and your ink are still available.')
        stream.current = null
      }
      setSize({ w: video.videoWidth, h: video.videoHeight })
      setCrop(nextCrop)
      setMode('live')
      setLabel(sources?.find((s) => s.id === id)?.name || track.label || 'Screen')
      setSources(null)
      setStatus('Live picture. Ink stays fixed when the source moves. Freeze to mark up a frame.')
    } catch (error) {
      next?.getTracks().forEach((t) => t.stop())
      fail(error)
    } finally {
      if (attempt === sourceAttempt.current) setBusy(false)
    }
  }
  function freezeFrame() {
    const src = media.current
    if (!src) return
    const c = document.createElement('canvas')
    c.width = state.current.size.w
    c.height = state.current.size.h
    c.getContext('2d')!.drawImage(src, 0, 0, c.width, c.height)
    frozenFrame.current = c
  }
  function toggleFreeze() {
    if (mode === 'live') {
      freezeFrame()
      setMode('frozen')
      setStatus('Frozen. Your source can keep changing while you draw.')
    } else if (stream.current?.active) {
      setMode('live')
      setStatus('Live picture resumed. Ink stays in place.')
    }
  }
  async function chooseSource() {
    setToolbarHidden(false)
    try {
      if (window.desktop) setSources(await window.desktop.sources())
      else await startCapture()
    } catch (error) {
      fail(error)
    }
  }
  async function pasteScreenshot() {
    if (!window.desktop) return
    try {
      const data = await window.desktop.clipboardImage()
      if (!data) {
        setStatus('No image on the clipboard. Capture with Win + Shift + S, then paste here.')
        return
      }
      const image = await loadImage(data)
      sourceAttempt.current++
      stopStream()
      media.current = image
      setSize({ w: image.naturalWidth, h: image.naturalHeight })
      setCrop({ ...FULL })
      setMode('image')
      setLabel('Pasted screenshot')
      setStatus('Screenshot ready. Draw, then copy or save the result.')
    } catch (error) {
      fail(error)
    }
  }
  function whiteboard() {
    sourceAttempt.current++
    stopStream()
    media.current = null
    frozenFrame.current = null
    setMode('blank')
    setLabel('Whiteboard')
    setStatus('Blank canvas. Your existing ink is still here.')
  }
  async function composite() {
    // Snapshot the live frame before awaiting the ink export, so both exports use one background frame.
    paint()
    const bg = background.current!
    const b = state.current.view.page
    const output = document.createElement('canvas')
    output.width = bg.width
    output.height = bg.height
    const ctx = output.getContext('2d')!
    ctx.drawImage(bg, 0, 0)
    const ed = editor.current!
    const ids = [...ed.getCurrentPageShapeIds()]
    if (ids.length) {
      const result = await ed.toImage(ids, {
        format: 'png',
        background: false,
        padding: 0,
        bounds: new Box(b.x, b.y, b.w, b.h),
        pixelRatio: 1,
        scale: 1,
      })
      const image = await loadImage(await readBlob(result.blob))
      ctx.drawImage(image, 0, 0, output.width, output.height)
    }
    return output
  }
  async function exportImage(action: 'copy' | 'save', rect?: CaptureRect) {
    setBusy(true)
    try {
      let output = await composite()
      if (rect) {
        const b = pixelRect(rect, output.width, output.height)
        const c = document.createElement('canvas')
        c.width = Math.max(1, Math.round(b.w))
        c.height = Math.max(1, Math.round(b.h))
        c.getContext('2d')!.drawImage(output, b.x, b.y, b.w, b.h, 0, 0, c.width, c.height)
        output = c
      }
      const data = output.toDataURL('image/png')
      if (action === 'copy') {
        if (window.desktop) await window.desktop.copy(data)
        else {
          const blob = await new Promise<Blob>((resolve) =>
            output.toBlob((b) => resolve(b!), 'image/png'),
          )
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
        }
        setStatus('Copied picture + ink. Paste into your chat with Ctrl + V.')
      } else {
        if (window.desktop) {
          const saved = await window.desktop.save(data)
          setStatus(
            saved
              ? `Saved ${saved.split(/[\\/]/).pop()}`
              : 'Save canceled. Your canvas is unchanged.',
          )
        } else {
          const a = document.createElement('a')
          a.href = data
          a.download = 'Live Canvas.png'
          a.click()
          setStatus('Image saved.')
        }
      }
    } catch (error) {
      fail(error)
    } finally {
      setBusy(false)
    }
  }
  useEffect(() => {
    window.desktop?.displays().then(setDisplays).catch(fail)
    const off = window.desktop?.onCapture((data) => {
      void startCapture(data.sourceId, data.crop)
    })
    const command = window.desktop?.onCommand((value) => {
      if (value === 'paste') void pasteScreenshot()
      else if (typeof value === 'object') fail(new Error(value.error))
    })
    return () => {
      off?.()
      command?.()
    }
  }, [])
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelecting(null)
        setSelection(null)
        setSources(null)
      }
      const target = event.target as HTMLElement
      if (target.closest('input,textarea,[contenteditable="true"]')) return
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'c') {
        event.preventDefault()
        void exportImage('copy')
      }
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 's') {
        event.preventDefault()
        void exportImage('save')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })
  function selectionPoint(e: React.PointerEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  function finishSelection(e: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current) return
    const rect = rectFromPoints(drag.current, selectionPoint(e), area.width, area.height)
    drag.current = null
    if (rect.w * area.width < 12 || rect.h * area.height < 12) {
      setSelection(null)
      return
    }
    const action = selecting
    setSelecting(null)
    setSelection(null)
    if (action === 'crop') {
      const next = cropFromView(rect, view, size.w, size.h)
      if (next) {
        setCrop(next)
        setStatus('View cropped. Reset crop restores the original framing.')
      }
    } else void exportImage('save', rect)
  }
  return (
    <div className="app">
      <div className="stage" ref={stage}>
        <div className="surface">
          <canvas ref={background} className="picture" aria-label="Captured screen background" />
          <Tldraw
            assetUrls={assetUrls}
            licenseKey={import.meta.env.VITE_TLDRAW_LICENSE_KEY || undefined}
            components={components}
            options={{ camera }}
            onMount={(ed) => {
              editor.current = ed
              ed.user.updateUserPreferences({ colorScheme: 'light' })
              ed.setCurrentTool('draw')
              setReady(true)
            }}
          >
            <PointerControl
              controlling={controlling}
              stopControl={() => setControlling(false)}
              live={mode === 'live' && !selecting && !sources && !busy}
              sourceId={sourceId.current}
              crop={view.pointerCrop}
              frame={view.pointerFrame}
              onStatus={setStatus}
            />
            <CanvasChrome
              controlling={controlling}
              setControlling={setControlling}
              mode={mode}
              label={label}
              busy={busy}
              canResume={mode === 'frozen' && !!stream.current?.active}
              fit={fit}
              cropped={crop.w !== 1 || crop.h !== 1}
              chooseSource={() => void chooseSource()}
              captureRegion={() => void window.desktop?.cropScreen().catch(fail)}
              paste={() => void pasteScreenshot()}
              blank={whiteboard}
              crop={() => {
                setSelecting('crop')
                setSelection(null)
              }}
              resetCrop={() => setCrop({ ...FULL })}
              setFit={setFit}
              freeze={toggleFreeze}
              copy={() => void exportImage('copy')}
              save={() => void exportImage('save')}
              snip={() => {
                setSelecting('snip')
                setSelection(null)
              }}
              status={setStatus}
              displays={displays}
              moveDisplay={async (id) => {
                try {
                  await window.desktop!.moveTo(id)
                  setDisplays(await window.desktop!.displays())
                } catch (error) {
                  fail(error)
                }
              }}
              hidden={toolbarHidden || !!selecting}
              setHidden={setToolbarHidden}
            />
          </Tldraw>
          {mode !== 'blank' && !selecting && !sources && (
            <div className="view-controls glass" role="group" aria-label="View zoom">
              <button
                aria-label="Zoom out"
                title="Zoom out"
                disabled={busy}
                onClick={() => navigate(1 / 1.25)}
              >
                -
              </button>
              <button
                className="zoom-reset"
                aria-label="Reset view zoom"
                title="Return to selected crop"
                disabled={busy}
                onClick={() => setNavigation(null)}
              >
                {Math.round(
                  (view.zoom / Math.min(area.width / size.w, area.height / size.h)) * 100,
                )}
                %
              </button>
              <button
                aria-label="Zoom in"
                title="Zoom in"
                disabled={busy}
                onClick={() => navigate(1.25)}
              >
                +
              </button>
            </div>
          )}
          {selecting && (
            <div
              className="selection-layer"
              onPointerDown={(e) => {
                if (e.button !== 0) return
                drag.current = selectionPoint(e)
                e.currentTarget.setPointerCapture(e.pointerId)
              }}
              onPointerMove={(e) => {
                if (drag.current)
                  setSelection(
                    rectFromPoints(drag.current, selectionPoint(e), area.width, area.height),
                  )
              }}
              onPointerUp={finishSelection}
              onPointerCancel={() => {
                drag.current = null
                setSelection(null)
              }}
            >
              <div className="selection-hint">
                {selecting === 'crop'
                  ? 'Drag to crop the live view'
                  : 'Drag to save part of the picture + ink'}{' '}
                · Esc to cancel
              </div>
              {selection && (
                <div
                  className="selection-rect"
                  style={{
                    left: `${selection.x * 100}%`,
                    top: `${selection.y * 100}%`,
                    width: `${selection.w * 100}%`,
                    height: `${selection.h * 100}%`,
                  }}
                />
              )}
            </div>
          )}
        </div>
      </div>
      <div className={`status-toast glass ${toastVisible || busy ? 'visible' : ''}`} role="status">
        {busy ? 'Working…' : status}
      </div>
      {sources && (
        <div className="scrim" onClick={() => setSources(null)}>
          <section
            ref={sourceDialog}
            className="source-picker"
            role="dialog"
            aria-modal="true"
            aria-label="Choose a screen or window"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key !== 'Tab') return
              const buttons = [
                ...e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'),
              ]
              const first = buttons[0],
                last = buttons[buttons.length - 1]
              if (e.shiftKey && document.activeElement === first) {
                e.preventDefault()
                last?.focus()
              } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault()
                first?.focus()
              }
            }}
          >
            <div className="picker-heading">
              <div>
                <h2>Bring a screen into view</h2>
                <p>Choose a monitor or a window to draw over.</p>
              </div>
              <button onClick={() => setSources(null)}>Cancel</button>
            </div>
            <div className="source-grid">
              {sources.map((source) => (
                <button
                  key={source.id}
                  disabled={busy}
                  onClick={() => startCapture(source.id)}
                  title={source.name}
                >
                  <img src={source.thumbnail} alt="" />
                  <span>{source.name}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
createRoot(document.getElementById('root')!).render(
  import.meta.env.PROD && !import.meta.env.VITE_TLDRAW_LICENSE_KEY ? (
    <div style={{ padding: 40, maxWidth: 680 }}>
      <h2>Add your tldraw key to finish this desktop build</h2>
      <p>
        Put VITE_TLDRAW_LICENSE_KEY in .env.local and rebuild. You can use Launch Live Canvas.vbs to
        run the development prototype while you finish setup.
      </p>
    </div>
  ) : (
    <App />
  ),
)
