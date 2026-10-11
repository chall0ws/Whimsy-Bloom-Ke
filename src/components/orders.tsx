import { Ban, Camera, CircleCheck, Clock, CreditCard, Lock, MapPin, MessageCircle, Plus, Send, Trash2, Truck, Undo2, UserRound, X } from 'lucide-react'
import { useState } from 'react'
import { LIVE } from '../config'
import { deliveryProblem, DeliveryPicker, NO_DELIVERY, type DeliveryChoice } from './DeliveryPicker'
import { PhotoGrid } from './PhotoGrid'
import type { OrderDraft } from '../domain/actions'
import { COURIERS, forSale } from '../domain/catalog'
import { formatDate, formatDateTime, formatKES, relativeTime } from '../domain/format'
import {
  amountDue,
  amountPaid,
  deliveryLabel,
  MAX_READY_PHOTOS,
  readyPhotos,
  earnsServiceFee,
  FLOW_STATUSES,
  itemsSubtotal,
  nextUpOrder,
  orderSummary,
  orderTotal,
  PAYMENT_LABEL,
  paymentRecords,
  paymentStage,
  productName,
  refundAmountFor,
  sourceLabel,
  STATUS_LABEL,
} from '../domain/orders'
import type { AppState, Channel, Order, PaymentMethod, Thread } from '../domain/types'
import { readyMessage, whatsappLink, whatsappNumber } from '../domain/whatsapp'
import { uploadOrderPhoto } from '../lib/photo'
import { navigate } from '../router'
import { userName, useStore } from '../state/store'
import { Button, ChannelIcon, cx, EmptyState, Field, inputClass, Modal, Notice, StatusChip, useDialog } from './ui'

/** The Pending / Processing / Ready / Shipped toggle used in every order list. */
export function StatusControl({ order, size = 'md' }: { order: Order; size?: 'sm' | 'md' }) {
  const { dispatch } = useStore()
  const [shipping, setShipping] = useState(false)
  const [paying, setPaying] = useState(false)
  const ready = useDialog()
  const due = amountDue(order)

  if (order.status === 'CANCELLED' || order.status === 'REFUNDED') return <StatusChip status={order.status} />

  if (order.status === 'PENDING_PAYMENT') {
    return (
      <div className="flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
        <StatusChip status="PENDING_PAYMENT" />
        <Button size="sm" variant="secondary" onClick={() => setPaying(true)}>
          <CreditCard size={13} aria-hidden /> Deposit {formatKES(due)}
        </Button>
        <PaymentDialog order={order} open={paying} onClose={() => setPaying(false)} />
      </div>
    )
  }

  const shipped = order.status === 'SHIPPED'
  return (
    <div className="flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
      <div role="group" aria-label={`Status of ${order.number}`} className="inline-flex rounded-full border border-line bg-surface-2 p-0.5">
        {FLOW_STATUSES.map((s) => {
          const active = order.status === s
          // Shipping waits for the balance; nothing moves once shipped.
          const blocked = (shipped && !active) || (s === 'SHIPPED' && !active && (order.status !== 'READY' || due > 0))
          const why = shipped ? 'Shipped orders are final' : order.status !== 'READY' ? 'Mark it ready first' : `Waiting for the ${formatKES(due)} balance`
          return (
            <button
              key={s}
              type="button"
              aria-pressed={active}
              disabled={blocked}
              title={blocked ? why : s === 'READY' ? (active ? 'Change the delivery fee or photo' : 'Set the delivery fee and ask for the balance') : undefined}
              onClick={() => {
                // While the balance is unpaid, "Ready" reopens to fix the delivery fee or add a photo.
                if (active && s === 'READY' && due > 0) ready.show()
                if (active) return
                if (s === 'SHIPPED') setShipping(true)
                else if (s === 'READY') ready.show()
                else dispatch({ type: 'SET_STATUS', orderId: order.id, status: s })
              }}
              className={cx(
                'flex items-center gap-1 rounded-full font-semibold uppercase tracking-wide transition-colors whitespace-nowrap',
                size === 'sm' ? 'h-6 px-2 text-[10px]' : 'h-7 px-2.5 text-[11px]',
                active && s === 'PENDING' && 'bg-amber-wash text-amber-ink shadow-sm',
                active && s === 'PROCESSING' && 'bg-pink-wash text-pink-ink shadow-sm',
                active && s === 'READY' && 'bg-green-wash text-green-ink shadow-sm ring-1 ring-green/40',
                active && s === 'SHIPPED' && 'bg-green text-on-green shadow-sm',
                !active && 'text-muted hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-muted',
              )}
            >
              {active && shipped && <Lock size={10} aria-hidden />}
              {STATUS_LABEL[s]}
            </button>
          )
        })}
      </div>
      {order.status === 'READY' && due > 0 && (
        <Button size="sm" variant="secondary" onClick={() => setPaying(true)}>
          <CreditCard size={13} aria-hidden /> Balance {formatKES(due)}
        </Button>
      )}
      <ShipDialog order={order} open={shipping} onClose={() => setShipping(false)} />
      <ReadyDialog key={ready.key} order={order} open={ready.open} onClose={ready.hide} />
      <PaymentDialog order={order} open={paying} onClose={() => setPaying(false)} />
    </div>
  )
}

