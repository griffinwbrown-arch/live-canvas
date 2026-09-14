import React, { useEffect, useRef, useState } from 'react'
import { useEditor, useValue } from 'tldraw'
import { mapPointer } from './geometry.mjs'

export function PointerControl({
  controlling,
  stopControl,
  live,
  sourceId,
  crop,
  frame,
  onStatus,
}: {
  controlling: boolean
  stopControl(): void
  live: boolean
  sourceId: string
  crop: CaptureRect
  frame?: { left: number; top: number; width: number; height: number }
  onStatus: (text: string) => void
}) {
  const editor = useEditor()
  const tool = useValue('pointer tool', () => editor.getCurrentToolId(), [editor])
  const active =
    live && controlling && tool === 'select' && !!sourceId && !!window.desktop?.setControl
  const layer = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const queue = useRef<Promise<void>>(Promise.resolve())
  const pendingMove = useRef<Parameters<NonNullable<Window['desktop']>['pointerInput']>[0] | null>(
    null,
  )
  const raf = useRef(0)
  const enabled = useRef(false)
  const generation = useRef(0)
  const last = useRef({ x: 0, y: 0 })
  const down = useRef(false)
  const status = useRef(onStatus)
  status.current = onStatus
  useEffect(() => {
    let disposed = false
    generation.current++
    setReady(false)
    enabled.current = false
    if (!active) return
    queue.current = queue.current
      .catch(() => {})
      .then(() => window.desktop!.setControl(sourceId))
      .then(() => {
        if (disposed) return
        enabled.current = true
        setReady(true)
        status.current(
          'Screen control is on. Choose Select to move annotations, or press Escape to stop.',
        )
      })
      .catch((error) => status.current(error.message))
    return () => {
      disposed = true
      generation.current++
      enabled.current = false
      down.current = false
      cancelAnimationFrame(raf.current)
      pendingMove.current = null
      queue.current = queue.current
        .catch(() => {})
        .then(() => window.desktop!.setControl(null))
        .catch(() => {})
    }
  }, [active, sourceId])
  const send = (event: Parameters<NonNullable<Window['desktop']>['pointerInput']>[0]) => {
    if (!enabled.current) return
    const current = generation.current
    queue.current = queue.current
      .then(() => {
        if (enabled.current && generation.current === current)
          return window.desktop!.pointerInput(event)
      })
      .catch((error) => {
        status.current(error.message)
        down.current = false
      })
  }
  const flush = () => {
    cancelAnimationFrame(raf.current)
    raf.current = 0
    if (pendingMove.current) {
      send(pendingMove.current)
      pendingMove.current = null
    }
  }
  const point = (e: { clientX: number; clientY: number }) => {
    const r = layer.current!.getBoundingClientRect()
    const p = mapPointer(e.clientX - r.left, e.clientY - r.top, r.width, r.height, crop)
    last.current = p
    return p
  }
  const mods = (e: { shiftKey: boolean; ctrlKey: boolean; altKey: boolean; metaKey: boolean }) =>
    (e.shiftKey ? 1 : 0) | (e.ctrlKey ? 2 : 0) | (e.altKey ? 4 : 0) | (e.metaKey ? 8 : 0)
  useEffect(() => {
    const element = layer.current
    if (!ready || !element) return
    const wheel = (event: WheelEvent) => {
      event.preventDefault()
      event.stopPropagation()
      flush()
      const unit = event.deltaMode === 1 ? 40 : event.deltaMode === 2 ? element.clientHeight : 1
      send({
        kind: 'wheel',
        ...point(event),
        dx: event.deltaX * unit,
        dy: event.deltaY * unit,
        modifiers: mods(event),
      })
    }
    element.addEventListener('wheel', wheel, { passive: false })
    return () => element.removeEventListener('wheel', wheel)
  }, [ready, crop])
  if (!active) return null
  return (
    <div
      ref={layer}
      style={frame ? { ...frame, right: 'auto', bottom: 'auto' } : undefined}
      className={`pointer-control ${ready ? '' : 'starting'}`}
      tabIndex={0}
      role="application"
      aria-label="Control captured screen"
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        if (e.pointerType === 'touch') return
        e.preventDefault()
        e.stopPropagation()
        if (!ready || e.button > 2) return
        flush()
        down.current = true
        e.currentTarget.focus()
        e.currentTarget.setPointerCapture(e.pointerId)
        send({
          kind: 'down',
          ...point(e),
          button: e.button,
          buttons: e.buttons,
          modifiers: mods(e),
        })
      }}
      onPointerMove={(e) => {
        if (e.pointerType === 'touch') return
        e.stopPropagation()
        if (!ready) return
        pendingMove.current = { kind: 'move', ...point(e), buttons: e.buttons, modifiers: mods(e) }
        if (!raf.current) raf.current = requestAnimationFrame(flush)
      }}
      onPointerUp={(e) => {
        if (e.pointerType === 'touch') return
        e.preventDefault()
        e.stopPropagation()
        flush()
        if (!down.current) return
        send({ kind: 'up', ...point(e), button: e.button, buttons: e.buttons, modifiers: mods(e) })
        down.current = e.buttons !== 0
        if (!down.current && e.currentTarget.hasPointerCapture(e.pointerId))
          e.currentTarget.releasePointerCapture(e.pointerId)
      }}
      onPointerCancel={() => {
        flush()
        send({ kind: 'release' })
        down.current = false
      }}
      onLostPointerCapture={() => {
        if (down.current) {
          flush()
          send({ kind: 'release' })
          down.current = false
        }
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === 'touch') return
        if (!down.current) {
          flush()
          send({ kind: 'leave', ...point(e) })
        }
      }}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Escape') {
          e.preventDefault()
          flush()
          send({ kind: 'release' })
          stopControl()
          editor.setCurrentTool('select')
          return
        }
        e.preventDefault()
        send({
          kind: 'keyDown',
          ...last.current,
          keyCode: e.keyCode,
          modifiers: mods(e),
          text: e.key.length === 1 ? e.key : undefined,
        })
      }}
      onKeyUp={(e) => {
        e.preventDefault()
        e.stopPropagation()
        send({ kind: 'keyUp', ...last.current, keyCode: e.keyCode, modifiers: mods(e) })
      }}
    >
      {!ready && <span className="pointer-starting">Starting pointer control…</span>}
    </div>
  )
}
