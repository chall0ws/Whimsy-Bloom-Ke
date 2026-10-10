import { CircleCheck, Flower, Flower2, Gift, Leaf, MessageCircle, Smartphone } from 'lucide-react'
import { ChatWidget, customerUnread, useMyThread } from '../components/chat/ChatWidget'
import { useEffect, useState } from 'react'
import { BloomMark, HeartDivider, Logo, Script, Sparkles } from '../components/Logo'
import { TeamPreviewBar } from '../components/TeamPreviewBar'
import { Button, cx, Field, inputClass } from '../components/ui'
import { formatKES } from '../domain/format'
import type { FulfilmentMethod } from '../domain/types'
import { useStore } from '../state/store'

type Step = 'form' | 'paying' | 'done'

const FEATURES = [
  { icon: Flower2, title: 'HANDMADE FLOWERS', detail: 'Fuzzy wire flowers & more' },
  { icon: Gift, title: 'BESPOKE BOUQUETS', detail: 'Made for your special moments' },
  { icon: Flower, title: 'GIANT FLOWERS', detail: 'For events, decor & photoshoots' },
  { icon: Leaf, title: 'DETAILS THAT BLOOM', detail: 'Fillers, greenery & finishing touches' },
]

/**
 * The page linked from her social media bios. In Stage A it writes straight
 * into the dashboard and simulates the M-Pesa prompt.
 */
