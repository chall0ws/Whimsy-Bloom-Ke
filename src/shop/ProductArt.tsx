import { cx } from '../components/ui'

/*
 * Illustrations of each bouquet in the poster's soft, hand-drawn style.
 * They stand in until there are product photos; swap in a photo by giving the product an image.
 */

const C = {
  leaf: '#9aa86a',
  leafLine: '#5c6b3e',
  paper: '#f6ebe0',
  paperLine: '#d9c4b2',
  ribbon: '#e8a3b1',
  pink: '#f4bcc6',
  pinkLine: '#c27585',
  red: '#e07a88',
  redLine: '#a9475b',
  yellow: '#f5cf6b',
  yellowLine: '#c9962c',
  brown: '#7a5532',
  cream: '#fffaf5',
}

const BACKGROUNDS: Record<string, string> = {
  'p-pink-lily': 'linear-gradient(160deg, #fde8ec, #f7d9df)',
  'p-giant-rose': 'linear-gradient(160deg, #fde6e6, #f5d3d6)',
  'p-tulip': 'linear-gradient(160deg, #fdeef0, #f3dde4)',
  'p-peony': 'linear-gradient(160deg, #fbece6, #f4dcd5)',
  'p-sunflower': 'linear-gradient(160deg, #fdf3dc, #f5e6c6)',
  'p-rosebud-box': 'linear-gradient(160deg, #f8ece6, #eedfd6)',
}

function Leaf({ x, y, r, s = 1 }: { x: number; y: number; r: number; s?: number }) {
  return (
    <path
      d="M0 0C-6 -10 -6 -24 0 -34C6 -24 6 -10 0 0Z"
      transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}
      fill={C.leaf}
      stroke={C.leafLine}
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
  )
}

function Stem({ d }: { d: string }) {
  return <path d={d} fill="none" stroke={C.leafLine} strokeWidth="2" strokeLinecap="round" />
}

/** Kraft-paper wrap with a pink ribbon, like the bouquets in the poster. */
function Wrap() {
  return (
    <g strokeLinejoin="round">
      <path d="M58 112L100 186L142 112L122 120L100 112L78 120Z" fill={C.paper} stroke={C.paperLine} strokeWidth="1.5" />
      <path d="M78 120L100 186M122 120L100 186" stroke={C.paperLine} strokeWidth="1" fill="none" />
      <path d="M86 150Q100 158 114 150" stroke={C.ribbon} strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M100 154L88 172M100 154L112 172" stroke={C.ribbon} strokeWidth="3" strokeLinecap="round" />
    </g>
  )
}

function Lily({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {[0, 60, 120, 180, 240, 300].map((r) => (
        <path key={r} d="M0 0C-7 -10 -6 -26 0 -34C6 -26 7 -10 0 0Z" transform={`rotate(${r})`} fill={C.pink} stroke={C.pinkLine} strokeWidth="1.3" />
      ))}
      {[0, 60, 120, 180, 240, 300].map((r) => (
        <path key={`v${r}`} d="M0 -4L0 -24" transform={`rotate(${r})`} stroke={C.pinkLine} strokeWidth="0.8" opacity="0.6" />
      ))}
      {[-20, 0, 20].map((r) => (
        <g key={`s${r}`} transform={`rotate(${r})`}>
          <path d="M0 0L0 -16" stroke={C.leafLine} strokeWidth="1" />
          <circle cy="-17" r="2" fill={C.brown} />
        </g>
      ))}
    </g>
  )
}

function Rose({ x, y, s = 1, fill = C.red, line = C.redLine }: { x: number; y: number; s?: number; fill?: string; line?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill={fill} stroke={line} strokeWidth="1.4" strokeLinejoin="round">
      <path d="M-26 4C-30 -18 -12 -32 0 -30C14 -32 32 -18 26 4C20 20 -20 20 -26 4Z" />
      <path d="M-16 0C-18 -14 -6 -22 2 -20C12 -20 18 -10 14 0C10 10 -12 10 -16 0Z" />
      <path d="M-6 -4C-6 -12 4 -14 6 -8C8 -2 2 2 -2 0" fill="none" />
    </g>
  )
}

