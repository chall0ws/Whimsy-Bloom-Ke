import { Check, CircleCheck, LogOut, MessageCircle, Minus, Package, Plus, RotateCcw, ShoppingBag, Smartphone, UserRound } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useAuth, type Account } from '../../auth/AuthProvider'
import { GoogleButton } from '../../auth/GoogleButton'
import { ChatWidget, customerUnread } from '../../components/chat/ChatWidget'
import { BloomMark, Logo } from '../../components/Logo'
import { TeamPreviewBar } from '../../components/TeamPreviewBar'
import { Avatar, Button, cx, Field, inputClass } from '../../components/ui'
import { formatDate, formatKES } from '../../domain/format'
import { orderSummary, orderTotal } from '../../domain/orders'
import type { Customer, FulfilmentMethod, Order } from '../../domain/types'
import { navigate, type PortalTab } from '../../router'
import { useStore } from '../../state/store'

/** The client portal: customers sign in with Google to track orders, pay, reorder and chat. */
export function Portal({ tab = 'orders' }: { tab?: PortalTab }) {
  const { account, loading } = useAuth()
  const { state } = useStore()
  const customer = account ? state.customers.find((c) => c.email?.toLowerCase() === account.email.toLowerCase()) : undefined

  if (loading) return <Page>{null}</Page>
  if (!account) return <SignIn />
  if (!customer) return <Welcome account={account} />
  return <SignedIn customer={customer} account={account} tab={tab} />
}

function Page({ children }: { children: ReactNode }) {
  return <div className="mx-auto flex min-h-[100dvh] max-w-xl flex-col gap-4 px-4 py-5">{children}</div>
}

function SignIn() {
  const { signInWithGoogle, mode } = useAuth()
  return (
    <Page>
      <TeamPreviewBar>Customers sign in here to track and pay for their orders.</TeamPreviewBar>
      <div className="my-auto rounded-3xl border border-line bg-surface p-8 text-center shadow-card">
        <Logo className="justify-center" />
        <h1 className="mt-8 font-display text-3xl font-semibold leading-tight">Your orders, all in one place</h1>
        <ul className="mx-auto mt-5 max-w-xs space-y-2 text-left text-sm text-ink-2">
          {['See where your bouquet is', 'Pay with M-Pesa', 'Order again in a few taps', 'Chat with us'].map((t) => (
            <li key={t} className="flex items-center gap-2">
              <Check size={16} className="shrink-0 text-green-ink" aria-hidden /> {t}
            </li>
          ))}
        </ul>
        <div className="mt-7">
          <GoogleButton onClick={() => signInWithGoogle('#/portal')} />
        </div>
        {mode === 'demo' && <p className="mt-4 text-xs text-muted">Demo: pick “Faith Njeri” to see a customer with past orders.</p>}
      </div>
      <a href="#/order-form" className="text-center text-sm text-ink-2 hover:text-ink">
        Just want to order? Use the order form, no account needed
      </a>
    </Page>
  )
}

/** First sign-in: we only need a phone number for M-Pesa and delivery. */
function Welcome({ account }: { account: Account }) {
  const { dispatch } = useStore()
  const { signOut } = useAuth()
  const [name, setName] = useState(account.name)
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  return (
    <Page>
      <div className="my-auto rounded-3xl border border-line bg-surface p-7 shadow-card">
        <BloomMark size={44} />
        <h1 className="mt-3 font-display text-3xl font-semibold">Welcome, {account.name.split(' ')[0]}!</h1>
        <p className="mt-1 text-sm text-muted">One quick step. If you’ve ordered or chatted with us before using this number, we’ll bring your orders across.</p>
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
    </Page>
  )
}

const TABS: { id: PortalTab; label: string; icon: typeof Package }[] = [
  { id: 'orders', label: 'My orders', icon: Package },
  { id: 'new', label: 'Order', icon: ShoppingBag },
  { id: 'chat', label: 'Chat', icon: MessageCircle },
  { id: 'profile', label: 'Profile', icon: UserRound },
]