export function OrderForm() {
  const { state, dispatch } = useStore()
  const [step, setStep] = useState<Step>('form')
  const [orderNumber, setOrderNumber] = useState('')
  const [productId, setProductId] = useState(state.products[0].id)
  const [qty, setQty] = useState(1)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [instagram, setInstagram] = useState('')
  const [customisation, setCustomisation] = useState('')
  const [method, setMethod] = useState<FulfilmentMethod>('SHIPPING')
  const [address, setAddress] = useState('')
  const [error, setError] = useState('')

  const product = state.products.find((p) => p.id === productId)!
  const deliveryFee = method === 'HAND_DELIVERY' ? 0 : state.settings.defaultShippingFee
  const total = product.price * qty + deliveryFee

  useEffect(() => {
    if (step !== 'paying') return
    const timer = setTimeout(() => {
      const r = dispatch({
        type: 'CUSTOMER_PLACE_ORDER',
        draft: {
          customerName: name,
          phone,
          instagram: instagram || undefined,
          channel: 'WEB_FORM',
          items: [{ productId, qty }],
          customisation,
          method,
          address,
          payment: { kind: 'PAID', method: 'MPESA', reference: `S${Math.random().toString(36).slice(2, 11).toUpperCase()}` },
        },
      })
      if (r.ok) {
        setOrderNumber(r.state.orders.find((o) => o.id === r.createdOrderId)?.number ?? '')
        setStep('done')
      } else setStep('form')
    }, 2200)
    return () => clearTimeout(timer)
  }, [step])

  const submit = () => {
    if (!name.trim()) return setError('Please add your name.')
    if (phone.replace(/\D/g, '').length < 9) return setError('Please add the M-Pesa phone number.')
    if (!address.trim()) return setError('Please add where to deliver.')
    setError('')
    setStep('paying')
  }

  const reset = () => {
    setStep('form')
    setName('')
    setPhone('')
    setInstagram('')
    setCustomisation('')
    setAddress('')
    setQty(1)
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-4">
        <TeamPreviewBar back="#/orders">
          The page linked in her bios. Orders placed here appear as <em>Web Form</em>. Payment is simulated.
        </TeamPreviewBar>
      </div>

      <div className="overflow-hidden rounded-3xl border border-line bg-surface shadow-card">
        <div className="relative overflow-hidden bg-gradient-to-b from-pink-wash to-surface px-6 pb-8 pt-10 text-center">
          <Sparkles className="absolute left-5 top-6 w-14" />
          <Sparkles className="absolute bottom-6 right-5 w-12 -scale-x-100" />
          <Logo className="justify-center" />
          <Script className="mt-6 block text-5xl leading-none">Let’s create</Script>
          <p className="font-display text-3xl font-semibold text-green-ink">something beautiful together</p>
          <HeartDivider className="mx-auto mt-4 w-48" />
          <p className="mt-3 text-sm text-ink-2">Handmade flowers that never wilt. Order below and we’ll take it from here.</p>
          <a href="#/portal" className="mt-2 inline-block text-xs font-medium text-pink-ink hover:underline">
            Ordered before? Sign in with Google to track your orders
          </a>
        </div>

        <ul className="grid grid-cols-2 gap-y-4 border-y border-dashed border-line-strong px-4 py-5 text-center sm:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, detail }) => (
            <li key={title} className="flex flex-col items-center gap-1 px-2">
              <Icon size={26} strokeWidth={1.2} className="text-green-ink" aria-hidden />
              <span className="text-[11px] font-semibold tracking-[0.12em] text-ink">{title}</span>
              <span className="text-[11px] leading-snug text-muted">{detail}</span>
            </li>
          ))}
        </ul>

        {step === 'form' && (
          <div className="space-y-6 p-6">
            <fieldset>
              <legend className="eyebrow mb-3">1 · Choose your bouquet</legend>
              <div role="radiogroup" aria-label="Bouquet" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {state.products.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    role="radio"
                    aria-checked={productId === p.id}
                    onClick={() => setProductId(p.id)}
                    className={cx('rounded-2xl border p-3 text-left transition-colors', productId === p.id ? 'border-green bg-green-wash' : 'border-line-strong hover:bg-surface-2')}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold">{p.name}</span>
                      <span className="tabular text-sm">{formatKES(p.price)}</span>
                    </div>
                    <div className="mt-0.5 text-xs text-muted">{p.blurb}</div>
                  </button>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[120px_1fr]">
                <Field label="How many">
                  <input type="number" min={1} className={inputClass} value={qty} onChange={(e) => setQty(Math.max(1, Math.floor(Number(e.target.value) || 1)))} />
                </Field>
                <Field label="Make it yours" hint="Colours, card message, wrapping">
                  <input className={inputClass} value={customisation} onChange={(e) => setCustomisation(e.target.value)} placeholder="e.g. Blush ribbon, card: “Happy birthday Mum!”" />
                </Field>
              </div>
            </fieldset>

            <fieldset className="space-y-3">
              <legend className="eyebrow mb-3">2 · Your details</legend>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Your name">
                  <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
                </Field>
                <Field label="M-Pesa phone number">
                  <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07…" inputMode="tel" autoComplete="tel" />
                </Field>
              </div>
              <Field label="Instagram handle (optional)" hint="Helps us recognise you">
                <input className={inputClass} value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@" />
              </Field>
            </fieldset>

            <fieldset className="space-y-3">
              <legend className="eyebrow mb-3">3 · Delivery</legend>
              <div role="radiogroup" aria-label="Delivery" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
                    <div className="font-semibold">{title}</div>
                    <div className="text-xs text-muted">{detail}</div>
                  </button>
                ))}
              </div>
              <Field label="Delivery address">
                <input className={inputClass} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Estate / building, area, town" autoComplete="street-address" />
              </Field>
            </fieldset>

            <div className="rounded-2xl bg-surface-2 p-4 text-sm">
              <div className="flex justify-between">
                <span>
                  {product.name} × {qty}
                </span>
                <span className="tabular">{formatKES(product.price * qty)}</span>
              </div>
              <div className="flex justify-between text-ink-2">
                <span>Delivery</span>
                <span className="tabular">{deliveryFee ? formatKES(deliveryFee) : 'Free'}</span>
              </div>
              <div className="mt-2 flex justify-between border-t border-line pt-2 text-base font-semibold">
                <span>Total</span>
                <span className="tabular">{formatKES(total)}</span>
              </div>
            </div>
            {error && <p className="text-sm font-medium text-red-ink">{error}</p>}
            <Button variant="primary" className="!h-12 w-full !text-base" onClick={submit}>
              <Smartphone size={18} aria-hidden /> Pay {formatKES(total)} with M-Pesa
            </Button>
          </div>
        )}

        {step === 'paying' && (
          <div className="flex flex-col items-center gap-3 p-10 text-center">
            <Smartphone size={36} className="animate-pulse text-green" aria-hidden />
            <h2 className="font-display text-2xl font-semibold">Check your phone</h2>
            <p className="max-w-sm text-sm text-muted">
              We sent an M-Pesa prompt to {phone}. Enter your PIN to pay {formatKES(total)}.
            </p>
          </div>
        )}

        {step === 'done' && (
          <div className="flex flex-col items-center gap-3 p-10 text-center">
            <div className="relative">
              <BloomMark size={64} />
              <CircleCheck size={22} className="absolute -bottom-1 -right-1 rounded-full bg-surface text-green-ink" aria-hidden />
            </div>
            <h2 className="font-display text-3xl font-semibold">Thank you, {name.split(' ')[0]}!</h2>
            <p className="max-w-sm text-sm text-muted">
              Order <strong className="text-ink">{orderNumber}</strong> is paid and in the queue. We’ll message you when it ships.
            </p>
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              <a href="#/portal" className="inline-flex h-10 items-center rounded-full bg-green px-4 text-sm font-medium text-on-green">
                Track it with Google sign-in
              </a>
              <Button onClick={reset}>Place another</Button>
            </div>
          </div>
        )}
      </div>
      <ChatBubble />
    </div>
  )
}

/** The "Chat with us" button and pop-up that sits on the order form. */
function ChatBubble() {
  const [open, setOpen] = useState(false)
  const [thread] = useMyThread()
  const unseen = customerUnread(thread)
  return (
    <>
      {open && (
        <ChatWidget
          startedFrom="ORDER_FORM"
          onClose={() => setOpen(false)}
          className="fixed inset-x-3 bottom-3 top-16 z-50 sm:inset-x-auto sm:right-6 sm:top-auto sm:bottom-24 sm:h-[560px] sm:w-[380px]"
        />
      )}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`fixed bottom-6 right-6 z-50 h-14 ${open ? 'hidden sm:inline-flex' : 'inline-flex'} items-center gap-2 rounded-full bg-green px-5 font-medium text-on-green shadow-xl hover:opacity-95`}
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
