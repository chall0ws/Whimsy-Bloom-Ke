import { Check, CircleCheck, LogOut, MessageCircle, Package, RotateCcw, UserRound } from 'lucide-react'
import { useState } from 'react'
import { AuthPanel } from '../auth/AuthPanel'
import { useAuth, type Account as AuthAccount } from '../auth/AuthProvider'
import { ChatWidget, customerUnread } from '../components/chat/ChatWidget'
import { BloomMark, HeartDivider, Logo, Script, Sparkles } from '../components/Logo'
import { Button, cx, Field, inputClass } from '../components/ui'
import { formatDate, formatKES } from '../domain/format'
import { amountDue, deliveryLabel, orderSummary, orderTotal } from '../domain/orders'
import type { Customer, Order } from '../domain/types'
import { navigate, type AccountTab } from '../router'
import { useStore } from '../state/store'
import { useCart } from './cart'
import { OrderTracker, PayButton, PaymentSummary, ReadyPhoto } from './OrderBits'
import { Loading, useCustomer } from './ShopLayout'

/** My account: orders with tracking, chat and details. Signing in is optional for shopping. */
export function AccountPage({ tab = 'orders' }: { tab?: AccountTab }) {
  const { account, loading } = useAuth()
  const { ready } = useStore()
  const customer = useCustomer()
  if (loading || (account && !ready)) return <Loading />
  if (!account) return <SignIn />
  if (!customer) return <Welcome account={account} />
  return <SignedIn customer={customer} account={account} tab={tab} />
}

function SignIn() {
  const { mode } = useAuth()
  return (
    <div className="mx-auto max-w-md">
      <div className="relative rounded-b-3xl rounded-t-[180px] border border-line-strong bg-surface px-6 pb-7 pt-12 shadow-card sm:px-8">
        <Sparkles className="absolute left-6 top-24 w-12" />
        <Sparkles className="absolute right-5 top-36 w-10 -scale-x-100" />
        <div className="text-center">
          <Logo className="justify-center" />
          <Script className="mt-7 block text-4xl leading-none">Welcome to</Script>
          <h1 className="font-display text-3xl font-semibold leading-tight text-green-ink">your flower corner</h1>
          <HeartDivider className="mx-auto mt-3 w-40" />
        </div>
        <ul className="mx-auto my-5 max-w-xs space-y-1.5 text-sm text-ink-2">
          {['See where your bouquet is', 'Pay with M-Pesa', 'Order again in a few taps', 'Chat with us'].map((t) => (
            <li key={t} className="flex items-center gap-2">
              <Check size={16} className="shrink-0 text-green-ink" aria-hidden /> {t}
            </li>
          ))}
        </ul>
        <AuthPanel returnTo="#/account" defaultMode="signin" />
        {mode === 'demo' && <p className="mt-3 text-center text-xs text-muted">Demo: Continue with Google → “Faith Njeri” shows a customer with past orders.</p>}
      </div>
      <a href="#/shop" className="mt-5 block text-center text-sm text-ink-2 hover:text-ink">
        Just browsing? You can shop without an account.
      </a>
    </div>
  )
}

/** First sign-in: we only need a phone number for M-Pesa and delivery. */
function Welcome({ account }: { account: AuthAccount }) {
  const { dispatch } = useStore()
  const { signOut } = useAuth()
  const [name, setName] = useState(account.name)
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  return (
    <div className="mx-auto max-w-md rounded-3xl border border-line bg-surface p-7 shadow-card">
      <BloomMark size={44} />
      <Script className="mt-2 block text-4xl leading-none">Welcome,</Script>
      <h1 className="font-display text-3xl font-semibold text-green-ink">{account.name.split(' ')[0]}!</h1>
      <p className="mt-1 text-sm text-ink-2">One quick step. If you’ve ordered or chatted with us before using this number, we’ll bring your orders across.</p>
      <form
        className="mt-6 space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          dispatch({ type: 'CUSTOMER_LINK_ACCOUNT', email: account.email, name, phone, address })
        }}
      >
        <Field label="Your name">
          <input id="welcome-name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </Field>
        <Field label="Phone number" hint="For M-Pesa payments and delivery.">
          <input id="welcome-phone" className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07…" inputMode="tel" autoComplete="tel" />
        </Field>
        <Field label="Delivery address (optional)">
          <input id="welcome-address" className={inputClass} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Estate / building, area, town" />
        </Field>
        <Button type="submit" variant="primary" className="w-full">
          Continue
        </Button>
      </form>
      <p className="mt-4 text-center text-xs text-muted">
        Signed in as {account.email} ·{' '}
        <button type="button" onClick={signOut} className="underline">
          not you?
        </button>
      </p>
    </div>
  )
}

