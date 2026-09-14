import { useEffect, useRef, type RefObject } from 'react'

type Point = { x: number; y: number }
// Touch navigates the picture; pen and mouse continue to edit/control it.
export function useViewGestures(
  stage: RefObject<HTMLDivElement | null>,
  enabled: boolean,
  navigate: (scale: number, from?: Point, to?: Point) => void,
) {
  const callback = useRef(navigate)
  callback.current = navigate
  useEffect(() => {
    const element = stage.current
    if (!element || !enabled) return
    const touches = new Map<number, Point>()
    let penDown = false
    const blocked = (target: EventTarget | null) =>
      target instanceof Element &&
      !!target.closest('.canvas-chrome,.view-controls,.selection-layer')
    const point = (e: PointerEvent | WheelEvent) => {
      const r = element.getBoundingClientRect()
      return { x: e.clientX - r.left, y: e.clientY - r.top }
    }
    const gesture = () => {
      const [a, b] = [...touches.values()]
      return b
        ? {
            center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
            distance: Math.hypot(b.x - a.x, b.y - a.y),
          }
        : { center: a, distance: 0 }
    }
    const stop = (e: Event) => {
      e.preventDefault()
      e.stopImmediatePropagation()
    }
    const down = (e: PointerEvent) => {
      if (e.pointerType === 'pen') {
        penDown = true
        touches.clear()
        return
      }
      if (e.pointerType !== 'touch' || blocked(e.target)) return
      stop(e)
      if (penDown) return
      touches.set(e.pointerId, point(e))
      element.setPointerCapture(e.pointerId)
    }
    const move = (e: PointerEvent) => {
      if (!touches.has(e.pointerId)) return
      stop(e)
      const before = gesture()
      touches.set(e.pointerId, point(e))
      const after = gesture()
      callback.current(
        before.distance > 5 && after.distance > 5 ? after.distance / before.distance : 1,
        before.center,
        after.center,
      )
    }
    const up = (e: PointerEvent) => {
      if (e.pointerType === 'pen') penDown = false
      if (!touches.has(e.pointerId)) return
      stop(e)
      touches.delete(e.pointerId)
      if (element.hasPointerCapture(e.pointerId)) element.releasePointerCapture(e.pointerId)
    }
    const wheel = (e: WheelEvent) => {
      if (!e.ctrlKey || blocked(e.target)) return
      stop(e)
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? element.clientHeight : 1
      callback.current(Math.exp(-Math.max(-300, Math.min(300, e.deltaY * unit)) * 0.005), point(e))
    }
    const clear = () => {
      touches.clear()
      penDown = false
    }
    element.addEventListener('pointerdown', down, { capture: true, passive: false })
    element.addEventListener('pointermove', move, { capture: true, passive: false })
    element.addEventListener('pointerup', up, true)
    element.addEventListener('pointercancel', up, true)
    element.addEventListener('lostpointercapture', up, true)
    element.addEventListener('wheel', wheel, { capture: true, passive: false })
    window.addEventListener('blur', clear)
    return () => {
      for (const id of touches.keys())
        if (element.hasPointerCapture(id)) element.releasePointerCapture(id)
      element.removeEventListener('pointerdown', down, true)
      element.removeEventListener('pointermove', move, true)
      element.removeEventListener('pointerup', up, true)
      element.removeEventListener('pointercancel', up, true)
      element.removeEventListener('lostpointercapture', up, true)
      element.removeEventListener('wheel', wheel, true)
      window.removeEventListener('blur', clear)
    }
  }, [stage, enabled])
}
