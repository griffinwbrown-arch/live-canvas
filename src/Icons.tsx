import type { CSSProperties } from 'react'
const paths: Record<string, string> = {
  source: 'M3 4h18v13H3z M8 21h8 M12 17v4',
  crop: 'M6 2v16h16 M2 6h16v16',
  pen: 'm15 4 5 5 M4 20l5-1L21 7a2 2 0 0 0-5-5L4 14z',
  select: 'M5 3v17l5-5 4 7 3-2-4-7 7-1z',
  highlight: 'm14 3 7 7-10 10-7-7z M3 20h7 M8 9l7 7',
  eraser: 'm15 3 7 7-11 11H6l-5-5z M7 10l9 9 M11 21h11',
  arrow: 'M4 20 20 4 M8 4h12v12',
  text: 'M4 5V3h16v2 M12 3v18 M8 21h8',
  shape: 'M4 4h16v16H4z',
  undo: 'M9 5 3 10l6 5 M3 10h11a6 6 0 0 1 0 12',
  redo: 'm15 5 6 5-6 5 M21 10H10a6 6 0 0 0 0 12',
  clear: 'M4 7h16 M9 7V3h6v4 M6 7l1 14h10l1-14 M10 11v6 M14 11v6',
  pause: 'M8 4v16 M16 4v16',
  play: 'm8 4 12 8-12 8z',
  copy: 'M8 8h13v13H8z M16 8V3H3v13h5',
  save: 'M12 3v12 m-5-5 5 5 5-5 M4 16v5h16v-5',
  up: 'm6 14 6-6 6 6',
  down: 'm6 10 6 6 6-6',
  more: 'M4 12h.01 M12 12h.01 M20 12h.01',
  expand: 'M3 9V3h6 M15 3h6v6 M21 15v6h-6 M9 21H3v-6',
  collapse: 'M9 3v6H3 M15 3v6h6 M21 15h-6v6 M9 21v-6H3',
  close: 'm6 6 12 12 M6 18 18 6',
  minus: 'M5 12h14',
  paste: 'M8 5H4v16h16V5h-4 M8 3h8v4H8z',
  blank: 'M5 3h14v18H5z',
  note: 'M4 4h16v10l-6 6H4z M14 20v-6h6',
  frame: 'M7 2v20 M17 2v20 M2 7h20 M2 17h20',
  line: 'M4 20 20 4',
  laser: 'M12 2v4 M12 18v4 M2 12h4 M18 12h4 M9 12a3 3 0 1 0 6 0 3 3 0 1 0-6 0',
  fit: 'M3 3h18v18H3z M6 8h12v8H6z',
}
export function Icon({
  name,
  size = 20,
  style,
}: {
  name: string
  size?: number
  style?: CSSProperties
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
    >
      <path d={paths[name] || paths.more} />
    </svg>
  )
}
