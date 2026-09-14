export const FULL = Object.freeze({ x: 0, y: 0, w: 1, h: 1 })
/** @param {{x:number,y:number,z:number}|null} navigation */
export function canvasView(
  sourceWidth,
  sourceHeight,
  crop,
  width,
  height,
  fit = false,
  navigation = null,
) {
  const source = pixelRect(navigation ? FULL : crop, sourceWidth, sourceHeight)
  const zoom = navigation
    ? Math.max(Math.min(width / sourceWidth, height / sourceHeight), navigation.z)
    : (fit ? Math.min : Math.max)(width / source.w, height / source.h)
  const page = {
    x: source.x + (source.w - width / zoom) / 2,
    y: source.y + (source.h - height / zoom) / 2,
    w: width / zoom,
    h: height / zoom,
  }
  if (navigation) {
    page.x = clampCenter(navigation.x, page.w, sourceWidth) - page.w / 2
    page.y = clampCenter(navigation.y, page.h, sourceHeight) - page.h / 2
  }
  const visible = {
    x: Math.max(page.x, source.x),
    y: Math.max(page.y, source.y),
    w: Math.min(page.x + page.w, source.x + source.w) - Math.max(page.x, source.x),
    h: Math.min(page.y + page.h, source.y + source.h) - Math.max(page.y, source.y),
  }
  return {
    source,
    page,
    zoom,
    pointerFrame: {
      left: (visible.x - page.x) * zoom,
      top: (visible.y - page.y) * zoom,
      width: visible.w * zoom,
      height: visible.h * zoom,
    },
    pointerCrop: {
      x: visible.x / sourceWidth,
      y: visible.y / sourceHeight,
      w: visible.w / sourceWidth,
      h: visible.h / sourceHeight,
    },
  }
}
export function cropFromView(selection, view, sourceWidth, sourceHeight) {
  const x = Math.max(view.source.x, view.page.x + selection.x * view.page.w)
  const y = Math.max(view.source.y, view.page.y + selection.y * view.page.h)
  const right = Math.min(
    view.source.x + view.source.w,
    view.page.x + (selection.x + selection.w) * view.page.w,
  )
  const bottom = Math.min(
    view.source.y + view.source.h,
    view.page.y + (selection.y + selection.h) * view.page.h,
  )
  if (right - x < 2 || bottom - y < 2) return null
  return {
    x: x / sourceWidth,
    y: y / sourceHeight,
    w: (right - x) / sourceWidth,
    h: (bottom - y) / sourceHeight,
  }
}
export function mapPointer(x, y, width, height, crop) {
  const clamp = (v) => Math.max(0, Math.min(1, v))
  return {
    x: clamp(crop.x + clamp(x / width) * crop.w),
    y: clamp(crop.y + clamp(y / height) * crop.h),
  }
}
export function rectFromPoints(a, b, width, height) {
  const clamp = (v, max) => Math.min(max, Math.max(0, v))
  const x = clamp(Math.min(a.x, b.x), width),
    y = clamp(Math.min(a.y, b.y), height)
  return {
    x: x / width,
    y: y / height,
    w: (clamp(Math.max(a.x, b.x), width) - x) / width,
    h: (clamp(Math.max(a.y, b.y), height) - y) / height,
  }
}
export function pixelRect(rect, width, height) {
  return { x: rect.x * width, y: rect.y * height, w: rect.w * width, h: rect.h * height }
}
export function fitSize(width, height, availableWidth, availableHeight) {
  const scale = Math.min(availableWidth / width, availableHeight / height)
  return {
    width: Math.max(1, Math.floor(width * scale)),
    height: Math.max(1, Math.floor(height * scale)),
  }
}

// The anchor stays under the fingers, with bounds that can reveal the entire source.
export function navigateView(
  view,
  sourceWidth,
  sourceHeight,
  width,
  height,
  scale,
  from = { x: width / 2, y: height / 2 },
  to = from,
) {
  const min = Math.min(width / sourceWidth, height / sourceHeight)
  const z = Math.max(min, Math.min(Math.max(8, min), view.zoom * scale))
  const w = width / z,
    h = height / z
  const x = view.page.x + from.x / view.zoom - to.x / z + w / 2
  const y = view.page.y + from.y / view.zoom - to.y / z + h / 2
  return { x: clampCenter(x, w, sourceWidth), y: clampCenter(y, h, sourceHeight), z }
}

function clampCenter(value, extent, total) {
  return extent >= total ? total / 2 : Math.max(extent / 2, Math.min(total - extent / 2, value))
}
