import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { cx, Segmented } from '../ui'

export interface Datum {
  key: string
  label: string
  value: number
  /** Extra line shown in the tooltip and table. */
  detail?: string
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(el.clientWidth)
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}

/** Clean axis ticks: 0, 2, 4… / 0, 5, 10… / 0, 1,000, 2,000… */
function niceTicks(max: number, target = 4): number[] {
  if (max <= 0) return [0, 1]
  const raw = max / target
  const pow = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? 10 * pow
  const ticks: number[] = []
  for (let v = 0; v < max + step; v += step) ticks.push(v)
  return ticks
}

interface TooltipState {
  x: number
  y: number
  datum: Datum
}

function Tooltip({ tip, format }: { tip: TooltipState | null; format: (n: number) => string }) {
  if (!tip) return null
  return (
    <div
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg"
      style={{ left: tip.x, top: tip.y - 8 }}
      role="status"
    >
      <div className="tabular text-sm font-semibold text-ink">{format(tip.datum.value)}</div>
      <div className="text-ink-2">{tip.datum.label}</div>
      {tip.datum.detail && <div className="text-muted">{tip.datum.detail}</div>}
    </div>
  )
}

/** Ranked horizontal bars. Single series, so the card title names it and there is no legend. */
export function HBarChart({ data, format, ariaLabel }: { data: Datum[]; format: (n: number) => string; ariaLabel: string }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [tip, setTip] = useState<TooltipState | null>(null)
  const row = 34
  const bar = 18
  const labelW = Math.min(150, Math.max(96, width * 0.36))
  const valueW = 44
  const plotW = Math.max(0, width - labelW - valueW)
  const max = Math.max(1, ...data.map((d) => d.value))
  const height = data.length * row

  return (
    <div ref={ref} className="relative" onPointerLeave={() => setTip(null)}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={ariaLabel} className="block overflow-visible">
          <line x1={labelW} x2={labelW} y1={0} y2={height} stroke="var(--axis)" strokeWidth={1} />
          {data.map((d, i) => {
            const y = i * row + (row - bar) / 2
            const w = (d.value / max) * plotW
            const r = Math.min(4, w / 2)
            const show = () => setTip({ x: labelW + Math.max(w, 8) / 2, y, datum: d })
            return (
              <g
                key={d.key}
                tabIndex={0}
                onPointerEnter={show}
                onFocus={show}
                onBlur={() => setTip(null)}
                className="cursor-default outline-none [&:focus-visible_rect.hit]:stroke-[var(--pink-ink)]"
                aria-label={`${d.label}: ${format(d.value)}`}
              >
                <rect className="hit" x={0} y={i * row} width={width} height={row} fill="transparent" strokeWidth={1} rx={6} />
                <text x={labelW - 10} y={i * row + row / 2} dominantBaseline="central" textAnchor="end" fontSize={12} fill="var(--ink-2)">
                  {truncate(d.label, Math.floor(labelW / 7))}
                </text>
                {w > 0 && (
                  <path
                    d={`M${labelW} ${y}H${labelW + w - r}A${r} ${r} 0 0 1 ${labelW + w} ${y + r}V${y + bar - r}A${r} ${r} 0 0 1 ${labelW + w - r} ${y + bar}H${labelW}Z`}
                    fill="var(--chart-1)"
                    opacity={tip && tip.datum.key !== d.key ? 0.55 : 1}
                  />
                )}
                <text x={labelW + w + 6} y={i * row + row / 2} dominantBaseline="central" fontSize={12} fontWeight={600} fill="var(--ink)" className="tabular">
                  {format(d.value)}
                </text>
              </g>
            )
          })}
        </svg>
      )}
      <Tooltip tip={tip} format={format} />
    </div>
  )
}

