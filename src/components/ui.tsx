import { CircleCheck, Globe, TriangleAlert, X } from 'lucide-react'
import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { STATUS_LABEL } from '../domain/orders'
import type { Channel, OrderStatus } from '../domain/types'
import { useStore } from '../state/store'

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

export function Card({
  title,
  subtitle,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section className={cx('rounded-2xl border border-line bg-surface shadow-card min-w-0', className)}>
      {(title || action) && (
        <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4">
          <div className="min-w-0">
            {title && <h2 className="eyebrow !text-ink-2">{title}</h2>}
            {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={cx('p-5', bodyClassName)}>{children}</div>
    </section>
  )
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'pink'
  size?: 'sm' | 'md'
}

export function Button({ variant = 'secondary', size = 'md', className, ...props }: ButtonProps) {
  return (
    <button
      type="button"
      {...props}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-full font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45 whitespace-nowrap',
        size === 'sm' ? 'h-8 px-3 text-xs' : 'h-10 px-4 text-sm',
        variant === 'primary' && 'bg-green text-on-green hover:opacity-90',
        variant === 'pink' && 'bg-pink text-[#3b1a24] hover:opacity-90',
        variant === 'secondary' && 'border border-line-strong bg-surface text-ink hover:bg-surface-2',
        variant === 'ghost' && 'text-ink-2 hover:bg-surface-2',
        variant === 'danger' && 'border border-line-strong bg-surface text-red-ink hover:bg-red-wash',
        className,
      )}
    />
  )
}

const STATUS_STYLE: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'bg-taupe-wash text-taupe-ink',
  PENDING: 'bg-amber-wash text-amber-ink',
  PROCESSING: 'bg-pink-wash text-pink-ink',
  SHIPPED: 'bg-green-wash text-green-ink',
  CANCELLED: 'bg-gray-wash text-gray-ink',
  REFUNDED: 'bg-red-wash text-red-ink',
}

export function StatusChip({ status, className }: { status: OrderStatus; className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap',
        STATUS_STYLE[status],
        className,
      )}
    >
      {status === 'SHIPPED' && <CircleCheck size={12} aria-hidden />}
      {STATUS_LABEL[status]}
    </span>
  )
}

export function InstagramIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function MessengerIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 3C7 3 3 6.7 3 11.3c0 2.6 1.3 4.9 3.3 6.4V21l3-1.7c.9.3 1.8.4 2.7.4 5 0 9-3.7 9-8.4S17 3 12 3z" />
      <path d="m7.5 13.5 3-3 2.5 2 3.5-3" strokeLinejoin="round" />
    </svg>
  )
}

export const CHANNEL_LABEL: Record<Channel, string> = {
  INSTAGRAM: 'Instagram',
  FACEBOOK: 'Messenger',
  WEB_FORM: 'Web form',
}

export function ChannelIcon({ channel, size = 14 }: { channel: Channel; size?: number }) {
  if (channel === 'INSTAGRAM') return <InstagramIcon size={size} />
  if (channel === 'FACEBOOK') return <MessengerIcon size={size} />
  return <Globe size={size} aria-hidden />
}

export function ChannelTag({ channel }: { channel: Channel }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-ink-2">
      <ChannelIcon channel={channel} size={12} />
      {CHANNEL_LABEL[channel]}
    </span>
  )
}

const openModals: symbol[] = []

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  variant = 'dialog',
  wide,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  subtitle?: ReactNode
  children: ReactNode
  footer?: ReactNode
  variant?: 'dialog' | 'drawer'
  wide?: boolean
}) {
  const panel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const token = Symbol()
    openModals.push(token)
    const previous = document.activeElement as HTMLElement | null
    panel.current?.focus()
    // Escape closes only the topmost dialog when they are stacked.
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && openModals.at(-1) === token && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      openModals.splice(openModals.indexOf(token), 1)
      if (openModals.length === 0) document.body.style.overflow = ''
      previous?.focus?.()
    }
  }, [open, onClose])
  if (!open) return null
  const drawer = variant === 'drawer'
  return (
    <div className={cx('fixed inset-0 z-50 flex', drawer ? 'justify-end' : 'items-end sm:items-center justify-center sm:p-4')}>
      <div className="absolute inset-0 bg-[#1e2a23]/40 backdrop-blur-[1px]" onClick={onClose} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={cx(
          'relative flex max-h-full flex-col bg-surface shadow-2xl outline-none',
          drawer
            ? 'h-full w-full max-w-xl border-l border-line'
            : cx('w-full rounded-t-2xl sm:rounded-2xl border border-line max-h-[92vh]', wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'),
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 className="font-display text-2xl font-semibold leading-tight">{title}</h2>
            {subtitle && <div className="mt-0.5 text-sm text-muted">{subtitle}</div>}
          </div>
          <button type="button" onClick={onClose} className="-mr-2 rounded-full p-2 text-muted hover:bg-surface-2" aria-label="Close">
            <X size={18} />
          </button>
        </header>
        <div className="scroll-thin flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">{footer}</footer>}
      </div>
    </div>
  )
}

export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1 block text-xs font-semibold text-ink-2">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  )
}

export const inputClass =
  'w-full rounded-xl border border-line-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-green focus:outline-none'

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: ReactNode; count?: number }[]
  label: string
}) {
  return (
    <div role="tablist" aria-label={label} className="scroll-thin flex max-w-full gap-1 overflow-x-auto rounded-full bg-surface-2 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-medium whitespace-nowrap transition-colors',
            value === o.value ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink',
          )}
        >
          {o.label}
          {o.count !== undefined && <span className="tabular text-[10px] text-muted">{o.count}</span>}
        </button>
      ))}
    </div>
  )
}

export function UnreadBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null
  return (
    <span
      className={cx('inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-pink-ink px-1.5 text-[10px] font-bold text-surface', className)}
      aria-label={`${count} unread`}
    >
      {count}
    </span>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-line-strong px-4 py-8 text-center text-sm text-muted">{children}</div>
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warn'; children: ReactNode }) {
  return (
    <div className={cx('flex gap-2 rounded-xl px-3 py-2.5 text-sm', tone === 'warn' ? 'bg-amber-wash text-amber-ink' : 'bg-green-wash text-green-ink')}>
      {tone === 'warn' ? <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden /> : <CircleCheck size={16} className="mt-0.5 shrink-0" aria-hidden />}
      <div>{children}</div>
    </div>
  )
}

export function Toasts() {
  const { toasts, dismissToast } = useStore()
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cx(
            'pointer-events-auto flex max-w-md items-start gap-3 rounded-2xl px-4 py-3 text-sm shadow-lg',
            t.tone === 'error' ? 'bg-red-ink text-surface' : 'bg-ink text-bg',
          )}
        >
          <span className="flex-1">{t.text}</span>
          <button type="button" onClick={() => dismissToast(t.id)} aria-label="Dismiss" className="opacity-70 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-pink-wash font-semibold text-pink-ink"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      aria-hidden
    >
      {initials}
    </span>
  )
}