const TABS: { id: AccountTab; label: string; icon: typeof Package }[] = [
  { id: 'orders', label: 'My orders', icon: Package },
  { id: 'chat', label: 'Chat', icon: MessageCircle },
  { id: 'profile', label: 'Profile', icon: UserRound },
]

function SignedIn({ customer, account, tab }: { customer: Customer; account: AuthAccount; tab: AccountTab }) {
  const { state } = useStore()
  const [chatDraft, setChatDraft] = useState<string | undefined>()
  const thread = state.threads.find((t) => t.customerId === customer.id)
  const unseen = tab === 'chat' ? 0 : customerUnread(thread)
  const go = (t: AccountTab) => navigate({ page: 'account', tab: t })

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <nav className="grid grid-cols-3 gap-1 rounded-2xl bg-surface-2 p-1" aria-label="My account">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => go(t.id)}
            aria-current={tab === t.id ? 'page' : undefined}
            className={cx('relative flex flex-col items-center gap-0.5 rounded-xl py-2 text-xs font-medium', tab === t.id ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink')}
          >
            <t.icon size={18} aria-hidden />
            {t.label}
            {t.id === 'chat' && unseen > 0 && (
              <span className="absolute right-3 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-pink-ink px-1 text-[10px] font-bold text-surface">{unseen}</span>
            )}
          </button>
        ))}
      </nav>

      {tab === 'orders' && (
        <OrdersTab
          customer={customer}
          onAsk={(order) => {
            setChatDraft(`About order ${order.number}: `)
            go('chat')
          }}
        />
      )}
      {tab === 'chat' && (
        <ChatWidget
          identity={{ customerId: customer.id, name: customer.name, phone: customer.phone ?? '' }}
          startedFrom="PORTAL"
          initialText={chatDraft}
          className="h-[calc(100dvh-260px)] min-h-[420px] !shadow-card"
        />
      )}
      {tab === 'profile' && <ProfileTab customer={customer} account={account} />}
    </div>
  )
}

const ACTIVE: Order['status'][] = ['PENDING_PAYMENT', 'PENDING', 'PROCESSING', 'READY']

function OrdersTab({ customer, onAsk }: { customer: Customer; onAsk: (order: Order) => void }) {
  const { state } = useStore()
  const orders = state.orders.filter((o) => o.customerId === customer.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const current = orders.filter((o) => ACTIVE.includes(o.status))
  const past = orders.filter((o) => !ACTIVE.includes(o.status))

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-script text-5xl leading-tight text-pink-ink">Hi {customer.name.split(' ')[0]}</h1>
        <p className="text-sm text-ink-2">{current.length ? `You have ${current.length} order${current.length > 1 ? 's' : ''} on the way.` : 'Nothing on the way right now.'}</p>
      </div>
      {orders.length === 0 ? (
        <div className="rounded-3xl border border-line bg-surface p-8 text-center shadow-card">
          <BloomMark size={48} className="mx-auto" />
          <p className="mt-3 font-medium">No orders yet</p>
          <p className="mt-1 text-sm text-ink-2">Your bouquets will show up here so you can follow them.</p>
          <a href="#/shop" className="mt-5 inline-flex h-11 items-center rounded-full bg-green px-5 text-sm font-medium text-on-green">
            Shop bouquets
          </a>
        </div>
      ) : (
        <>
          {current.map((o) => (
            <OrderCard key={o.id} order={o} onAsk={onAsk} />
          ))}
          {past.length > 0 && (
            <section className="space-y-3">
              <h2 className="eyebrow">Past orders</h2>
              {past.map((o) => (
                <OrderCard key={o.id} order={o} onAsk={onAsk} compact />
              ))}
            </section>
          )}
        </>
      )}
    </div>
  )
}

