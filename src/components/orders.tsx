import { Ban, Clock, CreditCard, Lock, MapPin, MessageCircle, Plus, Send, Trash2, Truck, Undo2, UserRound } from 'lucide-react'
import { useState } from 'react'
import type { OrderDraft } from '../domain/actions'
import { COURIERS } from '../domain/catalog'
import { formatDate, formatDateTime, formatKES, relativeTime } from '../domain/format'
import {
  earnsServiceFee,
  FLOW_STATUSES,
  nextUpOrder,
  orderSummary,
  orderTotal,
  productName,
  refundAmountFor,
  sourceLabel,
  STATUS_LABEL,
} from '../domain/orders'
import type { Channel, FulfilmentMethod, Order, PaymentMethod, Thread } from '../domain/types'
import { navigate } from '../router'
import { userName, useStore } from '../state/store'
import { Button, ChannelIcon, cx, EmptyState, Field, inputClass, Modal, Notice, StatusChip } from './ui'

/** The PENDING / PROCESSING / SHIPPED toggle used in every order list. */
export function StatusControl({ order, size = 'md' }: { order: Order; size?: 'sm' | 'md' }) {
  const { dispatch } = useStore()
  const [shipping, setShipping] = useState(false)
  const [paying, setPaying] = useState(false)

  if (order.status === 'CANCELLED' || order.status === 'REFUNDED') return <StatusChip status={order.status} />

  if (order.status === 'PENDING_PAYMENT') {
    return (
      <div className="flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
        <StatusChip status="PENDING_PAYMENT" />
        <Button size="sm" variant="secondary" onClick={() => setPaying(true)}>
          <CreditCard size={13} aria-hidden /> Mark paid
        </Button>
        <PaymentDialog order={order} open={paying} onClose={() => setPaying(false)} />
      </div>
    )
  }

  const shipped = order.status === 'SHIPPED'
  return (
    <div onClick={(e) => e.stopPropagation()}>
      <div role="group" aria-label={`Status of ${order.number}`} className="inline-flex rounded-full border border-line bg-surface-2 p-0.5">
        {FLOW_STATUSES.map((s) => {
          const active = order.status === s
          return (
            <button
              key={s}
              type="button"
              aria-pressed={active}
              disabled={shipped && !active}
              title={shipped && !active ? 'Shipped orders are final' : undefined}
              onClick={() => {
                if (active) return
                if (s === 'SHIPPED') setShipping(true)
                else dispatch({ type: 'SET_STATUS', orderId: order.id, status: s })
              }}
              className={cx(
                'flex items-center gap-1 rounded-full font-semibold uppercase tracking-wide transition-colors whitespace-nowrap',
                size === 'sm' ? 'h-6 px-2 text-[10px]' : 'h-7 px-2.5 text-[11px]',
                active && s === 'PENDING' && 'bg-amber-wash text-amber-ink shadow-sm',
                active && s === 'PROCESSING' && 'bg-pink-wash text-pink-ink shadow-sm',
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
      <ShipDialog order={order} open={shipping} onClose={() => setShipping(false)} />
    </div>
  )
}

function ShipDialog({ order, open, onClose }: { order: Order; open: boolean; onClose: () => void }) {
  const { state, dispatch } = useStore()
  const [courier, setCourier] = useState(order.fulfilment.courier ?? COURIERS[0])
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
            onClick={() => {
              const r = dispatch({ type: 'SET_STATUS', orderId: order.id, status: 'SHIPPED', courier: hand ? undefined : courier, trackingNumber: hand ? undefined : tracking })
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
            Hand delivery to <strong>{order.fulfilment.address}</strong>. No delivery charge.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Courier">
              <select className={inputClass} value={courier} onChange={(e) => setCourier(e.target.value)}>
                {COURIERS.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Tracking number" hint="Optional, sent to the customer">
              <input className={inputClass} value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="e.g. G4S-482913" />
            </Field>
          </div>
        )}
        <Notice tone="warn">
          Shipping is final. {charges ? <>A <strong>{formatKES(state.settings.serviceFee)}</strong> service fee is added to the partner balance. </> : null}
          Service and delivery fees are non-refundable.
        </Notice>
        <p className="text-sm text-muted">
          {order.threadId ? 'The customer gets a shipping confirmation in their DMs.' : 'The customer gets a shipping confirmation by SMS and email.'}
        </p>
      </div>
    </Modal>
  )
}

function PaymentDialog({ order, open, onClose }: { order: Order; open: boolean; onClose: () => void }) {
  const { dispatch } = useStore()
  const [method, setMethod] = useState<PaymentMethod>('MPESA')
  const [reference, setReference] = useState('')
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Payment for ${order.number}`}
      subtitle={`${formatKES(orderTotal(order))} due`}
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
            onClick={() => {
              const r = dispatch({ type: 'CONFIRM_PAYMENT', orderId: order.id, method, reference })
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
        <p className="text-xs text-muted">In Stage B this happens automatically when the payment provider confirms the payment.</p>
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
                    <span className="max-w-[150px] truncate">{sourceLabel(o)}</span>
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
                  {sourceLabel(o)}
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

  return (
    <Modal
      open
      variant="drawer"
      onClose={close}
      title={order.number}
      subtitle={`Placed ${formatDateTime(order.createdAt)} · ${sourceLabel(order)}`}
      footer={
        <>
          {['PENDING_PAYMENT', 'PENDING', 'PROCESSING'].includes(order.status) && (
            <Button variant="danger" onClick={() => setConfirm('cancel')}>
              <Ban size={14} aria-hidden /> Cancel order
            </Button>
          )}
          {order.status === 'SHIPPED' && (
            <Button variant="danger" onClick={() => setConfirm('refund')}>
              <Undo2 size={14} aria-hidden /> Refund
            </Button>
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
            <span>{order.fulfilment.method === 'HAND_DELIVERY' ? 'Hand delivery' : 'Courier delivery'}</span>
            <span className="tabular">{order.fulfilment.deliveryFee ? formatKES(order.fulfilment.deliveryFee) : 'Free'}</span>
          </div>
          <div className="flex justify-between px-4 py-2.5 text-sm font-semibold">
            <span>Total</span>
            <span className="tabular">{formatKES(orderTotal(order))}</span>
          </div>
        </section>

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
                <a href={`#/customers/${customer.id}`} onClick={close} className="inline-flex items-center gap-1 font-medium hover:underline">
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
            {order.fulfilment.trackingNumber && (
              <dd className="text-muted">
                {order.fulfilment.courier} · {order.fulfilment.trackingNumber}
              </dd>
            )}
          </div>
          <div>
            <dt className="eyebrow mb-0.5">Payment</dt>
            <dd>
              {order.payment.status === 'UNPAID' && 'Not paid yet'}
              {order.payment.status !== 'UNPAID' && (
                <>
                  {order.payment.method === 'CARD' ? 'Card' : 'M-Pesa'} · <span className="tabular">{order.payment.reference}</span>
                </>
              )}
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
              onClick={() => {
                const r = dispatch(confirm === 'refund' ? { type: 'REFUND_ORDER', orderId: order.id } : { type: 'SET_STATUS', orderId: order.id, status: 'CANCELLED' })
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
            {order.payment.status === 'PAID' ? <>The customer gets the full <strong>{formatKES(orderTotal(order))}</strong> back. </> : 'Nothing has been paid yet. '}
            No service fee is charged. {order.materialsDeducted && 'Materials already used stay used.'}
          </p>
        )}
      </Modal>
    </Modal>
  )
}

/** Turns a DM conversation (or a phone call) into an official order. */
export function CreateOrderDialog({ open, onClose, thread }: { open: boolean; onClose: () => void; thread?: Thread }) {
  const { state, dispatch, openOrder } = useStore()
  const customer = thread ? state.customers.find((c) => c.id === thread.customerId) : undefined
  const lastCustomerText = thread?.messages.filter((m) => m.from === 'CUSTOMER').at(-1)?.text ?? ''

  const [channel, setChannel] = useState<Channel>(thread?.channel ?? 'INSTAGRAM')
  const [name, setName] = useState(customer?.name ?? '')
  const [handle, setHandle] = useState(thread?.handle ?? '')
  const [phone, setPhone] = useState(customer?.phone ?? '')
  const [items, setItems] = useState([{ productId: state.products[0].id, qty: 1 }])
  const [customisation, setCustomisation] = useState('')
  const [method, setMethod] = useState<FulfilmentMethod>('SHIPPING')
  const [address, setAddress] = useState('')
  const [deliveryFee, setDeliveryFee] = useState(state.settings.defaultShippingFee)
  const [payKind, setPayKind] = useState<'SEND_LINK' | 'PAID' | 'UNPAID'>('SEND_LINK')
  const [payMethod, setPayMethod] = useState<PaymentMethod>('MPESA')
  const [reference, setReference] = useState('')

  const subtotal = items.reduce((s, i) => s + i.qty * (state.products.find((p) => p.id === i.productId)?.price ?? 0), 0)
  const fee = method === 'HAND_DELIVERY' ? 0 : deliveryFee

  const submit = () => {
    const draft: OrderDraft = {
      customerId: customer?.id,
      customerName: name,
      phone,
      instagram: channel === 'INSTAGRAM' ? handle : undefined,
      facebook: channel === 'FACEBOOK' ? handle : undefined,
      channel,
      threadId: thread?.id,
      items,
      customisation,
      method,
      address,
      deliveryFee: fee,
      payment: payKind === 'PAID' ? { kind: 'PAID', method: payMethod, reference } : { kind: payKind },
    }
    const r = dispatch({ type: 'CREATE_ORDER', draft })
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
      subtitle={thread ? `From ${thread.handle}` : 'For orders taken by DM or phone'}
      footer={
        <>
          <div className="mr-auto self-center text-sm">
            Total <strong className="tabular">{formatKES(subtotal + fee)}</strong>
          </div>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit}>
            {payKind === 'SEND_LINK' ? 'Create & send payment link' : 'Create order'}
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
            <>
              <Field label="Came in via">
                <select className={inputClass} value={channel} onChange={(e) => setChannel(e.target.value as Channel)}>
                  <option value="INSTAGRAM">Instagram DM</option>
                  <option value="FACEBOOK">Facebook Messenger</option>
                  <option value="WEB_FORM">Web form / phone</option>
                </select>
              </Field>
              {channel !== 'WEB_FORM' && (
                <Field label={channel === 'INSTAGRAM' ? 'Instagram handle' : 'Facebook name'}>
                  <input className={inputClass} value={handle} onChange={(e) => setHandle(e.target.value)} placeholder={channel === 'INSTAGRAM' ? '@username' : 'Full name'} />
                </Field>
              )}
            </>
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
                  {state.products.map((p) => (
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
            <Button size="sm" variant="ghost" onClick={() => setItems([...items, { productId: state.products[0].id, qty: 1 }])}>
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
          <div role="radiogroup" aria-label="Delivery method" className="grid gap-2 sm:grid-cols-2">
            <Choice checked={method === 'SHIPPING'} onSelect={() => setMethod('SHIPPING')} title="Courier delivery" detail={`${formatKES(deliveryFee)} delivery fee`} />
            <Choice checked={method === 'HAND_DELIVERY'} onSelect={() => setMethod('HAND_DELIVERY')} title="Hand delivery" detail="No delivery cost" />
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
            <Field label={method === 'SHIPPING' ? 'Delivery address' : 'Hand-deliver to'}>
              <input className={inputClass} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Area, town" />
            </Field>
            {method === 'SHIPPING' && (
              <Field label="Delivery fee">
                <input type="number" min={0} className={inputClass} value={deliveryFee} onChange={(e) => setDeliveryFee(Math.max(0, Math.floor(Number(e.target.value) || 0)))} />
              </Field>
            )}
          </div>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="eyebrow mb-2">Payment</legend>
          <div role="radiogroup" aria-label="Payment" className="grid gap-2 sm:grid-cols-3">
            <Choice checked={payKind === 'SEND_LINK'} onSelect={() => setPayKind('SEND_LINK')} title="Send payment link" detail="M-Pesa or card" />
            <Choice checked={payKind === 'PAID'} onSelect={() => setPayKind('PAID')} title="Already paid" detail="Enter the code" />
            <Choice checked={payKind === 'UNPAID'} onSelect={() => setPayKind('UNPAID')} title="Collect later" detail="Waits for payment" />
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
          Bouquets {formatKES(subtotal)} + delivery {fee ? formatKES(fee) : 'free'} = <strong className="text-ink">{formatKES(subtotal + fee)}</strong>
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