function SignedIn({ customer, account, tab }: { customer: Customer; account: Account; tab: PortalTab }) {
  const { state } = useStore()
  const [chatDraft, setChatDraft] = useState<string | undefined>()
  const [placed, setPlaced] = useState<string | null>(null)
  const [reorder, setReorder] = useState<Order | undefined>()
  const thread = state.threads.find((t) => t.customerId === customer.id)
  const unseen = tab === 'chat' ? 0 : customerUnread(thread)
  const go = (t: PortalTab) => navigate({ page: 'portal', tab: t })

  return (
    <Page>
      <TeamPreviewBar />
      <header className="flex items-center justify-between gap-3">
        <a href="#/portal">
          <Logo compact />
        </a>
        <span className="flex items-center gap-2 text-sm text-ink-2">
          <span className="hidden sm:inline">{customer.name.split(' ')[0]}</span>
          {account.picture ? <img src={account.picture} alt="" className="h-8 w-8 rounded-full" /> : <Avatar name={customer.name} size={32} />}
        </span>
      </header>

      <nav className="grid grid-cols-4 gap-1 rounded-2xl bg-surface-2 p-1" aria-label="Portal">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              if (t.id === 'new') setReorder(undefined)
              go(t.id)
            }}
            aria-current={tab === t.id ? 'page' : undefined}
            className={cx('relative flex flex-col items-center gap-0.5 rounded-xl py-2 text-xs font-medium', tab === t.id ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink')}
          >
            <t.icon size={18} aria-hidden />
            {t.label}
            {t.id === 'chat' && unseen > 0 && (
              <span className="absolute right-2 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-pink-ink px-1 text-[10px] font-bold text-surface">{unseen}</span>
            )}
          </button>
        ))}
      </nav>

      {tab === 'orders' && (
        <OrdersTab
          customer={customer}
          placed={placed}
          onAsk={(order) => {
            setChatDraft(`About order ${order.number}: `)
            go('chat')
          }}
          onReorder={(order) => {
            setReorder(order)
            go('new')
          }}
        />
      )}
      {tab === 'new' && (
        <NewOrderTab
          key={reorder?.id}
          customer={customer}
          from={reorder}
          onPlaced={(number) => {
            setPlaced(number)
            setReorder(undefined)
            go('orders')
          }}
        />
      )}
      {tab === 'chat' && (
        <ChatWidget
          identity={{ customerId: customer.id, name: customer.name, phone: customer.phone ?? '' }}
          startedFrom="PORTAL"
          initialText={chatDraft}
          className="h-[calc(100dvh-220px)] min-h-[420px] !shadow-card"
        />
      )}
      {tab === 'profile' && <ProfileTab customer={customer} account={account} />}
    </Page>
  )
}

const ACTIVE: Order['status'][] = ['PENDING_PAYMENT', 'PENDING', 'PROCESSING']

function OrdersTab({
  customer,
  placed,
  onAsk,
  onReorder,
}: {
  customer: Customer
  placed: string | null
  onAsk: (order: Order) => void
  onReorder: (order: Order) => void
}) {
  const { state } = useStore()
  const orders = state.orders.filter((o) => o.customerId === customer.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const current = orders.filter((o) => ACTIVE.includes(o.status))
  const past = orders.filter((o) => !ACTIVE.includes(o.status))

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-semibold">Hi {customer.name.split(' ')[0]} 🌸</h1>
        <p className="text-sm text-muted">{current.length ? `You have ${current.length} order${current.length > 1 ? 's' : ''} on the way.` : 'Nothing on the way right now.'}</p>
      </div>
      {placed && (
        <div className="flex items-center gap-2 rounded-2xl bg-green-wash px-4 py-3 text-sm text-green-ink">
          <CircleCheck size={18} aria-hidden /> Order {placed} is in. Thank you!
        </div>
      )}
      {orders.length === 0 ? (
        <div className="rounded-3xl border border-line bg-surface p-8 text-center shadow-card">
          <BloomMark size={48} className="mx-auto" />
          <p className="mt-3 font-medium">No orders yet</p>
          <p className="mt-1 text-sm text-muted">Your bouquets will show up here so you can follow them.</p>
          <a href="#/portal/new" className="mt-5 inline-flex h-11 items-center rounded-full bg-green px-5 text-sm font-medium text-on-green">
            Order your first bouquet
          </a>
        </div>
      ) : (
        <>
          {current.map((o) => (
            <OrderCard key={o.id} order={o} customer={customer} onAsk={onAsk} onReorder={onReorder} />
          ))}
          {past.length > 0 && (
            <section className="space-y-3">
              <h2 className="eyebrow">Past orders</h2>
              {past.map((o) => (
                <OrderCard key={o.id} order={o} customer={customer} onAsk={onAsk} onReorder={onReorder} compact />
              ))}
            </section>
          )}
        </>
      )}
    </div>
  )
}

function stepsFor(order: Order) {
  const last = order.fulfilment.method === 'HAND_DELIVERY' ? 'Out for delivery' : 'On its way'
  const labels = ['Ordered', 'Paid', 'Being made', last]
  const reached = { PENDING_PAYMENT: 0, PENDING: 1, PROCESSING: 2, SHIPPED: 3, CANCELLED: -1, REFUNDED: -1 }[order.status]
  return { labels, reached }
}