/** Where the customer sees and pays their order. Works on the device they ordered from, or signed in. */
function orderLink(order: Order): string {
  return `${window.location.origin}${window.location.pathname}#/thanks/${order.id}`
}

/** WhatsApp link with the "ready" message for this order and delivery fee, or null without a phone number. */
function readyWhatsApp(state: AppState, order: Order, deliveryFee: number, photoUrls = readyPhotos(order)): string | null {
  const customer = state.customers.find((c) => c.id === order.customerId)
  const phone = whatsappNumber(customer?.phone)
  if (!phone) return null
  const paid = amountPaid(order)
  const text = readyMessage({
    firstName: customer?.name.split(' ')[0] ?? 'there',
    number: order.number,
    summary: orderSummary(state, order),
    delivery: deliveryLabel(order.fulfilment),
    remaining: Math.max(0, itemsSubtotal(order) - paid),
    deliveryFee,
    balance: Math.max(0, itemsSubtotal(order) + deliveryFee - paid),
    payUrl: orderLink(order),
    // Only stored photos have links to share (the demo keeps photos inline).
    photoUrls: photoUrls.filter((url) => url.startsWith('https://')),
  })
  return whatsappLink(phone, text)
}

/**
 * "Order ready": asks for the delivery fee, shows the balance (remaining 50% + delivery),
 * then opens WhatsApp with the message to the customer, ready to send.
 */
