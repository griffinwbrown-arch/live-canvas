type CaptureRect = { x: number; y: number; w: number; h: number }
type Source = { id: string; name: string; displayId: string; thumbnail: string }
interface Window {
  desktop?: {
    sources(): Promise<Source[]>
    selectSource(id: string): Promise<void>
    setControl(id: string | null): Promise<void>
    pointerInput(event: {
      kind: string
      x?: number
      y?: number
      button?: number
      buttons?: number
      dx?: number
      dy?: number
      modifiers?: number
      keyCode?: number
      text?: string
    }): Promise<void>
    displays(): Promise<{ id: number; label: string; current: boolean }[]>
    moveTo(id: number): Promise<void>
    windowState(): Promise<{ fullscreen: boolean }>
    windowAction(action: 'minimize' | 'fullscreen' | 'close'): Promise<void>
    onWindowState(fn: (value: { fullscreen: boolean }) => void): () => void
    cropScreen(): Promise<void>
    copy(data: string): Promise<boolean>
    save(data: string): Promise<string | null>
    clipboardImage(): Promise<string | null>
    onCapture(fn: (data: { sourceId: string; crop: CaptureRect }) => void): () => void
    onCommand(fn: (command: string | { error: string }) => void): () => void
  }
}
