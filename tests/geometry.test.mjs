import test from 'node:test'
import assert from 'node:assert/strict'
import {
  fitSize,
  pixelRect,
  rectFromPoints,
  mapPointer,
  canvasView,
  cropFromView,
} from '../src/geometry.mjs'
test('reverse drag produces the same crop as forward drag', () => {
  assert.deepEqual(rectFromPoints({ x: 800, y: 600 }, { x: 200, y: 100 }, 1000, 1000), {
    x: 0.2,
    y: 0.1,
    w: 0.6,
    h: 0.5,
  })
})
test('drag outside the display is clamped', () => {
  assert.deepEqual(rectFromPoints({ x: -20, y: 100 }, { x: 1100, y: 900 }, 1000, 800), {
    x: 0,
    y: 0.125,
    w: 1,
    h: 0.875,
  })
})
test('crop maps into physical source pixels, independent of monitor scaling', () => {
  assert.deepEqual(pixelRect({ x: 0.25, y: 0.25, w: 0.5, h: 0.5 }, 3840, 2160), {
    x: 960,
    y: 540,
    w: 1920,
    h: 1080,
  })
  assert.deepEqual(fitSize(1920, 1080, 1000, 800), { width: 1000, height: 562 })
})
test('pointer coordinates map through a crop after the viewing window is resized', () => {
  const crop = { x: 0.25, y: 0.1, w: 0.5, h: 0.6 }
  assert.deepEqual(mapPointer(400, 200, 800, 400, crop), { x: 0.5, y: 0.4 })
  assert.deepEqual(mapPointer(200, 100, 400, 200, crop), { x: 0.5, y: 0.4 })
})
test('a drag leaving the viewport stays within the crop', () => {
  assert.deepEqual(mapPointer(-50, 600, 800, 400, { x: 0.25, y: 0.25, w: 0.5, h: 0.5 }), {
    x: 0.25,
    y: 0.75,
  })
})
test('Fill preserves aspect ratio and maps the visible source crop to the viewport', () => {
  const view = canvasView(1600, 900, { x: 0, y: 0, w: 1, h: 1 }, 1200, 900, false)
  assert.deepEqual(view.page, { x: 200, y: 0, w: 1200, h: 900 })
  assert.deepEqual(view.pointerCrop, { x: 0.125, y: 0, w: 0.75, h: 1 })
  assert.deepEqual(mapPointer(600, 450, 1200, 900, view.pointerCrop), { x: 0.5, y: 0.5 })
})
test('Fit preserves the complete source and offsets pointer control from the white margins', () => {
  const view = canvasView(800, 800, { x: 0, y: 0, w: 1, h: 1 }, 1600, 900, true)
  assert.equal(view.pointerFrame.left, 350)
  assert.equal(view.pointerFrame.width, 900)
  assert.deepEqual(view.pointerCrop, { x: 0, y: 0, w: 1, h: 1 })
  assert.equal(cropFromView({ x: 0, y: 0, w: 0.1, h: 1 }, view, 800, 800), null)
})
test('cropping a filled viewport composes with its existing source crop', () => {
  const view = canvasView(1600, 900, { x: 0, y: 0, w: 1, h: 1 }, 1200, 900, false)
  assert.deepEqual(cropFromView({ x: 0.25, y: 0.25, w: 0.5, h: 0.5 }, view, 1600, 900), {
    x: 0.3125,
    y: 0.25,
    w: 0.375,
    h: 0.5,
  })
})

const { navigateView } = await import('../src/geometry.mjs')
test('zooming out of a crop reveals the full source and clamps further zoom', () => {
  const crop = { x: 0.3, y: 0.3, w: 0.4, h: 0.4 }
  const start = canvasView(1600, 900, crop, 1200, 800)
  const nav = navigateView(start, 1600, 900, 1200, 800, 0.01)
  const next = canvasView(1600, 900, crop, 1200, 800, false, nav)
  assert.deepEqual(next.pointerCrop, { x: 0, y: 0, w: 1, h: 1 })
  assert.equal(next.zoom, 0.75)
  assert.equal(navigateView(next, 1600, 900, 1200, 800, 0.5).z, 0.75)
})
test('pinch keeps the image point beneath a moving midpoint', () => {
  const start = canvasView(1600, 900, { x: 0, y: 0, w: 1, h: 1 }, 1200, 800)
  const from = { x: 600, y: 400 },
    to = { x: 650, y: 440 }
  const nav = navigateView(start, 1600, 900, 1200, 800, 2, from, to)
  const next = canvasView(1600, 900, { x: 0, y: 0, w: 1, h: 1 }, 1200, 800, false, nav)
  assert.ok(Math.abs(start.page.x + from.x / start.zoom - next.page.x - to.x / next.zoom) < 1e-9)
  assert.ok(Math.abs(start.page.y + from.y / start.zoom - next.page.y - to.y / next.zoom) < 1e-9)
  assert.equal(next.zoom, start.zoom * 2)
})

test('resizing a zoomed view keeps source bounds visible and source input valid', () => {
  const next = canvasView(1600, 900, { x: 0, y: 0, w: 1, h: 1 }, 3200, 1800, false, {
    x: 1500,
    y: 850,
    z: 0.75,
  })
  assert.equal(next.zoom, 2)
  assert.deepEqual(next.pointerCrop, { x: 0, y: 0, w: 1, h: 1 })
  assert.deepEqual(next.page, { x: 0, y: 0, w: 1600, h: 900 })
})
