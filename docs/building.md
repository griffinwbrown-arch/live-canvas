# Building Live Canvas

## Local development

Use Windows, Node.js 22.12 or newer, and pnpm 11.19.0. Install dependencies with `pnpm install --frozen-lockfile`, then run `pnpm dev`. Local development does not require a tldraw production key.

After installing dependencies, the optional `Launch Live Canvas.vbs` launcher starts the development app without a terminal window.

## Windows executable

Production builds require your own valid tldraw license, appropriate to your usage and app hostname. See [tldraw's licensing documentation](https://tldraw.dev/community/license).

```powershell
Copy-Item .env.example .env.local
# Edit .env.local with your license key and a hostname covered by that license.
pnpm package:win
```

Set `VITE_TLDRAW_LICENSE_KEY` and `LIVE_CANVAS_HOST` in `.env.local`. The hostname becomes a local `live-canvas://.../` origin served from bundled files; it does not deploy a website. Ask tldraw about the appropriate license for your desktop distribution. Keep the SDK's license enforcement and required attribution intact.

The installer appears under `release/`. Build output, installers, and `.env.local` are ignored by Git. A frontend license key is embedded in your built app; packaging does not conceal it. No maintainer key or prelicensed installer is included in this repository.

## Checks

```powershell
pnpm check             # formatting, TypeScript, geometry and configuration tests
pnpm build             # production renderer
pnpm test:ui           # Windows UI tests with a synthetic source
pnpm test:overlay      # native capture overlay; may briefly show your desktop locally
pnpm test:pointer      # native input compatibility; scrolling is a known failure
pnpm test:packaged     # requires a packaged app and a valid production license
pnpm screenshots      # regenerate screenshots with a synthetic demo screen
```

Run Electron integration suites sequentially; they share a separate test profile. CI checks formatting, types, unit tests, and the renderer build. Physical input devices and meeting-app compatibility need separate testing.