/** Vertical columns over time with a recessive grid; the latest value is labelled on its cap. */
export function ColumnChart({ data, format, ariaLabel, height = 200 }: { data: Datum[]; format: (n: number) => string; ariaLabel: string; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [tip, setTip] = useState<TooltipState | null>(null)
  const ticks = niceTicks(Math.max(...data.map((d) => d.value), 1))
  const top = ticks[ticks.length - 1]
  const padL = 30
  const padB = 22
  const padT = 18
  const plotW = Math.max(0, width - padL)
  const plotH = height - padB - padT
  const band = data.length ? plotW / data.length : 0
  const colW = Math.min(24, band * 0.62)
  const y = (v: number) => padT + plotH - (v / top) * plotH
  const labelEvery = band < 34 ? Math.ceil(34 / band) : 1
  const last = data.length - 1

  return (
    <div ref={ref} className="relative" onPointerLeave={() => setTip(null)}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={ariaLabel} className="block overflow-visible">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={width} y1={y(t)} y2={y(t)} stroke={t === 0 ? 'var(--axis)' : 'var(--grid)'} strokeWidth={1} />
              <text x={padL - 8} y={y(t)} textAnchor="end" dominantBaseline="central" fontSize={11} fill="var(--muted)" className="tabular">
                {format(t)}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const cx0 = padL + band * i + band / 2
            const h = (d.value / top) * plotH
            const r = Math.min(4, colW / 2, h)
            const x0 = cx0 - colW / 2
            const y0 = padT + plotH
            const show = () => setTip({ x: cx0, y: y(d.value), datum: d })
            return (
              <g key={d.key} tabIndex={0} onPointerEnter={show} onFocus={show} onBlur={() => setTip(null)} className="outline-none" aria-label={`${d.label}: ${format(d.value)}`}>
                <rect x={padL + band * i} y={padT} width={band} height={plotH} fill={tip?.datum.key === d.key ? 'var(--surface-2)' : 'transparent'} />
                {h > 0 && (
                  <path
                    d={`M${x0} ${y0}V${y0 - h + r}A${r} ${r} 0 0 1 ${x0 + r} ${y0 - h}H${x0 + colW - r}A${r} ${r} 0 0 1 ${x0 + colW} ${y0 - h + r}V${y0}Z`}
                    fill="var(--chart-1)"
                    opacity={i === last || tip?.datum.key === d.key ? 1 : 0.72}
                  />
                )}
                {i === last && (
                  <text x={cx0} y={y(d.value) - 6} textAnchor="middle" fontSize={12} fontWeight={600} fill="var(--ink)" className="tabular">
                    {format(d.value)}
                  </text>
                )}
                {(last - i) % labelEvery === 0 && (
                  <text x={cx0} y={height - 6} textAnchor="middle" fontSize={11} fill="var(--muted)">
                    {d.label}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      )}
      <Tooltip tip={tip} format={format} />
    </div>
  )
}

function truncate(s: string, max: number) {
  return s.length > max ? `${s.slice(0, Math.max(1, max - 1))}…` : s
}

/** Card wrapper that offers the same numbers as a table, so nothing depends on hovering. */
export function ChartCard({
  title,
  subtitle,
  data,
  format,
  valueHeader,
  children,
  className,
}: {
  title: string
  subtitle?: ReactNode
  data: Datum[]
  format: (n: number) => string
  valueHeader: string
  children: ReactNode
  className?: string
}) {
  const [view, setView] = useState<'chart' | 'table'>('chart')
  return (
    <section className={cx('rounded-2xl border border-line bg-surface shadow-card min-w-0', className)}>
      <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4">
        <div>
          <h2 className="eyebrow !text-ink-2">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        </div>
        <Segmented
          label={`${title} view`}
          value={view}
          onChange={setView}
          options={[
            { value: 'chart', label: 'Chart' },
            { value: 'table', label: 'Table' },
          ]}
        />
      </header>
      <div className="p-5">
        {view === 'chart' ? (
          children
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="pb-2 font-medium" />
                <th className="pb-2 text-right font-medium">{valueHeader}</th>
                {data.some((d) => d.detail) && <th className="pb-2 text-right font-medium">Detail</th>}
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.key} className="border-t border-line">
                  <td className="py-1.5">{d.label}</td>
                  <td className="tabular py-1.5 text-right font-medium">{format(d.value)}</td>
                  {data.some((x) => x.detail) && <td className="tabular py-1.5 text-right text-muted">{d.detail}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}
