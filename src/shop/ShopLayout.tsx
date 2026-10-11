import { MessageCircle, ShoppingBag, UserRound } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { ChatWidget, customerUnread, useMyThread } from '../components/chat/ChatWidget'
import { BloomMark, HeartDivider, Logo, Script } from '../components/Logo'
import { TeamPreviewBar } from '../components/TeamPreviewBar'
import { cx, usePresence } from '../components/ui'
import type { ShopRoute } from '../router'
import { useStore } from '../state/store'
import { useCart } from './cart'

/** The signed-in customer's record, if they have one yet. */
export function useCustomer() {
  const { account } = useAuth()
  const { state } = useStore()
  return account ? state.customers.find((c) => c.email?.toLowerCase() === account.email.toLowerCase()) : undefined
}

/** Shown for a moment while the shop's data arrives (live mode). */
export function Loading() {
  return (
    <div className="flex justify-center py-20" role="status">
      <BloomMark size={44} className="animate-pulse" />
      <span className="sr-only">Loading…</span>
    </div>
  )
}

export function ShopLayout({ route, children, wide = true }: { route: ShopRoute; children: ReactNode; wide?: boolean }) {
  const { count } = useCart()
  const { account } = useAuth()
  const link = (active: boolean) => cx('rounded-full px-3 py-1.5 text-sm font-medium transition-colors', active ? 'bg-pink-wash text-pink-ink' : 'text-ink-2 hover:text-ink')

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <div className="mx-auto w-full max-w-6xl px-4 pt-3">
        <TeamPreviewBar>You’re seeing the shop as customers do.</TeamPreviewBar>
      </div>
      <header className="sticky top-0 z-40 border-b border-line/70 bg-bg/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <a href="#/" aria-label="Whimsy & Bloom home">
            <span className="hidden sm:block">
              <Logo />
            </span>
            <span className="sm:hidden">
              <Logo compact />
            </span>
          </a>
          <nav className="flex items-center gap-1" aria-label="Shop">
            <a href="#/shop" className={cx(link(route.page === 'shop' || route.page === 'product'), 'hidden sm:inline-flex')}>
              Shop
            </a>
            <a href="#/chat" className={cx(link(route.page === 'chat'), 'hidden sm:inline-flex')}>
              Chat with us
            </a>
            <a href="#/account" className={cx(link(route.page === 'account'), 'inline-flex items-center gap-1.5')} aria-label={account ? 'My account' : 'Sign in'}>
              <UserRound size={17} aria-hidden />
              <span className="hidden sm:inline">{account ? 'My account' : 'Sign in'}</span>
            </a>
            <a href="#/cart" className="relative inline-flex h-10 items-center gap-1.5 rounded-full bg-green px-4 text-sm font-medium text-on-green hover:opacity-90 active:scale-[0.97]" aria-label={`Cart, ${count} items`}>
              <ShoppingBag size={17} aria-hidden />
              <span className="hidden sm:inline">Cart</span>
              {count > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-pink px-1.5 text-[11px] font-bold text-[#3b1a24]">{count}</span>}
            </a>
          </nav>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2 sm:hidden" aria-label="Shop sections">
          <a href="#/shop" className={link(route.page === 'shop' || route.page === 'product')}>
            Shop
          </a>
          <a href="#/chat" className={link(route.page === 'chat')}>
            Chat with us
          </a>
        </nav>
      </header>

      <main className={cx('mx-auto w-full flex-1 px-4 py-6 sm:py-8', wide ? 'max-w-6xl' : 'max-w-xl')}>{children}</main>

      <footer className="mt-10 border-t border-line bg-surface/70">
        <div className="mx-auto max-w-6xl px-4 py-10 text-center">
          <Script className="text-4xl">Let’s create something beautiful together</Script>
          <HeartDivider className="mx-auto my-4 w-48" />
          <nav className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-ink-2" aria-label="Footer">
            <a href="#/shop" className="hover:text-ink">
              Shop
            </a>
            <a href="#/chat" className="hover:text-ink">
              Chat with us
            </a>
            <a href="#/account" className="hover:text-ink">
              My account
            </a>
            <a href="#/admin" className="hover:text-ink">
              Team sign-in
            </a>
            <a href="#/privacy" className="hover:text-ink">
              Privacy
            </a>
            <a href="#/terms" className="hover:text-ink">
              Terms
            </a>
          </nav>
          <p className="mt-4 text-xs text-muted">Whimsy &amp; Bloom · Handmade flowers, made with love.</p>
        </div>
      </footer>

      {route.page !== 'chat' && <ChatBubble />}
    </div>
  )
}

/** "Chat with us" on every shop page. Signed-in customers chat as themselves straight away. */
function ChatBubble() {
  const [open, setOpen] = useState(false)
  const [guestThread] = useMyThread()
  const customer = useCustomer()
  const { state } = useStore()
  const identity = customer?.phone ? { customerId: customer.id, name: customer.name, phone: customer.phone } : undefined
  const thread = identity ? state.threads.find((t) => t.customerId === identity.customerId) : guestThread
  const unseen = customerUnread(thread)
  const { mounted, leaving } = usePresence(open, 180)
  return (
    <>
      {mounted && (
        <ChatWidget
          startedFrom="ORDER_FORM"
          identity={identity}
          onClose={() => setOpen(false)}
          className={cx(
            'fixed inset-x-3 bottom-3 top-16 z-50 origin-bottom-right sm:inset-x-auto sm:right-6 sm:top-auto sm:bottom-24 sm:h-[560px] sm:w-[380px]',
            leaving ? 'anim-pop-out pointer-events-none' : 'anim-pop-in',
          )}
        />
      )}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cx(
          'fixed bottom-5 right-5 z-50 h-14 items-center gap-2 rounded-full bg-green px-5 font-medium text-on-green shadow-xl hover:-translate-y-0.5 hover:shadow-2xl active:scale-[0.97]',
          open ? 'hidden sm:inline-flex' : 'inline-flex',
        )}
        aria-expanded={open}
      >
        <MessageCircle size={20} aria-hidden />
        {open ? 'Close chat' : 'Chat with us'}
        {!open && unseen > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-pink px-1.5 text-[11px] font-bold text-[#3b1a24]">{unseen}</span>
        )}
      </button>
    </>
  )
}