function OrderCard({
  order,
  customer,
  onAsk,
  onReorder,
  compact,
}: {
  order: Order
  customer: Customer
  onAsk: (o: Order) => void
  onReorder: (o: Order) => void
  compact?: boolean
}) {
  const { state } = useStore()
  const { labels, reached } = stepsFor(order)
  const unpaid = order.status === 'PENDING_PAYMENT'

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

      {reached >= 0 && !(compact && order.status === 'SHIPPED') && (
        <ol className="mt-4 grid grid-cols-4 gap-1" aria-label="Order progress">
          {labels.map((label, i) => (
            <li key={label} className="flex flex-col gap-1.5">
              <span className={cx('h-1.5 rounded-full', i <= reached ? 'bg-green' : 'bg-line')} aria-hidden />
              <span className={cx('text-[11px] leading-tight', i === reached ? 'font-semibold text-ink' : i < reached ? 'text-ink-2' : 'text-muted')}>
                {label}
                {i === reached && <span className="sr-only"> (current step)</span>}
              </span>
            </li>
          ))}
        </ol>
      )}

      {!compact && (
        <p className="mt-3 text-sm text-ink-2">
          {order.fulfilment.method === 'HAND_DELIVERY' ? 'Hand delivery to ' : 'Courier to '}
          {order.fulfilment.address}
          {order.fulfilment.trackingNumber && (
            <>
              {' '}
              · {order.fulfilment.courier} tracking <strong className="text-ink">{order.fulfilment.trackingNumber}</strong>
            </>
          )}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {unpaid && <PayButton order={order} customer={customer} />}
        {compact && (
          <Button size="sm" variant="secondary" onClick={() => onReorder(order)}>
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

function PayButton({ order, customer }: { order: Order; customer: Customer }) {
  const { dispatch } = useStore()
  const [paying, setPaying] = useState(false)
  useEffect(() => {
    if (!paying) return
    // Stands in for the M-Pesa prompt on the customer's phone.
    const timer = setTimeout(() => {
      dispatch({ type: 'CUSTOMER_PAY', orderId: order.id, customerId: customer.id, reference: `S${Math.random().toString(36).slice(2, 11).toUpperCase()}` })
      setPaying(false)
    }, 2000)
    return () => clearTimeout(timer)
  }, [paying, order.id, customer.id, dispatch])
  if (paying) {
    return (
      <span className="inline-flex h-8 items-center gap-1.5 text-sm text-ink-2">
        <Smartphone size={16} className="animate-pulse" aria-hidden /> Check your phone for the M-Pesa prompt…
      </span>
    )
  }
  return (
    <Button size="sm" variant="primary" onClick={() => setPaying(true)}>
      <Smartphone size={14} aria-hidden /> Pay {formatKES(orderTotal(order))} with M-Pesa
    </Button>
  )
}

/** `from` pre-fills the form from a past order ("Order again"). */
function NewOrderTab({ customer, from, onPlaced }: { customer: Customer; from?: Order; onPlaced: (orderNumber: string) => void }) {
  const { state, dispatch } = useStore()
  const [productId, setProductId] = useState(from?.items[0].productId ?? state.products[0].id)
  const [qty, setQty] = useState(from?.items[0].qty ?? 1)
  const [note, setNote] = useState(from?.customisation ?? '')
  const [method, setMethod] = useState<FulfilmentMethod>(from?.fulfilment.method ?? 'SHIPPING')
  const [address, setAddress] = useState(customer.address ?? from?.fulfilment.address ?? '')
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState('')
  const product = state.products.find((p) => p.id === productId)!
  const deliveryFee = method === 'HAND_DELIVERY' ? 0 : state.settings.defaultShippingFee
  const total = product.price * qty + deliveryFee

  const place = (pay: boolean) => {
    if (!address.trim()) return setError('Please add where to deliver.')
    setError('')
    const r = dispatch({
      type: 'CUSTOMER_PLACE_ORDER',
      draft: {
        customerId: customer.id,
        customerName: customer.name,
        phone: customer.phone,
        channel: 'PORTAL',
        items: [{ productId, qty }],
        customisation: note,
        method,
        address,
        payment: pay ? { kind: 'PAID', method: 'MPESA', reference: `S${Math.random().toString(36).slice(2, 11).toUpperCase()}` } : { kind: 'UNPAID' },
      },
    })
    if (!r.ok) return setPaying(false)
    if (!customer.address) dispatch({ type: 'CUSTOMER_UPDATE_PROFILE', customerId: customer.id, email: customer.email ?? '', patch: { address } })
    onPlaced(r.state.orders.find((o) => o.id === r.createdOrderId)?.number ?? '')
  }

  useEffect(() => {
    if (!paying) return
    const timer = setTimeout(() => place(true), 2000)
    return () => clearTimeout(timer)
  }, [paying])

  if (paying) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-3xl border border-line bg-surface p-10 text-center shadow-card">
        <Smartphone size={36} className="animate-pulse text-green" aria-hidden />
        <h2 className="font-display text-2xl font-semibold">Check your phone</h2>
        <p className="text-sm text-muted">
          We sent an M-Pesa prompt to {customer.phone}. Enter your PIN to pay {formatKES(total)}.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl font-semibold">Order a bouquet</h1>

      <div role="radiogroup" aria-label="Bouquet" className="grid grid-cols-2 gap-2">
        {state.products.map((p) => (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={productId === p.id}
            onClick={() => setProductId(p.id)}
            className={cx('rounded-2xl border p-3 text-left transition-colors', productId === p.id ? 'border-green bg-green-wash' : 'border-line-strong bg-surface hover:bg-surface-2')}
          >
            <div className="text-sm font-semibold leading-tight">{p.name}</div>
            <div className="mt-1 text-xs text-muted">{formatKES(p.price)}</div>
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3">
        <span className="text-sm font-medium">How many</span>
        <span className="flex items-center gap-3">
          <button type="button" onClick={() => setQty(Math.max(1, qty - 1))} className="rounded-full border border-line-strong p-1.5" aria-label="One fewer">
            <Minus size={14} />
          </button>
          <span className="w-6 text-center font-semibold" aria-live="polite">
            {qty}
          </span>
          <button type="button" onClick={() => setQty(qty + 1)} className="rounded-full border border-line-strong p-1.5" aria-label="One more">
            <Plus size={14} />
          </button>
        </span>
      </div>

      <Field label="Make it yours (optional)" hint="Colours, card message, wrapping">
        <input id="portal-note" className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Blush ribbon, card: “Happy birthday Mum!”" />
      </Field>

      <div role="radiogroup" aria-label="Delivery" className="grid grid-cols-2 gap-2">
        {(
          [
            ['SHIPPING', 'Courier delivery', formatKES(state.settings.defaultShippingFee)],
            ['HAND_DELIVERY', 'Hand delivery', 'Free · Nairobi'],
          ] as const
        ).map(([value, title, detail]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={method === value}
            onClick={() => setMethod(value)}
            className={cx('rounded-2xl border p-3 text-left', method === value ? 'border-green bg-green-wash' : 'border-line-strong bg-surface hover:bg-surface-2')}
          >
            <div className="text-sm font-semibold">{title}</div>
            <div className="text-xs text-muted">{detail}</div>
          </button>
        ))}
      </div>
      <Field label="Deliver to">
        <input id="portal-address" className={inputClass} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Estate / building, area, town" />
      </Field>

      <div className="rounded-2xl bg-surface-2 p-4 text-sm">
        <div className="flex justify-between">
          <span>
            {product.name} × {qty}
          </span>
          <span>{formatKES(product.price * qty)}</span>
        </div>
        <div className="flex justify-between text-ink-2">
          <span>Delivery</span>
          <span>{deliveryFee ? formatKES(deliveryFee) : 'Free'}</span>
        </div>
        <div className="mt-2 flex justify-between border-t border-line pt-2 text-base font-semibold">
          <span>Total</span>
          <span>{formatKES(total)}</span>
        </div>
      </div>
      {error && <p className="text-sm font-medium text-red-ink">{error}</p>}
      <div className="space-y-2">
        <Button
          variant="primary"
          className="!h-12 w-full !text-base"
          onClick={() => {
            if (!address.trim()) return setError('Please add where to deliver.')
            setPaying(true)
          }}
        >
          <Smartphone size={18} aria-hidden /> Pay {formatKES(total)} with M-Pesa
        </Button>
        <Button variant="ghost" className="w-full" onClick={() => place(false)}>
          Order now, pay later
        </Button>
      </div>
    </div>
  )
}

function ProfileTab({ customer, account }: { customer: Customer; account: Account }) {
  const { dispatch } = useStore()
  const { signOut } = useAuth()
  const [name, setName] = useState(customer.name)
  const [phone, setPhone] = useState(customer.phone ?? '')
  const [address, setAddress] = useState(customer.address ?? '')
  const [saved, setSaved] = useState(false)
  const dirty = name !== customer.name || phone !== (customer.phone ?? '') || address !== (customer.address ?? '')

  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl font-semibold">Your details</h1>
      <form
        className="space-y-4 rounded-3xl border border-line bg-surface p-5 shadow-card"
        onSubmit={(e) => {
          e.preventDefault()
          const r = dispatch({ type: 'CUSTOMER_UPDATE_PROFILE', customerId: customer.id, email: account.email, patch: { name, phone, address } })
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
          <div className="text-muted">Signed in with Google</div>
          <div className="truncate font-medium">{account.email}</div>
        </div>
        <Button
          variant="secondary"
          onClick={async () => {
            await signOut()
            navigate({ page: 'portal' })
          }}
        >
          <LogOut size={14} aria-hidden /> Sign out
        </Button>
      </div>
    </div>
  )
}