function OrderCard({ order, onAsk, compact }: { order: Order; onAsk: (o: Order) => void; compact?: boolean }) {
  const { state } = useStore()
  const { add } = useCart()
  // Something to pay now: the deposit, or the balance once it's ready.
  const unpaid = amountDue(order) > 0

  return (
    <article className={cx('rounded-3xl border bg-surface p-5 shadow-card', unpaid ? 'border-pink' : 'border-line')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-muted">
            {order.number} · {formatDate(order.createdAt)}
          </div>
          <div className="font-semibold">{orderSummary(state, order)}</div>
          {order.customisation && !compact && <div className="mt-0.5 text-sm text-ink-2">{order.customisation}</div>}
        </div>
        <div className="shrink-0 text-right">
          <div className="font-semibold">{formatKES(orderTotal(order))}</div>
          {order.status === 'SHIPPED' && compact && (
            <div className="inline-flex items-center gap-1 text-xs font-medium text-green-ink">
              <CircleCheck size={12} aria-hidden /> Sent
            </div>
          )}
          {order.status === 'CANCELLED' && <div className="text-xs text-muted">Cancelled</div>}
          {order.status === 'REFUNDED' && <div className="text-xs text-red-ink">Refunded</div>}
        </div>
      </div>

      {!compact && (
        <>
          <div className="mt-4">
            <OrderTracker order={order} />
          </div>
          <div className="mt-3">
            <ReadyPhoto order={order} />
          </div>
          <div className="mt-3">
            <PaymentSummary order={order} />
          </div>
          <p className="mt-2 text-sm text-ink-2">
            {deliveryLabel(order.fulfilment)} · {order.fulfilment.address}
            {order.fulfilment.trackingNumber && (
              <>
                {' '}
                · {order.fulfilment.courier} tracking <strong className="text-ink">{order.fulfilment.trackingNumber}</strong>
              </>
            )}
          </p>
        </>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {unpaid && <PayButton order={order} />}
        {compact && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              order.items.forEach((item) => add(item.productId, item.qty, order.customisation))
              navigate({ page: 'cart' })
            }}
          >
            <RotateCcw size={14} aria-hidden /> Order again
          </Button>
        )}
        <Button size="sm" variant={unpaid || compact ? 'ghost' : 'secondary'} onClick={() => onAsk(order)}>
          <MessageCircle size={14} aria-hidden /> Ask about this order
        </Button>
      </div>
    </article>
  )
}

function ProfileTab({ customer, account }: { customer: Customer; account: AuthAccount }) {
  const { dispatch } = useStore()
  const { signOut } = useAuth()
  const [name, setName] = useState(customer.name)
  const [phone, setPhone] = useState(customer.phone ?? '')
  const [address, setAddress] = useState(customer.address ?? '')
  const [saved, setSaved] = useState(false)
  const dirty = name !== customer.name || phone !== (customer.phone ?? '') || address !== (customer.address ?? '')

  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl font-semibold text-green-ink">Your details</h1>
      <form
        className="space-y-4 rounded-3xl border border-line bg-surface p-5 shadow-card"
        onSubmit={async (e) => {
          e.preventDefault()
          const r = await dispatch({ type: 'CUSTOMER_UPDATE_PROFILE', customerId: customer.id, email: account.email, patch: { name, phone, address } })
          setSaved(r.ok)
        }}
      >
        <Field label="Name">
          <input id="profile-name" className={inputClass} value={name} onChange={(e) => (setName(e.target.value), setSaved(false))} autoComplete="name" />
        </Field>
        <Field label="Phone number" hint="We send M-Pesa prompts here.">
          <input id="profile-phone" className={inputClass} value={phone} onChange={(e) => (setPhone(e.target.value), setSaved(false))} inputMode="tel" autoComplete="tel" />
        </Field>
        <Field label="Delivery address">
          <input id="profile-address" className={inputClass} value={address} onChange={(e) => (setAddress(e.target.value), setSaved(false))} />
        </Field>
        <div className="flex items-center gap-3">
          <Button type="submit" variant="primary" disabled={!dirty}>
            Save
          </Button>
          {saved && !dirty && (
            <span className="inline-flex items-center gap-1 text-sm text-green-ink">
              <CircleCheck size={15} aria-hidden /> Saved
            </span>
          )}
        </div>
      </form>
      <div className="flex items-center justify-between gap-3 rounded-3xl border border-line bg-surface p-5 shadow-card">
        <div className="min-w-0 text-sm">
          <div className="text-muted">Signed in with {account.provider === 'google' ? 'Google' : 'email'}</div>
          <div className="truncate font-medium">{account.email}</div>
        </div>
        <Button
          variant="secondary"
          onClick={async () => {
            await signOut()
            navigate({ page: 'account' })
          }}
        >
          <LogOut size={14} aria-hidden /> Sign out
        </Button>
      </div>
    </div>
  )
}
