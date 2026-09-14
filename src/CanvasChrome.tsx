import { useEffect, useRef, useState, type CSSProperties } from 'react'
import {
  DefaultColorStyle,
  DefaultFillStyle,
  DefaultSizeStyle,
  GeoShapeGeoStyle,
  useEditor,
  useValue,
} from 'tldraw'
import { Icon } from './Icons'

type Props = {
  controlling: boolean
  setControlling(value: boolean): void
  mode: 'blank' | 'live' | 'frozen' | 'image'
  label: string
  busy: boolean
  canResume: boolean
  fit: boolean
  cropped: boolean
  chooseSource(): void
  captureRegion(): void
  paste(): void
  blank(): void
  crop(): void
  resetCrop(): void
  setFit(value: boolean): void
  freeze(): void
  copy(): void
  save(): void
  snip(): void
  status(text: string): void
  displays: { id: number; label: string; current: boolean }[]
  moveDisplay(id: number): void
  hidden: boolean
  setHidden(value: boolean): void
}
const colors = [
  ['black', '#202124'],
  ['blue', '#4263eb'],
  ['green', '#168765'],
  ['red', '#e63b43'],
  ['orange', '#ef8c24'],
  ['violet', '#a24fcd'],
  ['grey', '#99a2ac'],
  ['yellow', '#e8b536'],
] as const
const tools = [
  ['select', 'select', 'Select'],
  ['draw', 'pen', 'Pen'],
  ['highlight', 'highlight', 'Highlighter'],
  ['eraser', 'eraser', 'Eraser'],
  ['arrow', 'arrow', 'Arrow'],
  ['text', 'text', 'Text'],
  ['geo', 'shape', 'Shapes'],
] as const

