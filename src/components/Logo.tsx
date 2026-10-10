import { Heart } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { cx } from './ui'

/** A four-point sparkle, like the little stars around the poster's flower. */
export function sparklePath(x: number, y: number, s: number) {
  return `M${x} ${y - s}Q${x} ${y} ${x + s} ${y}Q${x} ${y} ${x} ${y + s}Q${x} ${y} ${x - s} ${y}Q${x} ${y} ${x} ${y - s}Z`
}

/** Line-art flower with sparkles, after the poster's logo. */
export function BloomMark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden>
      <g fill="var(--pink)" fillOpacity="0.35" stroke="var(--green)" strokeWidth="1.6" strokeLinejoin="round">
        {[0, 72, 144, 216, 288].map((r) => (
          <ellipse key={r} cx="32" cy="15.5" rx="5.6" ry="8.5" transform={`rotate(${r} 32 24)`} />
        ))}
      </g>
      <circle cx="32" cy="24" r="3.4" fill="var(--surface)" stroke="var(--green)" strokeWidth="1.6" />
      <path d="M32 33.5C32 42 31.2 50 30 60" fill="none" stroke="var(--green)" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M31.4 46C25 45 20.5 41.5 19 36.5C25 37 29.5 40.5 31.4 46Z" fill="none" stroke="var(--green)" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M30.8 52.5C36.5 51.5 41 48 42.5 43C37 43.6 32.6 47 30.8 52.5Z" fill="none" stroke="var(--green)" strokeWidth="1.5" strokeLinejoin="round" />
      <path d={sparklePath(11, 15, 4)} fill="var(--green)" fillOpacity="0.75" />
      <path d={sparklePath(53, 9, 3)} fill="var(--pink-ink)" fillOpacity="0.7" />
      <path d={sparklePath(54, 37, 2.6)} fill="var(--green)" fillOpacity="0.6" />
    </svg>
  )
}

export function Logo({ compact, className }: { compact?: boolean; className?: string }) {
  return (
    <div className={cx('flex items-center gap-1.5', className)}>
      <BloomMark size={compact ? 36 : 40} className="shrink-0" />
      <div className="leading-none">
        <div className={cx('whitespace-nowrap font-display font-semibold tracking-[0.05em] text-green-ink', compact ? 'text-[19px]' : 'text-[20px]')}>
          WHIMSY &amp; BLOOM
        </div>
        {!compact && (
          <div className="mt-1 flex items-center gap-1 whitespace-nowrap text-[7.5px] font-semibold tracking-[0.09em] text-ink-2">
            HANDMADE FLOWERS, MADE WITH LOVE <Heart size={8} className="fill-pink text-pink-ink" aria-hidden />
          </div>
        )}
      </div>
    </div>
  )
}

/** Small sparkles scattered around a heading or card. */
export function Sparkles({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 60 40" className={cx('pointer-events-none', className)} style={style} aria-hidden>
      <path d={sparklePath(10, 26, 6)} fill="none" stroke="var(--taupe)" strokeWidth="1.1" />
      <path d={sparklePath(30, 10, 4)} fill="var(--pink)" />
      <path d={sparklePath(50, 30, 3.5)} fill="none" stroke="var(--taupe)" strokeWidth="1.1" />
    </svg>
  )
}

/** The poster's divider: a fine rose line with a heart in the middle. */
export function HeartDivider({ className }: { className?: string }) {
  return (
    <div className={cx('flex items-center gap-2', className)} aria-hidden>
      <span className="h-px flex-1 bg-gradient-to-r from-transparent to-pink" />
      <Heart size={12} className="text-pink-ink" strokeWidth={1.6} />
      <span className="h-px flex-1 bg-gradient-to-l from-transparent to-pink" />
    </div>
  )
}

/** A word or two in the brand script, e.g. "We are", "Welcome back". */
export function Script({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx('font-script text-pink-ink', className)}>{children}</span>
}
