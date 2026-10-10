import { CircleCheck, Minus, Plus, ShoppingBag, Smartphone, Trash2, UserRound } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { AuthPanel } from '../auth/AuthPanel'
import { useAuth } from '../auth/AuthProvider'
import { GoogleButton } from '../auth/GoogleButton'
import { BloomMark, HeartDivider, Script } from '../components/Logo'
import { Button, cx, Field, inputClass } from '../components/ui'
import type { OrderDraft } from '../domain/actions'
import { formatKES } from '../domain/format'
import { orderSummary, orderTotal, productName } from '../domain/orders'
import type { FulfilmentMethod } from '../domain/types'
import { navigate } from '../router'
import { useStore } from '../state/store'
import { placedHere, rememberOrder, useCart } from './cart'
import { mpesaReference, OrderTracker, PayButton } from './OrderBits'
import { ProductArt } from './ProductArt'
import { useCustomer } from './ShopLayout'

function Stepper({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <span className="flex items-center gap-2">
      <button type="button" onClick={() => onChange(value - 1)} disabled={value <= 1} className="rounded-full border border-line-strong p-1 disabled:opacity-40" aria-label="One fewer">
        <Minus size={12} />
      </button>
      <span className="w-5 text-center text-sm font-semibold">{value}</span>
      <button type="button" onClick={() => onChange(value + 1)} className="rounded-full border border-line-strong p-1" aria-label="One more">
        <Plus size={12} />
      </button>
    </span>
  )
}