function ReadyDialog({ order, open, onClose }: { order: Order; open: boolean; onClose: () => void }) {
  const { state, dispatch, toast } = useStore()
  const customer = state.customers.find((c) => c.id === order.customerId)
  const phone = whatsappNumber(customer?.phone)
  const suggested = order.status === 'READY' ? order.fulfilment.deliveryFee : order.fulfilment.method === 'SHIPPING' ? state.settings.defaultShippingFee : undefined
  const [fee, setFee] = useState(suggested === undefined ? '' : String(suggested))
  const [sendWhatsApp, setSendWhatsApp] = useState(Boolean(phone))
  const [photos, setPhotos] = useState<string[]>(readyPhotos(order))
  const [uploading, setUploading] = useState(0)
  const deliveryFee = fee.trim() === '' ? NaN : Number(fee)
  const valid = Number.isInteger(deliveryFee) && deliveryFee >= 0
  const paid = amountPaid(order)
  const balance = valid ? Math.max(0, itemsSubtotal(order) + deliveryFee - paid) : 0

  // Photos upload as soon as they're chosen, so "Mark ready" can open WhatsApp straight away.
  const choosePhotos = async (files: File[]) => {
    const room = MAX_READY_PHOTOS - photos.length - uploading
    if (files.length > room) toast(`Up to ${MAX_READY_PHOTOS} photos per order.`, 'error')
    const chosen = files.slice(0, Math.max(0, room))
    if (chosen.length === 0) return
    setUploading((n) => n + chosen.length)
    for (const file of chosen) {
      const result = await uploadOrderPhoto(order.id, file)
      setUploading((n) => n - 1)
      if (result.ok) setPhotos((list) => [...list, result.url])
      else toast(result.error, 'error')
    }
  }

  const confirm = async () => {
    if (!valid) return toast('Enter the delivery fee in KES (0 if it’s free).', 'error')
    // Open WhatsApp straight from the tap, so the browser doesn't block it as a pop-up.
    const link = sendWhatsApp ? readyWhatsApp(state, order, deliveryFee, photos) : null
    if (link) window.open(link, '_blank', 'noopener')
    const r = await dispatch({ type: 'ORDER_READY', orderId: order.id, deliveryFee, photoUrls: photos })
    if (r.ok) onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${order.number} is ready?`}
      subtitle={`${orderSummary(state, order)} · ${deliveryLabel(order.fulfilment)}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Not yet
          </Button>
          <Button variant="primary" onClick={confirm} disabled={!valid || uploading > 0}>
            <CircleCheck size={15} aria-hidden /> {sendWhatsApp && phone ? 'Mark ready & message on WhatsApp' : 'Mark ready'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Delivery fee (KES)" hint={`${deliveryLabel(order.fulfilment)} · ${order.fulfilment.address}. Enter 0 if delivery is free.`}>
          <input
            id="ready-delivery-fee"
            type="number"
            min={0}
            step={50}
            inputMode="numeric"
            className={inputClass}
            value={fee}
            onChange={(e) => setFee(e.target.value)}
            placeholder={`e.g. ${state.settings.defaultShippingFee}`}
            autoFocus
          />
        </Field>
        <div>
          <div className="mb-1 text-xs font-semibold text-ink-2">Photos of the finished bouquet (optional, up to {MAX_READY_PHOTOS})</div>
          <div className="flex flex-wrap items-center gap-2">
            {photos.map((url, i) => (
              <div key={url} className="relative">
                <img src={url} alt={`Finished bouquet, photo ${i + 1}`} className="h-20 w-16 rounded-lg border border-line object-cover" />
                <button
                  type="button"
                  onClick={() => setPhotos((list) => list.filter((u) => u !== url))}
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-line bg-surface text-ink-2 shadow-sm hover:text-red-ink"
                  aria-label={`Remove photo ${i + 1}`}
                >
                  <X size={12} aria-hidden />
                </button>
              </div>
            ))}
            {Array.from({ length: uploading }, (_, i) => (
              <div key={`up-${i}`} className="h-20 w-16 animate-pulse rounded-lg border border-line bg-surface-2" aria-hidden />
            ))}
            {photos.length + uploading < MAX_READY_PHOTOS && (
              <label className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-full border border-line-strong bg-surface px-4 text-sm font-medium hover:bg-surface-2">
                <Camera size={15} aria-hidden /> {photos.length || uploading ? 'Add more' : 'Add photos'}
                <input
                  id="ready-photo"
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp,image/*"
                  className="sr-only"
                  onChange={(e) => {
                    choosePhotos(Array.from(e.target.files ?? []))
                    e.target.value = ''
                  }}
                />
              </label>
            )}
          </div>
          <p className="mt-1 text-xs text-muted">
            {uploading ? 'Uploading… ' : ''}The customer sees them on their order page and in the chat{phone ? ', and the WhatsApp message links to them' : ''}.
          </p>
        </div>
        <section className="rounded-xl border border-line text-sm">
          <div className="flex justify-between border-b border-line px-4 py-2">
            <span>Bouquets</span>
            <span className="tabular">{formatKES(itemsSubtotal(order))}</span>
          </div>
          <div className="flex justify-between border-b border-line px-4 py-2 text-ink-2">
            <span>Paid so far</span>
            <span className="tabular">− {formatKES(paid)}</span>
          </div>
          <div className="flex justify-between border-b border-line px-4 py-2 text-ink-2">
            <span>Delivery</span>
            <span className="tabular">{valid ? formatKES(deliveryFee) : '—'}</span>
          </div>
          <div className="flex justify-between px-4 py-2 font-semibold">
            <span>Balance to pay</span>
            <span className="tabular">{valid ? formatKES(balance) : '—'}</span>
          </div>
        </section>
        {phone ? (
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={sendWhatsApp} onChange={(e) => setSendWhatsApp(e.target.checked)} />
            <span>
              Message {customer?.name} on WhatsApp ({customer?.phone}). WhatsApp opens with the message written, including the payment link; just tap Send.
            </span>
          </label>
        ) : (
          <Notice tone="warn">No phone number on file for this customer, so no WhatsApp message. {order.threadId ? 'They’ll see it in the chat.' : ''}</Notice>
        )}
        <p className="text-xs text-muted">
          {order.threadId ? 'The customer also gets the balance and a Pay button in the site chat. ' : ''}A Pay balance button appears on their order page.
        </p>
      </div>
    </Modal>
  )
}

function ShipDialog({ order, open, onClose }: { order: Order; open: boolean; onClose: () => void }) {
  const { state, dispatch } = useStore()
  const [courier, setCourier] = useState(order.fulfilment.courier ?? order.fulfilment.busService ?? '')
  const [tracking, setTracking] = useState('')
  const hand = order.fulfilment.method === 'HAND_DELIVERY'
  const charges = earnsServiceFee(order, state.settings) && state.settings.serviceFee > 0

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Ship ${order.number}?`}
      subtitle={orderSummary(state, order)}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Not yet
          </Button>
          <Button
            variant="primary"
            onClick={async () => {
              const r = await dispatch({ type: 'SET_STATUS', orderId: order.id, status: 'SHIPPED', courier: hand ? undefined : courier.trim() || undefined, trackingNumber: hand ? undefined : tracking })
              if (r.ok) onClose()
            }}
          >
            <Truck size={15} aria-hidden /> Mark as shipped
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {hand ? (
          <p className="text-sm text-ink-2">
            {order.fulfilment.option === 'PICKUP_MTAANI' ? (
              <>
                Send it with Pickup Mtaani to the agent: <strong>{order.fulfilment.address}</strong>.
              </>
            ) : (
              <>
                Rider delivery within Nairobi to <strong>{order.fulfilment.address}</strong>.
              </>
            )}
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={order.fulfilment.method === 'SHIPPING' ? 'Sent with' : 'Courier'} hint={order.fulfilment.busService ? `The customer asked for ${order.fulfilment.busService}.` : undefined}>
              <input id="ship-courier" list="ship-couriers" className={inputClass} value={courier} onChange={(e) => setCourier(e.target.value)} placeholder="e.g. Easy Coach" />
              <datalist id="ship-couriers">
                {COURIERS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>
            <Field label="Parcel / tracking number" hint="Optional, sent to the customer">
              <input className={inputClass} value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="e.g. EC-482913" />
            </Field>
            <p className="text-sm text-ink-2 sm:col-span-2">
              To: <strong>{order.fulfilment.address}</strong>
            </p>
          </div>
        )}
        <Notice tone="warn">
          Shipping is final. {charges ? <>A <strong>{formatKES(state.settings.serviceFee)}</strong> service fee is added to the partner balance. </> : null}
          Service and delivery fees are non-refundable.
        </Notice>
        <p className="text-sm text-muted">
          {order.threadId ? 'The customer gets a shipping confirmation in their live chat.' : 'The customer gets a shipping confirmation by SMS and email.'}
        </p>
      </div>
    </Modal>
  )
}

/** Sends the payment link, or records a payment made outside Paystack, for whatever is due now. */
function PaymentDialog({ order, open, onClose }: { order: Order; open: boolean; onClose: () => void }) {
  const { dispatch } = useStore()
  const [method, setMethod] = useState<PaymentMethod>('MPESA')
  const [reference, setReference] = useState('')
  const stage = paymentStage(order)
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${stage === 'BALANCE' ? 'Balance' : 'Deposit'} for ${order.number}`}
      subtitle={`${formatKES(amountDue(order))} due${stage === 'BALANCE' ? ' (remaining 50% + delivery)' : ' (50% of the bouquets)'}`}
      footer={
        <>
          <Button
            variant="ghost"
            onClick={() => {
              dispatch({ type: 'SEND_PAYMENT_LINK', orderId: order.id })
              onClose()
            }}
          >
            <Send size={14} aria-hidden /> {order.payment.linkSentAt ? 'Resend link' : 'Send payment link'}
          </Button>
          <Button
            variant="primary"
            onClick={async () => {
              const r = await dispatch({ type: 'CONFIRM_PAYMENT', orderId: order.id, method, reference })
              if (r.ok) onClose()
            }}
          >
            Confirm payment
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {order.payment.linkSentAt && (
          <p className="flex items-center gap-1.5 text-sm text-muted">
            <Clock size={14} aria-hidden /> Payment link sent {relativeTime(order.payment.linkSentAt)} ago
          </p>
        )}
        <Field label="Paid with">
          <select className={inputClass} value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            <option value="MPESA">M-Pesa</option>
            <option value="CARD">Card</option>
          </select>
        </Field>
        <Field label={method === 'MPESA' ? 'M-Pesa confirmation code' : 'Card payment reference'}>
          <input className={inputClass} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. SJK7H2L9QX" autoFocus />
        </Field>
        <p className="text-xs text-muted">{LIVE ? 'Paystack payments are confirmed automatically. Use this for cash or an M-Pesa payment made straight to her number.' : 'Once live, Paystack payments are confirmed automatically.'}</p>
      </div>
    </Modal>
  )
}

export function OrderTable({ orders, compact, emptyText = 'No orders here yet.' }: { orders: Order[]; compact?: boolean; emptyText?: string }) {
  const { state, openOrder } = useStore()
  const next = nextUpOrder(state.orders)
  if (orders.length === 0) return <EmptyState>{emptyText}</EmptyState>
  return (
    <>
      <div className="hidden md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left">
              <th className="eyebrow pb-2 pr-3 font-semibold">Order #</th>
              <th className="eyebrow pb-2 pr-3 font-semibold">Source</th>
              <th className="eyebrow pb-2 pr-3 font-semibold">Product</th>
              {!compact && <th className="eyebrow pb-2 pr-3 text-right font-semibold">Total</th>}
              <th className="eyebrow pb-2 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} onClick={() => openOrder(o.id)} className="cursor-pointer border-t border-line hover:bg-surface-2/60">
                <td className="py-2.5 pr-3 align-middle">
                  <button type="button" onClick={() => openOrder(o.id)} className="font-semibold text-ink hover:underline">
                    {o.number}
                  </button>
                  <div className="text-xs text-muted">{relativeTime(o.createdAt)}</div>
                </td>
                <td className="py-2.5 pr-3 align-middle">
                  <span className="inline-flex items-center gap-1.5 text-ink-2">
                    <ChannelIcon channel={o.channel} />
                    <span className="max-w-[150px] truncate">{sourceLabel(state, o)}</span>
                  </span>
                </td>
                <td className="py-2.5 pr-3 align-middle">
                  <div className="max-w-[220px] truncate">{orderSummary(state, o)}</div>
                  {o.id === next?.id && <span className="text-[11px] font-semibold text-pink-ink">● Next up — oldest pending</span>}
                </td>
                {!compact && <td className="tabular py-2.5 pr-3 text-right align-middle">{formatKES(orderTotal(o))}</td>}
                <td className="py-2.5 align-middle">
                  <StatusControl order={o} size={compact ? 'sm' : 'md'} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="flex flex-col gap-2 md:hidden">
        {orders.map((o) => (
          <li key={o.id} onClick={() => openOrder(o.id)} className="cursor-pointer rounded-xl border border-line p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-semibold">
                  {o.number} <span className="font-normal text-muted">· {relativeTime(o.createdAt)}</span>
                </div>
                <div className="truncate text-sm">{orderSummary(state, o)}</div>
                <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                  <ChannelIcon channel={o.channel} size={12} />
                  {sourceLabel(state, o)}
                </div>
                {o.id === next?.id && <div className="text-[11px] font-semibold text-pink-ink">● Next up — oldest pending</div>}
              </div>
              <div className="tabular text-sm font-medium">{formatKES(orderTotal(o))}</div>
            </div>
            <div className="mt-2.5">
              <StatusControl order={o} size="sm" />
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}

/** Side panel with everything about one order. Opened from any order list. */
export function OrderDrawer() {
  const { state, openOrderId, openOrder, dispatch } = useStore()
  const order = state.orders.find((o) => o.id === openOrderId)
  const [confirm, setConfirm] = useState<'cancel' | 'refund' | null>(null)
  if (!order) return null
  const customer = state.customers.find((c) => c.id === order.customerId)
  const fee = state.fees.find((f) => f.orderId === order.id)
  const close = () => openOrder(null)
  // The delivery fee is set when the order is marked ready (older orders had it from the start).
  const feeSet = Boolean(order.readyAt) || order.fulfilment.deliveryFee > 0 || order.status === 'SHIPPED'

  return (
    <Modal
      open
      variant="drawer"
      onClose={close}
      title={order.number}
      subtitle={`Placed ${formatDateTime(order.createdAt)} · ${sourceLabel(state, order)}`}
      footer={
        <>
          {['PENDING_PAYMENT', 'PENDING', 'PROCESSING', 'READY'].includes(order.status) && (
            <Button variant="danger" onClick={() => setConfirm('cancel')}>
              <Ban size={14} aria-hidden /> Cancel order
            </Button>
          )}
          {order.status === 'SHIPPED' && (
            <Button variant="danger" onClick={() => setConfirm('refund')}>
              <Undo2 size={14} aria-hidden /> Refund
            </Button>
          )}
          {order.status === 'READY' && amountDue(order) > 0 && readyWhatsApp(state, order, order.fulfilment.deliveryFee) && (
            <a
              href={readyWhatsApp(state, order, order.fulfilment.deliveryFee)!}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line-strong bg-surface px-4 text-sm font-medium hover:bg-surface-2"
            >
              <Send size={14} aria-hidden /> Remind on WhatsApp
            </a>
          )}
          {order.threadId && (
            <Button
              onClick={() => {
                close()
                navigate({ page: 'inbox', threadId: order.threadId })
              }}
            >
              <MessageCircle size={14} aria-hidden /> Open chat
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <div className="eyebrow mb-2">Status</div>
          <StatusControl order={order} />
        </div>

        <section className="rounded-xl border border-line">
          {order.items.map((item, i) => (
            <div key={i} className="flex justify-between gap-3 border-b border-line px-4 py-2.5 text-sm last:border-0">
              <span>
                {productName(state, item.productId)} <span className="text-muted">× {item.qty}</span>
              </span>
              <span className="tabular">{formatKES(item.qty * item.unitPrice)}</span>
            </div>
          ))}
          <div className="flex justify-between border-b border-line px-4 py-2.5 text-sm text-ink-2">
            <span>Delivery · {deliveryLabel(order.fulfilment)}</span>
            <span className="tabular">{feeSet ? formatKES(order.fulfilment.deliveryFee) : 'Set when ready'}</span>
          </div>
          <div className="flex justify-between border-b border-line px-4 py-2.5 text-sm font-semibold">
            <span>Total</span>
            <span className="tabular">{formatKES(orderTotal(order))}</span>
          </div>
          {paymentRecords(order).map((p, i) => (
            <div key={i} className="flex justify-between border-b border-line px-4 py-2 text-sm text-ink-2">
              <span>
                {p.kind === 'DEPOSIT' ? 'Deposit' : p.kind === 'BALANCE' ? 'Balance' : 'Paid'} · {p.method === 'CARD' ? 'Card' : 'M-Pesa'} <span className="tabular text-muted">{p.reference}</span>
              </span>
              <span className="tabular">− {formatKES(p.amount)}</span>
            </div>
          ))}
          <div className="flex justify-between px-4 py-2.5 text-sm font-semibold">
            <span>{amountDue(order) > 0 ? (paymentStage(order) === 'DEPOSIT' ? 'Deposit due now' : 'Balance due now') : 'Still to pay'}</span>
            <span className="tabular">{formatKES(amountDue(order) > 0 ? amountDue(order) : Math.max(0, orderTotal(order) - amountPaid(order)))}</span>
          </div>
        </section>

        {readyPhotos(order).length > 0 && (
          <div>
            <div className="eyebrow mb-1">Ready photos</div>
            <PhotoGrid urls={readyPhotos(order)} alt={`${order.number} finished`} className="max-w-sm overflow-hidden rounded-xl border border-line" imgClassName="max-h-72" />
          </div>
        )}

        {order.customisation && (
          <div>
            <div className="eyebrow mb-1">Customisation</div>
            <p className="rounded-xl bg-pink-wash px-3 py-2 text-sm text-ink">{order.customisation}</p>
          </div>
        )}

        <dl className="grid gap-x-4 gap-y-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="eyebrow mb-0.5">Customer</dt>
            <dd>
              {customer ? (
                <a href={`#/admin/customers/${customer.id}`} onClick={close} className="inline-flex items-center gap-1 font-medium hover:underline">
                  <UserRound size={14} aria-hidden /> {customer.name}
                </a>
              ) : (
                '—'
              )}
              {customer?.phone && <div className="text-muted">{customer.phone}</div>}
            </dd>
          </div>
          <div>
            <dt className="eyebrow mb-0.5">Deliver to</dt>
            <dd className="flex items-start gap-1">
              <MapPin size={14} className="mt-0.5 shrink-0 text-muted" aria-hidden /> {order.fulfilment.address}
            </dd>
            <dd className="text-muted">{deliveryLabel(order.fulfilment)}</dd>
            {(order.fulfilment.courier || order.fulfilment.trackingNumber) && (
              <dd className="text-muted">{[order.fulfilment.courier, order.fulfilment.trackingNumber].filter(Boolean).join(' · ')}</dd>
            )}
          </div>
          <div>
            <dt className="eyebrow mb-0.5">Payment</dt>
            <dd>
              {PAYMENT_LABEL[order.payment.status]}
              {order.payment.refundedAmount ? <div className="text-red-ink">Refunded {formatKES(order.payment.refundedAmount)}</div> : null}
            </dd>
          </div>
          <div>
            <dt className="eyebrow mb-0.5">Service fee</dt>
            <dd>{fee ? `${formatKES(fee.amount)} charged ${formatDate(fee.at)}` : order.status === 'CANCELLED' ? 'None (cancelled)' : 'Charged when shipped'}</dd>
          </div>
        </dl>

        <div>
          <div className="eyebrow mb-2">History</div>
          <ol className="space-y-2 border-l border-line pl-4">
            {[...order.history].reverse().map((h, i) => (
              <li key={i} className="relative text-sm">
                <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-taupe" aria-hidden />
                <span className="font-medium">{h.note ?? STATUS_LABEL[h.status]}</span>
                <span className="text-muted">
                  {' '}
                  · {formatDateTime(h.at)} · {userName(state, h.by)}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <Modal
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm === 'refund' ? `Refund ${order.number}?` : `Cancel ${order.number}?`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Keep order
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                const r = await dispatch(confirm === 'refund' ? { type: 'REFUND_ORDER', orderId: order.id } : { type: 'SET_STATUS', orderId: order.id, status: 'CANCELLED' })
                if (r.ok) setConfirm(null)
              }}
            >
              {confirm === 'refund' ? 'Refund' : 'Cancel order'}
            </Button>
          </>
        }
      >
        {confirm === 'refund' ? (
          <p className="text-sm text-ink-2">
            The customer gets <strong>{formatKES(refundAmountFor(order))}</strong> back for the bouquets. The {formatKES(order.fulfilment.deliveryFee)} delivery fee
            and the service fee are non-refundable.
          </p>
        ) : (
          <p className="text-sm text-ink-2">
            {amountPaid(order) === 0 && 'Nothing has been paid yet. '}
            {amountPaid(order) - refundAmountFor(order) > 0 && (
              <>
                The <strong>{formatKES(amountPaid(order) - refundAmountFor(order))}</strong> deposit is kept (non-refundable).{' '}
              </>
            )}
            {refundAmountFor(order) > 0 && (
              <>
                Refund <strong>{formatKES(refundAmountFor(order))}</strong> to the customer.{' '}
              </>
            )}
            No service fee is charged. {order.materialsDeducted && 'Materials already used stay used.'}
          </p>
        )}
      </Modal>
    </Modal>
  )
}

/** Turns a live chat (or a phone call) into an official order. */
export function CreateOrderDialog({ open, onClose, thread }: { open: boolean; onClose: () => void; thread?: Thread }) {
  const { state, dispatch, openOrder, toast } = useStore()
  const customer = thread ? state.customers.find((c) => c.id === thread.customerId) : undefined
  const lastCustomerText = thread?.messages.filter((m) => m.from === 'CUSTOMER').at(-1)?.text ?? ''

  const [channel, setChannel] = useState<Channel>(thread ? 'LIVE_CHAT' : 'MANUAL')
  const [name, setName] = useState(customer?.name ?? '')
  const [phone, setPhone] = useState(customer?.phone ?? '')
  const [items, setItems] = useState([{ productId: forSale(state.products)[0].id, qty: 1 }])
  const [customisation, setCustomisation] = useState('')
  const [delivery, setDelivery] = useState<DeliveryChoice>({ ...NO_DELIVERY, address: customer?.address ?? '' })
  const [showErrors, setShowErrors] = useState(false)
  const [payKind, setPayKind] = useState<'SEND_LINK' | 'PAID' | 'UNPAID'>('SEND_LINK')
  const [payMethod, setPayMethod] = useState<PaymentMethod>('MPESA')
  const [reference, setReference] = useState('')

  const subtotal = items.reduce((s, i) => s + i.qty * (state.products.find((p) => p.id === i.productId)?.price ?? 0), 0)
  const deposit = Math.ceil(subtotal / 2)

  const submit = async () => {
    const problem = deliveryProblem(delivery)
    if (problem || !delivery.method) {
      setShowErrors(true)
      return toast(problem, 'error')
    }
    const draft: OrderDraft = {
      customerId: customer?.id,
      customerName: name,
      phone,
      channel,
      threadId: thread?.id,
      items,
      customisation,
      method: delivery.method,
      deliveryOption: delivery.method === 'HAND_DELIVERY' ? (delivery.option ?? undefined) : undefined,
      busService: delivery.method === 'SHIPPING' ? delivery.busService : undefined,
      address: delivery.address,
      payment: payKind === 'PAID' ? { kind: 'PAID', method: payMethod, reference } : { kind: payKind },
    }
    const r = await dispatch({ type: 'CREATE_ORDER', draft })
    if (r.ok) {
      onClose()
      if (!thread && r.createdOrderId) openOrder(r.createdOrderId)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={thread ? 'Create order from chat' : 'New order'}
      subtitle={thread ? `From the live chat with ${customer?.name ?? 'this customer'}` : 'For orders taken by phone or in person'}
      footer={
        <>
          <div className="mr-auto self-center text-sm">
            Deposit <strong className="tabular">{formatKES(deposit)}</strong> of {formatKES(subtotal)}
          </div>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit}>
            {payKind === 'SEND_LINK' ? 'Create & send deposit link' : 'Create order'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {thread && lastCustomerText && (
          <div className="rounded-xl bg-surface-2 px-3 py-2 text-sm">
            <div className="eyebrow mb-1">Latest message</div>
            <p className="text-ink-2">“{lastCustomerText}”</p>
          </div>
        )}

        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="eyebrow mb-2">Customer</legend>
          <Field label="Name">
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Customer name" />
          </Field>
          <Field label="Phone (for M-Pesa)">
            <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+254 7…" inputMode="tel" />
          </Field>
          {!thread && (
            <Field label="Came in via">
              <select className={inputClass} value={channel} onChange={(e) => setChannel(e.target.value as Channel)}>
                <option value="MANUAL">Phone / in person</option>
                <option value="WEB_FORM">Web form</option>
              </select>
            </Field>
          )}
        </fieldset>

        <fieldset>
          <legend className="eyebrow mb-2">Bouquets</legend>
          <div className="space-y-2">
            {items.map((item, i) => (
              <div key={i} className="flex gap-2">
                <select
                  className={inputClass}
                  value={item.productId}
                  aria-label="Product"
                  onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, productId: e.target.value } : x)))}
                >
                  {forSale(state.products).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {formatKES(p.price)}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  className={cx(inputClass, '!w-20')}
                  value={item.qty}
                  aria-label="Quantity"
                  onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, qty: Math.max(1, Math.floor(Number(e.target.value) || 1)) } : x)))}
                />
                {items.length > 1 && (
                  <button type="button" onClick={() => setItems(items.filter((_, j) => j !== i))} className="rounded-full p-2 text-muted hover:bg-surface-2" aria-label="Remove">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
            <Button size="sm" variant="ghost" onClick={() => setItems([...items, { productId: forSale(state.products)[0].id, qty: 1 }])}>
              <Plus size={14} aria-hidden /> Add another bouquet
            </Button>
          </div>
          <Field label="Customisation" className="mt-3">
            <textarea className={inputClass} rows={2} value={customisation} onChange={(e) => setCustomisation(e.target.value)} placeholder="Colours, card message, wrapping…" />
          </Field>
          {thread && lastCustomerText && (
            <button type="button" className="mt-1 text-xs font-medium text-pink-ink hover:underline" onClick={() => setCustomisation((c) => (c ? `${c}\n` : '') + lastCustomerText)}>
              Copy the latest message in
            </button>
          )}
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="eyebrow mb-2">Delivery</legend>
          <DeliveryPicker value={delivery} onChange={setDelivery} showErrors={showErrors} idPrefix="new-order" />
          <p className="text-xs text-muted">The delivery fee is set when the order is ready.</p>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="eyebrow mb-2">Payment</legend>
          <div role="radiogroup" aria-label="Payment" className="grid gap-2 sm:grid-cols-3">
            <Choice checked={payKind === 'SEND_LINK'} onSelect={() => setPayKind('SEND_LINK')} title="Send deposit link" detail="M-Pesa or card" />
            <Choice checked={payKind === 'PAID'} onSelect={() => setPayKind('PAID')} title="Deposit paid" detail="Enter the code" />
            <Choice checked={payKind === 'UNPAID'} onSelect={() => setPayKind('UNPAID')} title="Collect later" detail="Waits for the deposit" />
          </div>
          {payKind === 'PAID' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Paid with">
                <select className={inputClass} value={payMethod} onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}>
                  <option value="MPESA">M-Pesa</option>
                  <option value="CARD">Card</option>
                </select>
              </Field>
              <Field label="Confirmation code">
                <input className={inputClass} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. SJK7H2L9QX" />
              </Field>
            </div>
          )}
        </fieldset>
        <div className="text-sm text-muted">
          50% deposit now: <strong className="text-ink">{formatKES(deposit)}</strong>. The other {formatKES(subtotal - deposit)} plus delivery is due when it’s ready.
        </div>
      </div>
    </Modal>
  )
}

function Choice({ checked, onSelect, title, detail }: { checked: boolean; onSelect: () => void; title: string; detail: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      className={cx('rounded-xl border px-3 py-2.5 text-left transition-colors', checked ? 'border-green bg-green-wash' : 'border-line-strong hover:bg-surface-2')}
    >
      <div className="text-sm font-semibold">{title}</div>
      <div className="text-xs text-muted">{detail}</div>
    </button>
  )
}