export function CanvasChrome(p: Props) {
  const editor = useEditor()
  const current = useValue(
    'canvas controls',
    () => ({
      tool: editor.getCurrentToolId(),
      undo: editor.getCanUndo(),
      count: editor.getCurrentPageShapeIds().size,
      color:
        editor.getSharedStyles().getAsKnownValue(DefaultColorStyle) ||
        editor.getStyleForNextShape(DefaultColorStyle),
      size:
        editor.getSharedStyles().getAsKnownValue(DefaultSizeStyle) ||
        editor.getStyleForNextShape(DefaultSizeStyle),
      fill:
        editor.getSharedStyles().getAsKnownValue(DefaultFillStyle) ||
        editor.getStyleForNextShape(DefaultFillStyle),
    }),
    [editor],
  )
  useEffect(() => {
    if (current.tool !== 'select') p.setControlling(false)
  }, [current.tool, p.setControlling])
  const [popover, setPopover] = useState<'source' | 'style' | 'shapes' | 'more' | 'save' | null>(
    null,
  )
  const [full, setFull] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const popoverButton = useRef<HTMLButtonElement | null>(null)
  useEffect(() => {
    window.desktop
      ?.windowState?.()
      .then((value) => setFull(value.fullscreen))
      .catch(() => {})
    return window.desktop?.onWindowState?.((value) => setFull(value.fullscreen))
  }, [])
  useEffect(() => {
    if (!popover) return
    const close = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setPopover(null)
    }
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPopover(null)
        popoverButton.current?.focus()
      }
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', key)
    }
  }, [popover])
  const toggle = (name: typeof popover, button: HTMLButtonElement) => {
    popoverButton.current = button
    setPopover((value) => (value === name ? null : name))
  }
  const run = (action: () => void) => {
    setPopover(null)
    action()
  }
  const undo = () => {
    const tool = editor.getCurrentToolId()
    editor.undo()
    editor.setCurrentTool(tool)
    p.status('Undone.')
  }
  const clear = () => {
    const tool = editor.getCurrentToolId()
    editor.markHistoryStoppingPoint('clear annotations')
    editor.run(() => editor.deleteShapes([...editor.getCurrentPageShapeIds()]), {
      ignoreShapeLock: true,
    })
    editor.markHistoryStoppingPoint('after clear')
    editor.setCurrentTool(tool)
    p.status('Annotations cleared. Undo restores them.')
  }
  const windowAction = (action: 'minimize' | 'fullscreen' | 'close') =>
    window.desktop?.windowAction?.(action).catch((e) => p.status(e.message))
  const modeText =
    p.mode === 'live'
      ? 'Live'
      : p.mode === 'frozen'
        ? 'Frozen'
        : p.mode === 'image'
          ? 'Snapshot'
          : 'Canvas'
  const color = colors.find((c) => c[0] === current.color)?.[1] || '#202124'
  const actionButton = (
    label: string,
    icon: string,
    action: () => void,
    disabled = false,
    extra = '',
  ) => (
    <button
      className={`tool-button ${extra}`}
      aria-label={label}
      title={label}
      onClick={action}
      disabled={disabled}
    >
      <Icon name={icon} />
    </button>
  )

  return (
    <div
      className={`canvas-chrome ${p.hidden ? 'is-collapsed' : ''}`}
      ref={root}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
    >
      <div
        className="compact-controls glass"
        aria-label="Quick canvas controls"
        aria-hidden={!p.hidden}
        inert={!p.hidden}
      >
        {actionButton('Show toolbar', 'down', () => p.setHidden(false))}
        <span className="divider" />
        {actionButton('Undo', 'undo', undo, !current.undo || p.busy)}
        {actionButton('Clear annotations', 'clear', clear, !current.count || p.busy)}
      </div>
      <div
        className="floating-toolbar glass"
        role="toolbar"
        aria-label="Canvas toolbar"
        aria-hidden={p.hidden}
        inert={p.hidden}
      >
        <span className="toolbar-grip" title="Drag window" />
        <button
          className="source-button"
          aria-label="Source options"
          aria-expanded={popover === 'source'}
          onClick={(e) => toggle('source', e.currentTarget)}
        >
          <Icon name="source" />
          <span className="source-label">{p.mode === 'blank' ? 'Source' : p.label}</span>
          <Icon name="down" size={13} />
        </button>
        <button
          className={`mode-button ${p.mode}`}
          onClick={p.freeze}
          disabled={p.busy || (p.mode !== 'live' && !p.canResume)}
          aria-label={p.mode === 'frozen' ? 'Resume' : 'Freeze'}
          title={
            p.mode === 'live'
              ? 'Freeze the picture'
              : p.mode === 'frozen'
                ? 'Resume live picture'
                : 'Start screen capture to freeze a frame'
          }
        >
          <span className="mode-dot" />
          <span>{modeText}</span>
          {p.mode === 'live' || p.mode === 'frozen' ? (
            <Icon name={p.mode === 'live' ? 'pause' : 'play'} size={14} />
          ) : null}
        </button>
        <button
          className="tool-button screen-control-button"
          aria-label="Interact with screen"
          title="Interact with screen. Select edits annotations."
          aria-pressed={p.controlling && p.mode === 'live'}
          disabled={p.mode !== 'live' || p.busy}
          onClick={() => {
            setPopover(null)
            editor.setCurrentTool('select')
            p.setControlling(!p.controlling)
          }}
        >
          <Icon name="source" />
        </button>
        <span className="divider main-divider" />
        <div className="drawing-tools" aria-label="Drawing tools">
          {tools.map(([id, icon, label]) => (
            <button
              key={id}
              className="tool-button"
              aria-label={label}
              title={label === 'Select' ? 'Select and move annotations' : label}
              aria-pressed={!p.controlling && current.tool === id}
              data-testid={`tools.${id}`}
              onClick={(e) => {
                p.setControlling(false)
                if (id === 'geo') {
                  toggle('shapes', e.currentTarget)
                } else {
                  setPopover(null)
                  editor.setCurrentTool(id)
                }
              }}
            >
              <Icon name={icon} />
            </button>
          ))}
          <button
            className="tool-button color-button"
            aria-label="Color and stroke"
            title="Color and stroke"
            aria-expanded={popover === 'style'}
            onClick={(e) => toggle('style', e.currentTarget)}
          >
            <span style={{ background: color }} />
          </button>
        </div>
        <span className="divider" />
        <div className="history-tools">
          {actionButton('Undo', 'undo', undo, !current.undo || p.busy)}
          <button
            className="clear-button"
            onClick={clear}
            disabled={!current.count || p.busy}
            title="Clear annotations. Undo restores them."
          >
            <Icon name="clear" />
            <span>Clear</span>
          </button>
        </div>
        <span className="toolbar-spacer" />
        {actionButton('Copy image', 'copy', p.copy, p.busy, 'copy-button')}
        <div className="save-group">
          <button className="save-button" onClick={p.save} disabled={p.busy}>
            <Icon name="save" size={18} />
            <span>Save</span>
          </button>
          <button
            className="save-more"
            aria-label="Save options"
            aria-expanded={popover === 'save'}
            onClick={(e) => toggle('save', e.currentTarget)}
            disabled={p.busy}
          >
            <Icon name="down" size={13} />
          </button>
        </div>
        {actionButton(
          full ? 'Exit full screen' : 'Full screen',
          full ? 'collapse' : 'expand',
          () => void windowAction('fullscreen'),
          false,
          'fullscreen-button',
        )}
        <button
          className="tool-button more-button"
          aria-label="More options"
          aria-expanded={popover === 'more'}
          title="More options"
          onClick={(e) => toggle('more', e.currentTarget)}
        >
          <Icon name="more" />
        </button>
        {actionButton('Hide toolbar', 'up', () => {
          setPopover(null)
          p.setHidden(true)
        })}
      </div>

      {popover && !p.hidden && (
        <section
          className={`toolbar-popover glass popover-${popover}`}
          aria-label={`${popover} options`}
        >
          {popover === 'source' && (
            <>
              <button onClick={() => run(p.chooseSource)}>
                <Icon name="source" />
                <span>Choose screen or window</span>
              </button>
              {window.desktop && (
                <button onClick={() => run(p.captureRegion)}>
                  <Icon name="crop" />
                  <span>Capture region</span>
                  <kbd>Ctrl Alt S</kbd>
                </button>
              )}
              {window.desktop && (
                <button onClick={() => run(p.paste)}>
                  <Icon name="paste" />
                  <span>Paste screenshot</span>
                </button>
              )}
              <button onClick={() => run(p.blank)}>
                <Icon name="blank" />
                <span>Whiteboard</span>
              </button>
              <hr />
              <div className="popover-row">
                <span>View</span>
                <div className="segmented">
                  <button aria-pressed={!p.fit} onClick={() => p.setFit(false)}>
                    Fill
                  </button>
                  <button aria-pressed={p.fit} onClick={() => p.setFit(true)}>
                    Fit
                  </button>
                </div>
              </div>
              <button onClick={() => run(p.crop)} disabled={p.mode === 'blank'}>
                <Icon name="crop" />
                <span>Crop view</span>
              </button>
              <button onClick={() => run(p.resetCrop)} disabled={!p.cropped}>
                <Icon name="expand" />
                <span>Reset crop</span>
              </button>
              {p.displays.length > 1 && (
                <>
                  <hr />
                  <label className="display-row">
                    Display
                    <select
                      aria-label="Canvas display"
                      value={p.displays.find((d) => d.current)?.id || ''}
                      onChange={(e) => p.moveDisplay(Number(e.target.value))}
                    >
                      {p.displays.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}
            </>
          )}
          {popover === 'style' && (
            <>
              <div className="swatches">
                {colors.map(([name, hex]) => (
                  <button
                    key={name}
                    aria-label={`${name} ink`}
                    aria-pressed={current.color === name}
                    style={{ '--swatch': hex } as CSSProperties}
                    onClick={() => {
                      editor.setStyleForNextShapes(DefaultColorStyle, name)
                      editor.setStyleForSelectedShapes(DefaultColorStyle, name)
                    }}
                  >
                    <span />
                  </button>
                ))}
              </div>
              <div className="popover-row">
                <span>Stroke</span>
                <div className="segmented">
                  {(['s', 'm', 'l', 'xl'] as const).map((s) => (
                    <button
                      key={s}
                      aria-label={`${s.toUpperCase()} stroke`}
                      aria-pressed={current.size === s}
                      onClick={() => {
                        editor.setStyleForNextShapes(DefaultSizeStyle, s)
                        editor.setStyleForSelectedShapes(DefaultSizeStyle, s)
                      }}
                    >
                      {s.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              <div className="popover-row">
                <span>Fill</span>
                <div className="segmented">
                  {(['none', 'semi', 'solid'] as const).map((fill) => (
                    <button
                      key={fill}
                      aria-pressed={current.fill === fill}
                      onClick={() => {
                        editor.setStyleForNextShapes(DefaultFillStyle, fill)
                        editor.setStyleForSelectedShapes(DefaultFillStyle, fill)
                      }}
                    >
                      {fill === 'none' ? 'None' : fill === 'semi' ? 'Light' : 'Solid'}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
          {popover === 'shapes' && (
            <div className="shape-choices">
              {(
                [
                  'rectangle',
                  'ellipse',
                  'triangle',
                  'diamond',
                  'star',
                  'cloud',
                  'hexagon',
                  'arrow-right',
                  'check-box',
                ] as const
              ).map((shape) => (
                <button
                  key={shape}
                  onClick={() =>
                    run(() => {
                      editor.setStyleForNextShapes(GeoShapeGeoStyle, shape)
                      editor.setCurrentTool('geo')
                    })
                  }
                >
                  {shape.replace('-', ' ')}
                </button>
              ))}
            </div>
          )}
          {popover === 'save' && (
            <>
              <button onClick={() => run(p.save)}>
                <Icon name="save" />
                <span>Save image</span>
                <kbd>Ctrl Shift S</kbd>
              </button>
              <button onClick={() => run(p.snip)}>
                <Icon name="crop" />
                <span>Save snip</span>
              </button>
              <button onClick={() => run(p.copy)}>
                <Icon name="copy" />
                <span>Copy image</span>
                <kbd>Ctrl Shift C</kbd>
              </button>
            </>
          )}
          {popover === 'more' && (
            <>
              {(['note', 'frame', 'line', 'laser'] as const).map((tool) => (
                <button key={tool} onClick={() => run(() => editor.setCurrentTool(tool))}>
                  <Icon name={tool} />
                  <span>{tool[0].toUpperCase() + tool.slice(1)}</span>
                </button>
              ))}
              <button onClick={() => run(() => editor.redo())}>
                <Icon name="redo" />
                <span>Redo</span>
              </button>
              <hr />
              <button onClick={() => run(() => windowAction('fullscreen'))}>
                <Icon name={full ? 'collapse' : 'expand'} />
                <span>{full ? 'Exit full screen' : 'Full screen'}</span>
                <kbd>F11</kbd>
              </button>
              {window.desktop && (
                <>
                  <button onClick={() => run(() => windowAction('minimize'))}>
                    <Icon name="minus" />
                    <span>Minimize</span>
                  </button>
                  <button onClick={() => run(() => windowAction('close'))}>
                    <Icon name="close" />
                    <span>Close Live Canvas</span>
                  </button>
                </>
              )}
            </>
          )}
        </section>
      )}
      {p.mode === 'blank' && !current.count && (
        <div className="empty-canvas">
          <p>Draw here, or bring a screen into view.</p>
          <button onClick={p.chooseSource}>
            <Icon name="source" size={18} />
            Choose screen
          </button>
        </div>
      )}
    </div>
  )
}
