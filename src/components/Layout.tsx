import { Boxes, FileText, LayoutDashboard, Menu, MessageCircle, MessagesSquare, Monitor, Moon, Settings, ShieldCheck, ShoppingBag, Sun, Users, Wallet, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { unreadTotals } from '../domain/metrics'
import { href, type Route } from '../router'
import { useStore } from '../state/store'
import { Logo } from './Logo'
import { cx, UnreadBadge } from './ui'

type NavItem = { route: Route; label: string; icon: typeof LayoutDashboard; badge?: number; superOnly?: boolean; customerPage?: boolean }

export function Layout({ route, children }: { route: Route; children: ReactNode }) {
  const { state, isSuperAdmin } = useStore()
  const [menuOpen, setMenuOpen] = useState(false)
  const unread = unreadTotals(state.threads).messages
  const awaiting = state.orders.filter((o) => o.status === 'PENDING').length

  useEffect(() => setMenuOpen(false), [route])
  useEffect(() => {
    document.title = unread > 0 ? `(${unread}) Whimsy & Bloom` : 'Whimsy & Bloom'
  }, [unread])

  const nav: NavItem[] = [
    { route: { page: 'overview' }, label: 'Overview', icon: LayoutDashboard },
    { route: { page: 'orders' }, label: 'Orders', icon: ShoppingBag, badge: awaiting },
    { route: { page: 'inbox' }, label: 'Live chat', icon: MessageCircle, badge: unread },
    { route: { page: 'customers' }, label: 'Customers', icon: Users },
    { route: { page: 'inventory' }, label: 'Materials', icon: Boxes },
    { route: { page: 'fees' }, label: 'Service fees', icon: Wallet },
    { route: { page: 'settings' }, label: 'Settings', icon: Settings, superOnly: true },
    { route: { page: 'order-form' }, label: 'Order form', icon: FileText, customerPage: true },
    { route: { page: 'chat' }, label: 'Chat page', icon: MessagesSquare, customerPage: true },
  ]

  const sidebar = (
    <nav className="flex h-full flex-col gap-6 px-4 py-5" aria-label="Main">
      <a href="#/" className="px-2">
        <Logo />
      </a>
      {[nav.filter((n) => !n.customerPage), nav.filter((n) => n.customerPage)].map((group, gi) => (
      <ul key={gi} className="flex flex-col gap-0.5">
        {gi === 1 && <li className="eyebrow px-3 pb-1">Customer pages</li>}
        {group
          .filter((n) => !n.superOnly || isSuperAdmin)
          .map((n) => {
            const active = n.route.page === route.page
            return (
              <li key={n.label}>
                <a
                  href={href(n.route)}
                  aria-current={active ? 'page' : undefined}
                  className={cx(
                    'flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors',
                    active ? 'bg-green text-on-green' : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
                  )}
                >
                  <n.icon size={18} aria-hidden />
                  <span className="flex-1">{n.label}</span>
                  {n.badge ? (
                    n.route.page === 'inbox' ? (
                      <UnreadBadge count={n.badge} />
                    ) : (
                      <span className={cx('tabular text-xs', active ? 'text-on-green/80' : 'text-muted')}>{n.badge}</span>
                    )
                  ) : null}
                </a>
              </li>
            )
          })}
      </ul>
      ))}
      <div className="mt-auto flex flex-col gap-3">
        <RoleSwitcher />
        <ThemeToggle />
      </div>
    </nav>
  )

  return (
    <div className="min-h-screen lg:flex">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-line bg-surface lg:block">{sidebar}</aside>

      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-line bg-surface/95 px-4 py-3 backdrop-blur lg:hidden">
        <a href="#/">
          <Logo compact />
        </a>
        <button type="button" onClick={() => setMenuOpen(true)} className="relative rounded-full p-2 hover:bg-surface-2" aria-label="Open menu">
          <Menu size={22} />
          {unread > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-pink-ink" aria-hidden />}
        </button>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-[#1e2a23]/40" onClick={() => setMenuOpen(false)} aria-hidden />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] overflow-y-auto bg-surface shadow-2xl">
            <button type="button" onClick={() => setMenuOpen(false)} className="absolute right-3 top-4 rounded-full p-2 hover:bg-surface-2" aria-label="Close menu">
              <X size={18} />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">{children}</main>
    </div>
  )
}

function RoleSwitcher() {
  const { state, user, dispatch } = useStore()
  return (
    <div className="rounded-2xl border border-line bg-surface-2 p-3">
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
        <ShieldCheck size={13} aria-hidden /> Signed in as
      </div>
      <select
        value={user.id}
        onChange={(e) => dispatch({ type: 'SWITCH_USER', userId: e.target.value })}
        className="w-full rounded-lg border border-line-strong bg-surface px-2 py-1.5 text-sm font-medium"
        aria-label="Switch user (demo)"
      >
        {state.users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name} · {u.role === 'SUPER_ADMIN' ? 'Super admin' : 'Admin'}
          </option>
        ))}
      </select>
      <p className="mt-1.5 text-[11px] leading-snug text-muted">Demo switcher. Real logins come in Stage B.</p>
    </div>
  )
}

type Theme = 'system' | 'light' | 'dark'

function readTheme(): Theme {
  try {
    const t = localStorage.getItem('whimsy-bloom:theme')
    return t === 'light' || t === 'dark' ? t : 'system'
  } catch {
    return 'system'
  }
}

function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(readTheme)
  useEffect(() => {
    if (theme === 'system') document.documentElement.removeAttribute('data-theme')
    else document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem('whimsy-bloom:theme', theme)
    } catch {
      // Remembering the theme is a nicety only.
    }
  }, [theme])
  const options: [Theme, typeof Sun, string][] = [
    ['light', Sun, 'Light'],
    ['system', Monitor, 'System'],
    ['dark', Moon, 'Dark'],
  ]
  return (
    <div className="flex rounded-full bg-surface-2 p-1" role="radiogroup" aria-label="Theme">
      {options.map(([value, Icon, label]) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={theme === value}
          aria-label={label}
          title={label}
          onClick={() => setTheme(value)}
          className={cx('flex h-7 flex-1 items-center justify-center rounded-full', theme === value ? 'bg-surface text-ink shadow-sm' : 'text-muted')}
        >
          <Icon size={14} />
        </button>
      ))}
    </div>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl font-semibold leading-tight sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}