export function CartPage() {
  const { state } = useStore()
  const { lines, setQty, setNote, remove } = useCart()
  const subtotal = lines.reduce((s, l) => s + l.qty * (state.products.find((p) => p.id === l.productId)?.price ?? 0), 0)

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-md py-12 text-center">
        <BloomMark size={56} className="mx-auto" />
        <h1 className="mt-4 font-display text-3xl font-semibold text-green-ink">Your cart is empty</h1>
        <p className="mt-2 text-sm text-ink-2">Find a bouquet you love. It only takes a minute.</p>
        <a href="#/shop" className="mt-6 inline-flex h-11 items-center rounded-full bg-green px-6 text-sm font-medium text-on-green">
          Shop bouquets
        </a>
      </div>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <section>
        <h1 className="mb-4 font-display text-4xl font-semibold text-green-ink">Your cart</h1>
        <ul className="space-y-3">
          {lines.map((line, i) => {
            const product = state.products.find((p) => p.id === line.productId)
            if (!product) return null
            return (
              <li key={i} className="flex gap-4 rounded-3xl border border-line bg-surface p-3 shadow-card">
                <ProductArt productId={product.id} label={product.name} className="h-24 w-20 shrink-0 rounded-2xl" />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <a href={`#/shop/${product.id}`} className="font-display text-lg font-semibold leading-tight hover:underline">
                      {product.name}
                    </a>
                    <span className="shrink-0 font-semibold">{formatKES(product.price * line.qty)}</span>
                  </div>
                  <input
                    className={cx(inputClass, '!py-1.5 text-xs')}
                    value={line.note}
                    onChange={(e) => setNote(i, e.target.value)}
                    placeholder="Colours or card message (optional)"
                    aria-label={`Wishes for ${product.name}`}
                  />
                  <div className="flex items-center justify-between">
                    <Stepper value={line.qty} onChange={(n) => setQty(i, n)} />
                    <button type="button" onClick={() => remove(i)} className="inline-flex items-center gap-1 text-xs text-ink-2 hover:text-red-ink">
                      <Trash2 size={13} aria-hidden /> Remove
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
        <a href="#/shop" className="mt-4 inline-block text-sm font-medium text-ink-2 hover:text-ink">
          ← Keep shopping
        </a>
      </section>
      <aside className="h-fit space-y-3 rounded-3xl border border-line bg-surface p-5 shadow-card lg:sticky lg:top-24">
        <div className="flex justify-between text-sm">
          <span>Bouquets</span>
          <span className="font-semibold">{formatKES(subtotal)}</span>
        </div>
        <p className="text-xs text-muted">Delivery is added at checkout. Hand delivery in Nairobi is free.</p>
        <a href="#/checkout" className="flex h-12 items-center justify-center rounded-full bg-green text-[15px] font-medium text-on-green hover:opacity-90">
          Checkout
        </a>
        <p className="text-center text-xs text-muted">No account needed. You can create one at checkout.</p>
      </aside>
    </div>
  )
}

export function Checkout() {
  const { state, dispatch } = useStore()
  const { account, signOut } = useAuth()
  const { lines, clear } = useCart()
  const customer = useCustomer()
  const [showAccount, setShowAccount] = useState(false)
  const [name, setName] = useState(customer?.name ?? account?.name ?? '')
  const [phone, setPhone] = useState(customer?.phone ?? '')
  const [email, setEmail] = useState('')
  const [method, setMethod] = useState<FulfilmentMethod>('SHIPPING')
  const [address, setAddress] = useState(customer?.address ?? '')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [paying, setPaying] = useState(false)
  const placing = useRef(false)

  // After signing in at checkout, fill in what we already know about them.
  useEffect(() => {
    if (!account) return
    setName((n) => n || customer?.name || account.name)
    setPhone((p) => p || customer?.phone || '')
    setAddress((a) => a || customer?.address || '')
  }, [account, customer])

  const subtotal = lines.reduce((s, l) => s + l.qty * (state.products.find((p) => p.id === l.productId)?.price ?? 0), 0)
  const deliveryFee = method === 'HAND_DELIVERY' ? 0 : state.settings.defaultShippingFee

  const check = () => {
    if (lines.length === 0) return 'Your cart is empty.'
    if (!name.trim()) return 'Please add your name.'
    if (phone.replace(/\D/g, '').length < 9) return 'Please add a phone number for M-Pesa and delivery.'
    if (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) return 'That email address doesn’t look right.'
    if (!address.trim()) return 'Please add where we should deliver.'
    return ''
  }

  const place = (paid: boolean) => {
    if (placing.current) return
    placing.current = true
    const wishes = [
      ...lines.filter((l) => l.note.trim()).map((l) => `${productName(state, l.productId)}: ${l.note.trim()}`),
      note.trim(),
    ].filter(Boolean)
    const base: Omit<OrderDraft, 'channel'> = {
      customerName: name,
      phone,
      items: lines.map((l) => ({ productId: l.productId, qty: l.qty })),
      customisation: wishes.join('; '),
      method,
      address,
      payment: paid ? { kind: 'PAID', method: 'MPESA', reference: mpesaReference() } : { kind: 'UNPAID' },
    }
    let draft: OrderDraft
    let accountCustomerId: string | undefined
    if (account) {
      const linked = dispatch({ type: 'CUSTOMER_LINK_ACCOUNT', email: account.email, name, phone, address })
      if (!linked.ok) {
        placing.current = false
        return setPaying(false)
      }
      accountCustomerId = linked.customerId
      draft = { ...base, channel: 'PORTAL', customerId: accountCustomerId }
    } else {
      draft = { ...base, channel: 'WEB_FORM', email: email.trim() || undefined }
    }
    const result = dispatch({ type: 'CUSTOMER_PLACE_ORDER', draft })
    placing.current = false
    setPaying(false)
    if (!result.ok || !result.createdOrderId) return
    // Remember the phone and address on their account for next time, if it didn't have them yet.
    const saved = accountCustomerId && result.state.customers.find((c) => c.id === accountCustomerId)
    if (account && saved && (!saved.address || !saved.phone)) {
      dispatch({ type: 'CUSTOMER_UPDATE_PROFILE', customerId: saved.id, email: account.email, patch: { address: saved.address || address, phone: saved.phone || phone } })
    }
    rememberOrder(result.createdOrderId)
    clear()
    navigate({ page: 'thanks', orderId: result.createdOrderId })
  }

  useEffect(() => {
    if (!paying) return
    const timer = setTimeout(() => place(true), 2000)
    return () => clearTimeout(timer)
  }, [paying])

  if (lines.length === 0) return <CartPage />

  if (paying) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-3xl border border-line bg-surface p-10 text-center shadow-card">
        <Smartphone size={40} className="animate-pulse text-green" aria-hidden />
        <h1 className="font-display text-3xl font-semibold text-green-ink">Check your phone</h1>
        <p className="text-sm text-ink-2">
          We sent an M-Pesa prompt to {phone}. Enter your PIN to pay {formatKES(subtotal + deliveryFee)}.
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-5">
        <h1 className="font-display text-4xl font-semibold text-green-ink">Checkout</h1>

        <section className="space-y-4 rounded-3xl border border-line bg-surface p-5 shadow-card">
          <h2 className="eyebrow">1 · Your details</h2>
          {account ? (
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-green-wash px-4 py-3 text-sm">
              <span className="flex min-w-0 items-center gap-2 text-green-ink">
                <CircleCheck size={16} className="shrink-0" aria-hidden />
                <span className="truncate">
                  Signed in as <strong>{account.email}</strong>. We’ll save this order to your account.
                </span>
              </span>
              <button type="button" onClick={() => signOut()} className="shrink-0 text-xs font-medium text-ink-2 underline">
                Not you?
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-pink/70 bg-pink-wash/60 p-4">
              <p className="font-medium">Save your details and track your order</p>
              <p className="mt-0.5 text-sm text-ink-2">Create a free account in one tap, or carry on as a guest below.</p>
              {showAccount ? (
                <AuthPanel className="mt-4" returnTo="#/checkout" googleLabel="Continue with Google" />
              ) : (
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="sm:w-64">
                    <GoogleButtonFor returnTo="#/checkout" />
                  </div>
                  <button type="button" onClick={() => setShowAccount(true)} className="text-sm font-medium text-pink-ink hover:underline">
                    Use email instead, or sign in
                  </button>
                </div>
              )}
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Your name">
              <input id="checkout-name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </Field>
            <Field label="Phone number" hint="For the M-Pesa prompt and delivery.">
              <input id="checkout-phone" className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07…" inputMode="tel" autoComplete="tel" />
            </Field>
            {!account && (
              <Field label="Email (optional)" hint="For your receipt." className="sm:col-span-2">
                <input id="checkout-email" type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
              </Field>
            )}
          </div>
        </section>

        <section className="space-y-4 rounded-3xl border border-line bg-surface p-5 shadow-card">
          <h2 className="eyebrow">2 · Delivery</h2>
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
                className={cx('rounded-2xl border p-3 text-left', method === value ? 'border-green bg-green-wash' : 'border-line-strong hover:bg-surface-2')}
              >
                <div className="text-sm font-semibold">{title}</div>
                <div className="text-xs text-muted">{detail}</div>
              </button>
            ))}
          </div>
          <Field label="Deliver to">
            <input id="checkout-address" className={inputClass} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Estate / building, area, town" autoComplete="street-address" />
          </Field>
          <Field label="Anything else? (optional)" hint="Delivery date, a card message for the whole order…">
            <textarea id="checkout-note" className={inputClass} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </section>
      </div>

      <aside className="h-fit space-y-4 rounded-3xl border border-line bg-surface p-5 shadow-card lg:sticky lg:top-24">
        <h2 className="eyebrow">3 · Pay</h2>
        <ul className="space-y-2 text-sm">
          {lines.map((l, i) => {
            const product = state.products.find((p) => p.id === l.productId)
            return (
              <li key={i} className="flex justify-between gap-3">
                <span className="min-w-0">
                  {product?.name} × {l.qty}
                  {l.note && <span className="block truncate text-xs text-muted">{l.note}</span>}
                </span>
                <span className="shrink-0">{formatKES((product?.price ?? 0) * l.qty)}</span>
              </li>
            )
          })}
          <li className="flex justify-between text-ink-2">
            <span>Delivery</span>
            <span>{deliveryFee ? formatKES(deliveryFee) : 'Free'}</span>
          </li>
          <li className="flex justify-between border-t border-line pt-2 text-base font-semibold">
            <span>Total</span>
            <span>{formatKES(subtotal + deliveryFee)}</span>
          </li>
        </ul>
        {error && <p className="text-sm font-medium text-red-ink">{error}</p>}
        <Button
          variant="primary"
          className="!h-12 w-full !text-base"
          onClick={() => {
            const problem = check()
            setError(problem)
            if (!problem) setPaying(true)
          }}
        >
          <Smartphone size={18} aria-hidden /> Pay {formatKES(subtotal + deliveryFee)} with M-Pesa
        </Button>
        <Button
          variant="ghost"
          className="w-full"
          onClick={() => {
            const problem = check()
            setError(problem)
            if (!problem) place(false)
          }}
        >
          Place order, pay later
        </Button>
        <p className="text-center text-xs text-muted">Paying later? We’ll send you a payment link.</p>
      </aside>
    </div>
  )
}

function GoogleButtonFor({ returnTo }: { returnTo: string }) {
  const { signInWithGoogle } = useAuth()
  return <GoogleButton label="Continue with Google" onClick={() => signInWithGoogle(returnTo)} />
}

export function Thanks({ orderId }: { orderId: string }) {
  const { state, dispatch } = useStore()
  const { account } = useAuth()
  const order = state.orders.find((o) => o.id === orderId)
  const owner = order && state.customers.find((c) => c.id === order.customerId)
  const mine = Boolean(order && (placedHere(order.id) || (account && owner?.email?.toLowerCase() === account.email.toLowerCase())))
  const saved = Boolean(account && owner?.email?.toLowerCase() === account.email.toLowerCase())

  // A guest who creates an account here gets this order saved to it.
  useEffect(() => {
    if (!order || !account || saved || !placedHere(order.id)) return
    dispatch({ type: 'CUSTOMER_LINK_ACCOUNT', email: account.email, name: account.name, phone: '', claimOrderId: order.id })
  }, [order, account, saved, dispatch])

  if (!order || !mine) {
    return (
      <div className="py-16 text-center">
        <p className="font-display text-2xl">We couldn’t find that order on this device.</p>
        <a href="#/account" className="mt-4 inline-block font-medium text-pink-ink hover:underline">
          Sign in to see your orders
        </a>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div className="text-center">
        <BloomMark size={56} className="mx-auto" />
        <Script className="mt-3 block text-5xl leading-none">Thank you,</Script>
        <h1 className="font-display text-4xl font-semibold text-green-ink">{owner?.name.split(' ')[0] ?? 'friend'}!</h1>
        <HeartDivider className="mx-auto mt-3 w-48" />
        <p className="mt-3 text-ink-2">
          Order <strong className="text-ink">{order.number}</strong> is in. {order.payment.status === 'PAID' ? 'It’s paid and in the queue.' : 'We’ll start as soon as it’s paid.'}
        </p>
      </div>

      <section className="space-y-4 rounded-3xl border border-line bg-surface p-5 shadow-card">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs text-muted">{order.number}</div>
            <div className="font-semibold">{orderSummary(state, order)}</div>
            {order.customisation && <div className="text-sm text-ink-2">{order.customisation}</div>}
          </div>
          <div className="shrink-0 font-semibold">{formatKES(orderTotal(order))}</div>
        </div>
        <OrderTracker order={order} />
        <p className="text-sm text-ink-2">
          {order.fulfilment.method === 'HAND_DELIVERY' ? 'Hand delivery to ' : 'Courier to '}
          {order.fulfilment.address}
        </p>
        {order.status === 'PENDING_PAYMENT' && <PayButton order={order} size="md" />}
      </section>

      {saved ? (
        <a href="#/account" className="flex items-center justify-center gap-2 rounded-3xl bg-green-wash px-5 py-4 text-sm font-medium text-green-ink">
          <CircleCheck size={17} aria-hidden /> Saved to your account. Track it any time in My account.
        </a>
      ) : (
        <section className="space-y-3 rounded-3xl border border-pink/70 bg-pink-wash/60 p-5">
          <div className="flex items-start gap-3">
            <UserRound size={20} className="mt-0.5 shrink-0 text-pink-ink" aria-hidden />
            <div>
              <p className="font-medium">Want to follow this order?</p>
              <p className="text-sm text-ink-2">Create a free account and we’ll keep this order there, with your details ready for next time.</p>
            </div>
          </div>
          <AuthPanel returnTo={`#/thanks/${order.id}`} />
        </section>
      )}

      <div className="text-center">
        <a href="#/shop" className="inline-flex items-center gap-2 text-sm font-medium text-ink-2 hover:text-ink">
          <ShoppingBag size={15} aria-hidden /> Keep shopping
        </a>
      </div>
    </div>
  )
}