function Tulip({ x, y, r = 0, s = 1 }: { x: number; y: number; r?: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`} fill={C.pink} stroke={C.pinkLine} strokeWidth="1.3" strokeLinejoin="round">
      <path d="M-12 -2C-14 -16 -10 -24 -6 -26L0 -16L6 -26C10 -24 14 -16 12 -2C8 6 -8 6 -12 -2Z" />
      <path d="M-4 -2C-6 -12 -2 -22 0 -24C2 -22 6 -12 4 -2" fill="#f8cfd6" />
    </g>
  )
}

function Peony({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} stroke={C.pinkLine} strokeWidth="1.2">
      {[0, 45, 90, 135, 180, 225, 270, 315].map((r) => (
        <ellipse key={r} cx="0" cy="-17" rx="11" ry="12" transform={`rotate(${r})`} fill="#f7c9cf" />
      ))}
      {[22, 82, 142, 202, 262, 322].map((r) => (
        <ellipse key={r} cx="0" cy="-9" rx="8" ry="9" transform={`rotate(${r})`} fill={C.pink} />
      ))}
      <circle r="7" fill="#f8d7dc" />
    </g>
  )
}

function Sunflower({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {Array.from({ length: 16 }, (_, i) => i * 22.5).map((r) => (
        <path key={r} d="M0 -10C-5 -18 -4 -28 0 -34C4 -28 5 -18 0 -10Z" transform={`rotate(${r})`} fill={C.yellow} stroke={C.yellowLine} strokeWidth="1.1" />
      ))}
      <circle r="12" fill={C.brown} />
      {[0, 60, 120, 180, 240, 300].map((r) => (
        <circle key={r} cy="-6" r="1.4" transform={`rotate(${r})`} fill="#a77a4f" />
      ))}
    </g>
  )
}

function Baby({ points }: { points: [number, number][] }) {
  return (
    <g>
      {points.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="3.2" fill={C.cream} stroke={C.paperLine} strokeWidth="1" />
      ))}
    </g>
  )
}

function Bouquet({ productId }: { productId: string }) {
  switch (productId) {
    case 'p-pink-lily':
      return (
        <>
          <Stem d="M90 112L80 70M100 112L102 56M110 112L124 74" />
          <Leaf x={86} y={110} r={-35} />
          <Leaf x={114} y={110} r={35} />
          <Baby points={[[66, 78], [134, 62], [140, 92], [60, 104], [116, 44]]} />
          <Lily x={78} y={70} s={0.85} />
          <Lily x={124} y={74} s={0.8} />
          <Lily x={102} y={52} s={1} />
          <Wrap />
        </>
      )
    case 'p-giant-rose':
      return (
        <>
          <Stem d="M100 186L100 92" />
          <Leaf x={100} y={150} r={-50} s={1.2} />
          <Leaf x={100} y={128} r={48} s={1.1} />
          <Rose x={100} y={72} s={1.9} />
        </>
      )
    case 'p-tulip':
      return (
        <>
          <Stem d="M92 112L76 70M100 112L100 56M108 112L124 70M96 112L88 50M104 112L114 52" />
          <Leaf x={90} y={112} r={-28} s={1.2} />
          <Leaf x={110} y={112} r={28} s={1.2} />
          <Tulip x={76} y={72} r={-14} />
          <Tulip x={124} y={72} r={14} />
          <Tulip x={100} y={58} />
          <Tulip x={88} y={52} r={-6} s={0.9} />
          <Tulip x={114} y={54} r={8} s={0.9} />
          <Wrap />
        </>
      )
    case 'p-peony':
      return (
        <>
          <Stem d="M92 112L80 76M100 112L100 62M108 112L122 78" />
          <Leaf x={88} y={112} r={-40} />
          <Leaf x={112} y={112} r={40} />
          <Baby points={[[62, 80], [138, 70], [70, 56], [132, 98], [58, 102]]} />
          <Peony x={78} y={80} s={0.8} />
          <Peony x={124} y={80} s={0.8} />
          <Peony x={100} y={60} s={1} />
          <Wrap />
        </>
      )
    case 'p-sunflower':
      return (
        <>
          <Stem d="M92 112L78 74M100 112L102 58M108 112L124 76" />
          <Leaf x={88} y={112} r={-38} s={1.1} />
          <Leaf x={112} y={112} r={38} s={1.1} />
          <Sunflower x={78} y={76} s={0.75} />
          <Sunflower x={124} y={78} s={0.72} />
          <Sunflower x={101} y={58} s={0.95} />
          <Wrap />
        </>
      )
    default:
      return (
        <>
          <g strokeLinejoin="round">
            <path d="M48 112L152 112L146 176L54 176Z" fill={C.paper} stroke={C.paperLine} strokeWidth="1.6" />
            <path d="M48 112L152 112" stroke={C.paperLine} strokeWidth="1.6" />
            <path d="M100 112L100 176" stroke={C.ribbon} strokeWidth="5" />
            <path d="M51 140L149 140" stroke={C.ribbon} strokeWidth="5" />
          </g>
          {[
            [66, 100],
            [86, 92],
            [106, 98],
            [126, 92],
            [76, 80],
            [98, 76],
            [118, 78],
            [134, 104],
            [60, 86],
          ].map(([x, y], i) => (
            <Rose key={i} x={x} y={y} s={0.42} fill={i % 3 === 0 ? C.pink : C.red} line={i % 3 === 0 ? C.pinkLine : C.redLine} />
          ))}
        </>
      )
  }
}

export function ProductArt({ productId, className, label }: { productId: string; className?: string; label: string }) {
  return (
    <div className={cx('relative overflow-hidden', className)} style={{ background: BACKGROUNDS[productId] ?? BACKGROUNDS['p-peony'] }} role="img" aria-label={label}>
      <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full" aria-hidden>
        <path d="M24 30L28 30M26 28L26 32" stroke="#c9b2a3" strokeWidth="1" />
        <path d="M170 40L176 40M173 37L173 43" stroke="#e8a3b1" strokeWidth="1.2" />
        <path d="M160 160L164 160M162 158L162 162" stroke="#c9b2a3" strokeWidth="1" />
        <Bouquet productId={productId} />
      </svg>
    </div>
  )
}
