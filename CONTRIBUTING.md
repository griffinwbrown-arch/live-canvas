# Contributing

Start with the README setup steps. Keep changes focused, preserve the pen workflow, and include evidence for behavior changes.

## Source map

| Location                  | Responsibility                                                |
| ------------------------- | ------------------------------------------------------------- |
| `src/main.tsx`            | Capture lifecycle, view state, compositing, source picker     |
| `src/CanvasChrome.tsx`    | Toolbar, drawing options, window controls                     |
| `src/geometry.mjs`        | Crop, zoom, source-space coordinate mapping                   |
| `src/PointerControl.tsx`  | Explicit source-control interaction and cancellation          |
| `src/useViewGestures.ts`  | Touch and trackpad navigation                                 |
| `electron/`               | Native windows, IPC, clipboard, capture overlay, input helper |
| `tests/`                  | Unit and Electron integration checks                          |
| `scripts/screenshots.mjs` | Reproducible screenshots with synthetic content               |

## Before a pull request

Run `pnpm check` and `pnpm build`. Run `pnpm test:ui` on Windows when changing the canvas or toolbar. Run affected native tests for input/capture changes, one suite at a time. Record failures honestly: `pnpm test:pointer` currently fails its scrolling check. A green unit test does not prove physical pen behavior or meeting-app compatibility.

`pnpm format` formats source and docs. Never commit `.env.local`, a license key, personal screenshots, installers, build output, or `node_modules`. Do not alter tldraw's license enforcement or attribution.

Useful next work: editable session persistence, robust source scrolling, broader native-app compatibility, and real hardware/meeting-app testing. Describe the source application, Windows/display scaling, input device, reproduction steps, and expected behavior in bug reports. Use synthetic screenshots when possible.

Original contributions are under the repository's MIT license. Third-party dependencies keep their own terms.

## Regenerating the mockup GIFs

Run `python scripts/make-demos.py` with Pillow installed (`python -m pip install Pillow`). The renderer uses Segoe UI on Windows or DejaVu Sans on Linux. It writes the GIFs in `docs/demos/` and a review storyboard in the ignored `test-results/` directory.
