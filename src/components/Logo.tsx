import { cx } from './ui'

/** Line-drawn bloom used in the wordmark and empty states. */
export function BloomMark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className={className} aria-hidden>
      <path d="M24 44V24" stroke="var(--green)" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M24 36c-5 0-9-2.6-10-7 5 0 9 2.6 10 7z" fill="var(--green)" opacity="0.85" />
      <path d="M24 32c4.5 0 8-2.2 9-6-4.5 0-8 2.2-9 6z" fill="var(--green)" opacity="0.6" />
      <path
        d="M24 25c-6.5 0-10.5-5.5-10.5-13 3.6.9 6.4 2.9 8.2 5.6.2-4.6 1.2-8.3 2.3-10.6 1.1 2.3 2.1 6 2.3 10.6 1.8-2.7 4.6-4.7 8.2-5.6 0 7.5-4 13-10.5 13z"
        fill="var(--pink)"
      />
      <path d="M24 25c-2.4-2.6-3.4-6-3-9.6M24 25c2.4-2.6 3.4-6 3-9.6" stroke="var(--pink-ink)" strokeWidth="1" fill="none" opacity="0.5" />
    </svg>
  )
}

export function Logo({ compact, className }: { compact?: boolean; className?: string }) {
  return (
    <div className={cx('flex items-center gap-2.5', className)}>
      <BloomMark size={compact ? 30 : 38} />
      <div className="leading-none">
        <div className={cx('whitespace-nowrap font-display font-semibold tracking-[0.08em] text-ink', compact ? 'text-lg' : 'text-[20px]')}>
          WHIMSY <span className="text-pink-ink">&amp;</span> BLOOM
        </div>
        {!compact && <div className="mt-1 whitespace-nowrap text-[8px] font-semibold tracking-[0.16em] text-muted">HANDMADE FLOWERS, MADE WITH LOVE.</div>}
      </div>
    </div>
  )
}
