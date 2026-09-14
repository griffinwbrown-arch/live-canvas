# Publication audit

Reviewed September 14, 2026 for the initial public source release (0.3.3).

This was a focused code and release-readiness review of capture/rendering, crop and zoom math, source input, Electron IPC, launch/build scripts, dependency advisories, and publishable files. It is not a claim that every Windows application, tablet, or meeting client is compatible, or a formal security certification.

## Fixed during this review

| Finding                                                                     | Change                                                                               | Evidence                                                                                                               |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Queued pointer events could execute after source control ended              | Input callbacks check the current control generation before dispatch                 | UI regression holds an input request, queues more input, exits control, then verifies that queued events are discarded |
| Packaging copied over old output, retaining stale files                     | Stage fresh `dist` and `electron` directories within the checked staging root        | Stale marker verification before the release build                                                                     |
| Packaged hostname was tied to the maintainer's domain                       | Configurable `LIVE_CANVAS_HOST` writes a local runtime config; validates host syntax | Host configuration tests and a packaged-app smoke test                                                                 |
| Installed app honored a development-server override                         | Packaged apps always load bundled content                                            | Code-path review; packaged test with an invalid override                                                               |
| View resizing could retain inappropriate zoom bounds                        | Re-clamp camera bounds to the resized viewport                                       | Geometry regression                                                                                                    |
| Native helper stderr could grow without bound; stdin errors lacked handling | Bound diagnostic text and reject pending calls on pipe errors                        | Code review and native click smoke test                                                                                |
| Public docs mixed local install details and historical behavior             | New README, user guide, architecture guide, and explicit limitations                 | Reviewed against current code and screenshots                                                                          |
| Inconsistent formatting made changes difficult to review                    | Prettier configuration and CI formatting/type/unit/build checks                      | `pnpm check`                                                                                                           |

## Validation

- Production dependency advisory check: **0 known advisories** reported by `pnpm audit --prod` on the review date. This is an advisory snapshot, not proof of absence of vulnerabilities.
- Twelve unit checks cover crop, source pointer mapping, pinch anchors, zoom limits, resize bounds, and runtime hostname validation.
- Electron UI regression covers Clear/Undo, selecting/moving ink over a live source, pinch isolation, source-mode input cancellation, responsive widths, fullscreen, and reduced motion.
- Native crop-overlay checks passed for cancellation, region selection, and starting the live crop. The test now matches the button name including shortcut text and surfaces pending-window errors correctly.
- Packaged capture, native clicking, zoom buttons, and injected pinch passed with a deliberately invalid development URL override.
- GitHub CI passed a clean Linux install, formatting, TypeScript, unit tests, and renderer build.
- Public screenshots are generated through the app with a synthetic source. They contain no personal desktop capture or license key.
- Source publication excludes environment files, generated build output, installers, test output, developer dependencies, and local chronological work notes.

## Open limitations

**Native scrolling remains unresolved.** Earlier local runs passed it, but recent repeated native-window checks failed. Clicking, dragging, and typing have passed the local fixture. Do not extrapolate that result to all applications. Local Ctrl+wheel zoom uses a separate path.

**Sessions are not persisted.** Closing the app loses editable annotations. Copy/save before closing.

**Hardware and call validation are limited.** Automated touch injection is not physical pinch testing. Kamvas 13 has no finger touch. Meeting-app window sharing is a proposed workflow, not a tested integration with every call client.

**Licensing is separate from the source license.** MIT covers this project's original code. tldraw has its own terms and production keys. Downstream production builds need an appropriate license; no maintainer key or prelicensed installer is published here.

**Renderer touch warnings:** the packaged touch test has logged passive-listener preventDefault warnings from the drawing/event stack while its zoom assertions still pass. No renderer exception was observed; physical gesture behavior needs broader testing.
