import { feeSummary } from './fees'
import { formatKES } from './format'
import { canTransition, earnsServiceFee, orderTotal, refundAmountFor, STATUS_LABEL } from './orders'
import type {
  AppState,
  Channel,
  Customer,
  FulfilmentMethod,
  MaterialMovement,
  Order,
  OrderStatus,
  PaymentMethod,
  Settings,
  Thread,
} from './types'
import { CUSTOMER_ACTOR } from './types'

export interface OrderDraft {
  customerId?: string
  customerName: string
  phone?: string
  email?: string
  instagram?: string
  facebook?: string
  channel: Channel
  threadId?: string
  items: { productId: string; qty: number }[]
  customisation: string
  method: FulfilmentMethod
  address: string
  deliveryFee?: number
  payment: { kind: 'SEND_LINK' } | { kind: 'UNPAID' } | { kind: 'PAID'; method: PaymentMethod; reference: string }
}

export type Action =
  | { type: 'SET_STATUS'; orderId: string; status: OrderStatus; courier?: string; trackingNumber?: string }
  | { type: 'REFUND_ORDER'; orderId: string }
  | { type: 'SEND_PAYMENT_LINK'; orderId: string }
  | { type: 'CONFIRM_PAYMENT'; orderId: string; method: PaymentMethod; reference: string }
  | { type: 'CREATE_ORDER'; draft: OrderDraft }
  | { type: 'SET_THREAD_READ'; threadId: string; read: boolean }
  | { type: 'SEND_MESSAGE'; threadId: string; text: string }
  | { type: 'UPDATE_CUSTOMER'; customerId: string; patch: Partial<Pick<Customer, 'name' | 'phone' | 'email' | 'notes' | 'tags'>> }
  | { type: 'RECORD_PURCHASE'; materialId: string; qty: number; note?: string }
  | { type: 'RECORD_PAYOUT'; amount: number; reference: string }
  | { type: 'CONFIRM_PAYOUT'; payoutId: string }
  | { type: 'UPDATE_SETTINGS'; patch: Partial<Settings> }
  | { type: 'SWITCH_USER'; userId: string }

export type ActionResult =
  | { ok: true; state: AppState; notices: string[]; createdOrderId?: string }
  | { ok: false; error: string }

const SUPER_ADMIN_ONLY: Action['type'][] = ['UPDATE_SETTINGS', 'CONFIRM_PAYOUT']

/**
 * Applies one user action to the state. Pure: the same state, action and time
 * always give the same result, which is what the tests rely on.
 */
export function applyAction(state: AppState, action: Action, now: Date): ActionResult {
  const user = state.users.find((u) => u.id === state.currentUserId)
  if (!user) return fail('No signed-in user.')
  if (SUPER_ADMIN_ONLY.includes(action.type) && user.role !== 'SUPER_ADMIN') {
    return fail('Only the super admin can do that.')
  }
  const tx = new Tx(state, now, user.id)
  const error = run(tx, action)
  if (error) return fail(error)
  return { ok: true, state: tx.state, notices: tx.notices, createdOrderId: tx.createdOrderId }
}

function fail(error: string): ActionResult {
  return { ok: false, error }
}

/** Working copy of the state for one action, with helpers for ids, audit and notices. */
class Tx {
  notices: string[] = []
  createdOrderId?: string
  readonly at: string

  constructor(
    public state: AppState,
    now: Date,
    public actor: string,
  ) {
    this.at = now.toISOString()
  }

  id(prefix: string): string {
    const n = this.state.nextId
    this.state = { ...this.state, nextId: n + 1 }
    return `${prefix}-${n}`
  }

  audit(text: string, by = this.actor) {
    this.state = { ...this.state, audit: [{ id: this.id('a'), at: this.at, by, text }, ...this.state.audit] }
  }

  order(orderId: string): Order | undefined {
    return this.state.orders.find((o) => o.id === orderId)
  }

  putOrder(order: Order) {
    this.state = { ...this.state, orders: this.state.orders.map((o) => (o.id === order.id ? order : o)) }
  }

  putThread(thread: Thread) {
    this.state = { ...this.state, threads: this.state.threads.map((t) => (t.id === thread.id ? thread : t)) }
  }

  postToThread(threadId: string | undefined, from: 'SHOP' | 'SYSTEM', text: string) {
    const thread = this.state.threads.find((t) => t.id === threadId)
    if (!thread) return
    const message = { id: this.id('msg'), from, text, at: this.at, read: true, by: from === 'SHOP' ? this.actor : undefined }
    this.putThread({ ...thread, messages: [...thread.messages, message] })
  }
}

function run(tx: Tx, action: Action): string | undefined {
  switch (action.type) {
    case 'SET_STATUS':
      return setStatus(tx, action.orderId, action.status, action.courier, action.trackingNumber)
    case 'REFUND_ORDER':
      return refundOrder(tx, action.orderId)
    case 'SEND_PAYMENT_LINK':
      return sendPaymentLink(tx, action.orderId)
    case 'CONFIRM_PAYMENT':
      return confirmPayment(tx, action.orderId, action.method, action.reference)
    case 'CREATE_ORDER':
      return createOrder(tx, action.draft)
    case 'SET_THREAD_READ': {
      const thread = tx.state.threads.find((t) => t.id === action.threadId)
      if (!thread) return 'Conversation not found.'
      tx.putThread({
        ...thread,
        messages: thread.messages.map((m, i) => {
          if (m.from !== 'CUSTOMER') return m
          // Marking unread flags only the latest customer message, like most inboxes.
          if (!action.read) return i === lastCustomerIndex(thread) ? { ...m, read: false } : m
          return { ...m, read: true }
        }),
      })
      return
    }
    case 'SEND_MESSAGE': {
      const text = action.text.trim()
      if (!text) return 'Write a message first.'
      const thread = tx.state.threads.find((t) => t.id === action.threadId)
      if (!thread) return 'Conversation not found.'
      tx.putThread({ ...thread, messages: thread.messages.map((m) => ({ ...m, read: true })) })
      tx.postToThread(thread.id, 'SHOP', text)
      return
    }
    case 'UPDATE_CUSTOMER': {
      const customer = tx.state.customers.find((c) => c.id === action.customerId)
      if (!customer) return 'Customer not found.'
      if (action.patch.name !== undefined && !action.patch.name.trim()) return 'Customer name can’t be empty.'
      tx.state = {
        ...tx.state,
        customers: tx.state.customers.map((c) => (c.id === customer.id ? { ...c, ...action.patch } : c)),
      }
      return
    }
    case 'RECORD_PURCHASE': {
      const material = tx.state.materials.find((m) => m.id === action.materialId)
      if (!material) return 'Material not found.'
      if (!(action.qty > 0)) return 'Enter how much you bought.'
      adjustMaterial(tx, material.id, action.qty, { reason: 'PURCHASE', note: action.note?.trim() || undefined })
      tx.audit(`Recorded purchase: ${action.qty} ${material.unit} of ${material.name}`)
      return
    }
    case 'RECORD_PAYOUT': {
      const { availableToSend } = feeSummary(tx.state)
      if (!Number.isInteger(action.amount) || action.amount <= 0) return 'Enter a whole KES amount.'
      if (action.amount > availableToSend) return `You can send at most ${formatKES(availableToSend)}.`
      if (!action.reference.trim()) return 'Add the M-Pesa or bank reference.'
      const payout = {
        id: tx.id('po'),
        amount: action.amount,
        reference: action.reference.trim().toUpperCase(),
        sentAt: tx.at,
        sentBy: tx.actor,
        status: 'SENT' as const,
      }
      tx.state = { ...tx.state, payouts: [payout, ...tx.state.payouts] }
      tx.audit(`Recorded service-fee payout of ${formatKES(payout.amount)} (ref ${payout.reference})`)
      tx.notices.push('Payout recorded. It counts against the balance once the super admin confirms receipt.')
      return
    }
    case 'CONFIRM_PAYOUT': {
      const payout = tx.state.payouts.find((p) => p.id === action.payoutId)
      if (!payout) return 'Payout not found.'
      if (payout.status === 'CONFIRMED') return 'That payout is already confirmed.'
      tx.state = {
        ...tx.state,
        payouts: tx.state.payouts.map((p) =>
          p.id === payout.id ? { ...p, status: 'CONFIRMED', confirmedAt: tx.at, confirmedBy: tx.actor } : p,
        ),
      }
      tx.audit(`Confirmed receipt of payout ${payout.reference} (${formatKES(payout.amount)})`)
      return
    }
    case 'UPDATE_SETTINGS': {
      const next = { ...tx.state.settings, ...action.patch }
      if (!Number.isInteger(next.serviceFee) || next.serviceFee < 0) return 'Service fee must be a whole KES amount.'
      if (!Number.isInteger(next.defaultShippingFee) || next.defaultShippingFee < 0) {
        return 'Delivery fee must be a whole KES amount.'
      }
      tx.state = { ...tx.state, settings: next }
      tx.audit(`Updated settings: ${describeSettingsChange(action.patch)}`)
      return
    }
    case 'SWITCH_USER': {
      if (!tx.state.users.some((u) => u.id === action.userId)) return 'Unknown user.'
      tx.state = { ...tx.state, currentUserId: action.userId }
      return
    }
  }
}

function lastCustomerIndex(thread: Thread): number {
  for (let i = thread.messages.length - 1; i >= 0; i--) if (thread.messages[i].from === 'CUSTOMER') return i
  return -1
}

function describeSettingsChange(patch: Partial<Settings>): string {
  const parts: string[] = []
  if (patch.serviceFee !== undefined) parts.push(`service fee ${formatKES(patch.serviceFee)} per order`)
  if (patch.feeOnHandDelivery !== undefined) {
    parts.push(patch.feeOnHandDelivery ? 'fee applies to hand delivery' : 'no fee on hand delivery')
  }
  if (patch.defaultShippingFee !== undefined) parts.push(`courier delivery fee ${formatKES(patch.defaultShippingFee)}`)
  if (patch.payoutSchedule !== undefined) parts.push(`${patch.payoutSchedule.toLowerCase()} payouts`)
  return parts.join(', ') || 'no changes'
}

function setStatus(tx: Tx, orderId: string, to: OrderStatus, courier?: string, trackingNumber?: string) {
  const order = tx.order(orderId)
  if (!order) return 'Order not found.'
  if (order.status === to) return
  if (to === 'REFUNDED') return refundOrder(tx, orderId)
  if (!canTransition(order.status, to)) {
    if (order.status === 'SHIPPED') return 'Shipped orders are final. Use Refund if the customer returns it.'
    if (order.status === 'PENDING_PAYMENT') return 'Confirm the payment first.'
    return `Can’t move an order from ${STATUS_LABEL[order.status]} to ${STATUS_LABEL[to]}.`
  }

  let next: Order = {
    ...order,
    status: to,
    history: [...order.history, { status: to, at: tx.at, by: tx.actor }],
  }

  if (to === 'PROCESSING' && !order.materialsDeducted) {
    consumeMaterials(tx, next, -1)
    next = { ...next, materialsDeducted: true }
  }
  if (to === 'PENDING' && order.materialsDeducted) {
    // Moving back to Pending undoes a mistaken start, so the materials go back on the shelf.
    consumeMaterials(tx, next, +1)
    next = { ...next, materialsDeducted: false }
  }
  if (to === 'CANCELLED' && order.payment.status === 'PAID') {
    // Not shipped yet, so the customer gets everything back. Materials already used stay used.
    next = { ...next, payment: { ...next.payment, status: 'REFUNDED', refundedAmount: refundAmountFor(order) } }
    tx.notices.push(`Refund ${formatKES(refundAmountFor(order))} to the customer.`)
  }
  if (to === 'SHIPPED') {
    next = {
      ...next,
      shippedAt: tx.at,
      fulfilment: {
        ...next.fulfilment,
        courier: courier?.trim() || next.fulfilment.courier,
        trackingNumber: trackingNumber?.trim() || next.fulfilment.trackingNumber,
      },
    }
  }

  tx.putOrder(next)
  tx.audit(`${next.number}: ${STATUS_LABEL[order.status]} → ${STATUS_LABEL[to]}`)

  if (to === 'SHIPPED') onShipped(tx, next)
}

function onShipped(tx: Tx, order: Order) {
  const { settings } = tx.state
  const alreadyCharged = tx.state.fees.some((f) => f.orderId === order.id)
  if (!alreadyCharged && earnsServiceFee(order, settings) && settings.serviceFee > 0) {
    tx.state = {
      ...tx.state,
      fees: [
        { id: tx.id('fee'), orderId: order.id, orderNumber: order.number, amount: settings.serviceFee, at: tx.at },
        ...tx.state.fees,
      ],
    }
    tx.notices.push(`Service fee of ${formatKES(settings.serviceFee)} added to the partner balance.`)
  }

  const { fulfilment } = order
  const text =
    fulfilment.method === 'HAND_DELIVERY'
      ? `Your order ${order.number} is ready and out for hand delivery 🌸 Thank you for choosing Whimsy & Bloom!`
      : `Your order ${order.number} is on its way 🌸 ${fulfilment.courier ? `Courier: ${fulfilment.courier}. ` : ''}${
          fulfilment.trackingNumber ? `Tracking: ${fulfilment.trackingNumber}. ` : ''
        }Thank you for choosing Whimsy & Bloom!`
  if (order.threadId) {
    tx.postToThread(order.threadId, 'SHOP', text)
    tx.notices.push('Shipping confirmation sent in the customer’s DMs.')
  } else {
    tx.audit(`${order.number}: shipping confirmation sent by SMS and email`)
    tx.notices.push('Shipping confirmation sent by SMS and email.')
  }
}

function refundOrder(tx: Tx, orderId: string) {
  const order = tx.order(orderId)
  if (!order) return 'Order not found.'
  if (order.status !== 'SHIPPED') return 'Only shipped orders can be refunded. Cancel orders that haven’t shipped.'
  const amount = refundAmountFor(order)
  tx.putOrder({
    ...order,
    status: 'REFUNDED',
    payment: { ...order.payment, status: 'REFUNDED', refundedAmount: amount },
    history: [...order.history, { status: 'REFUNDED', at: tx.at, by: tx.actor }],
  })
  tx.audit(`${order.number}: refunded ${formatKES(amount)} (delivery and service fees kept)`)
  tx.notices.push(`Refund ${formatKES(amount)} to the customer. Delivery and service fees are non-refundable.`)
}

function sendPaymentLink(tx: Tx, orderId: string) {
  const order = tx.order(orderId)
  if (!order) return 'Order not found.'
  if (order.status !== 'PENDING_PAYMENT') return 'This order is already paid.'
  tx.putOrder({ ...order, payment: { ...order.payment, linkSentAt: tx.at } })
  const text = `Here’s your payment link for order ${order.number} (${formatKES(orderTotal(order))}). You can pay by M-Pesa or card 💳`
  if (order.threadId) {
    tx.postToThread(order.threadId, 'SHOP', text)
    tx.notices.push('Payment link sent in DMs.')
  } else {
    tx.notices.push('Payment link sent by SMS.')
  }
  tx.audit(`${order.number}: payment link sent`)
}

function confirmPayment(tx: Tx, orderId: string, method: PaymentMethod, reference: string) {
  const order = tx.order(orderId)
  if (!order) return 'Order not found.'
  if (order.status !== 'PENDING_PAYMENT') return 'This order isn’t waiting for payment.'
  if (!reference.trim()) return 'Add the payment reference.'
  const next: Order = {
    ...order,
    status: 'PENDING',
    payment: { ...order.payment, status: 'PAID', method, reference: reference.trim().toUpperCase(), paidAt: tx.at },
    history: [...order.history, { status: 'PENDING', at: tx.at, by: tx.actor, note: 'Payment confirmed' }],
  }
  tx.putOrder(next)
  tx.postToThread(order.threadId, 'SYSTEM', `Payment received for ${order.number} · ${method === 'MPESA' ? 'M-Pesa' : 'Card'} ${next.payment.reference}`)
  tx.audit(`${order.number}: payment of ${formatKES(orderTotal(order))} confirmed (${next.payment.reference})`)
}

function createOrder(tx: Tx, draft: OrderDraft) {
  if (!draft.customerName.trim()) return 'Add the customer’s name.'
  const items = draft.items.filter((i) => i.qty > 0)
  if (items.length === 0) return 'Add at least one bouquet.'
  if (items.some((i) => !Number.isInteger(i.qty))) return 'Quantities must be whole numbers.'
  for (const item of items) {
    if (!tx.state.products.some((p) => p.id === item.productId)) return 'Unknown product.'
  }
  if (!draft.address.trim()) {
    return draft.method === 'SHIPPING' ? 'Add the delivery address.' : 'Add where to hand-deliver.'
  }
  if (draft.payment.kind === 'PAID' && !draft.payment.reference.trim()) return 'Add the payment reference.'

  const actor = draft.channel === 'WEB_FORM' ? CUSTOMER_ACTOR : tx.actor
  const customerId = upsertCustomer(tx, draft)
  const paid = draft.payment.kind === 'PAID'
  const number = `WB-${tx.state.nextOrderNumber}`
  const thread = tx.state.threads.find((t) => t.id === draft.threadId)
  const order: Order = {
    id: tx.id('o'),
    number,
    customerId,
    channel: draft.channel,
    sourceHandle: thread?.handle ?? (draft.channel === 'INSTAGRAM' ? draft.instagram : draft.facebook),
    threadId: thread?.id,
    items: items.map((i) => ({
      productId: i.productId,
      qty: i.qty,
      unitPrice: tx.state.products.find((p) => p.id === i.productId)!.price,
    })),
    customisation: draft.customisation.trim(),
    fulfilment: {
      method: draft.method,
      address: draft.address.trim(),
      // Hand delivery is free for the customer.
      deliveryFee: draft.method === 'HAND_DELIVERY' ? 0 : (draft.deliveryFee ?? tx.state.settings.defaultShippingFee),
    },
    payment:
      draft.payment.kind === 'PAID'
        ? { status: 'PAID', method: draft.payment.method, reference: draft.payment.reference.trim().toUpperCase(), paidAt: tx.at }
        : { status: 'UNPAID' },
    status: paid ? 'PENDING' : 'PENDING_PAYMENT',
    createdAt: tx.at,
    history: [{ status: paid ? 'PENDING' : 'PENDING_PAYMENT', at: tx.at, by: actor }],
    materialsDeducted: false,
  }
  tx.state = { ...tx.state, orders: [order, ...tx.state.orders], nextOrderNumber: tx.state.nextOrderNumber + 1 }
  tx.createdOrderId = order.id
  const via = draft.channel === 'WEB_FORM' ? 'web form' : 'DM conversation'
  tx.audit(`${number}: created from ${via} for ${draft.customerName.trim()} (${formatKES(orderTotal(order))})`, actor)
  tx.notices.push(`Order ${number} created.`)
  if (draft.payment.kind === 'SEND_LINK') sendPaymentLink(tx, order.id)
}

function upsertCustomer(tx: Tx, draft: OrderDraft): string {
  const norm = (s?: string) => s?.trim().toLowerCase().replace(/^@/, '')
  const existing =
    tx.state.customers.find((c) => c.id === draft.customerId) ??
    tx.state.customers.find(
      (c) =>
        (draft.instagram && norm(c.instagram) === norm(draft.instagram)) ||
        (draft.facebook && norm(c.facebook) === norm(draft.facebook)) ||
        (draft.phone && c.phone && c.phone.replace(/\D/g, '') === draft.phone.replace(/\D/g, '')),
    )
  const contact = {
    phone: draft.phone?.trim() || undefined,
    email: draft.email?.trim() || undefined,
    instagram: draft.instagram?.trim() || undefined,
    facebook: draft.facebook?.trim() || undefined,
  }
  if (existing) {
    // Fill in contact details we didn't have; never overwrite what's on file.
    const merged = { ...existing }
    for (const [key, value] of Object.entries(contact) as [keyof typeof contact, string | undefined][]) {
      if (value && !merged[key]) merged[key] = value
    }
    tx.state = { ...tx.state, customers: tx.state.customers.map((c) => (c.id === existing.id ? merged : c)) }
    return existing.id
  }
  const customer: Customer = {
    id: tx.id('c'),
    name: draft.customerName.trim(),
    ...contact,
    notes: '',
    tags: [],
    createdAt: tx.at,
  }
  tx.state = { ...tx.state, customers: [...tx.state.customers, customer] }
  return customer.id
}

/** direction -1 uses materials for an order, +1 puts them back. */
function consumeMaterials(tx: Tx, order: Order, direction: -1 | 1) {
  const needed = new Map<string, number>()
  for (const item of order.items) {
    for (const line of tx.state.recipes[item.productId] ?? []) {
      needed.set(line.materialId, (needed.get(line.materialId) ?? 0) + line.qty * item.qty)
    }
  }
  const low: string[] = []
  for (const [materialId, qty] of needed) {
    adjustMaterial(tx, materialId, direction * qty, {
      reason: direction < 0 ? 'ORDER' : 'ORDER_REVERSAL',
      orderNumber: order.number,
    })
    const material = tx.state.materials.find((m) => m.id === materialId)
    if (direction < 0 && material && material.onHand <= material.reorderLevel) low.push(material.name)
  }
  if (low.length) tx.notices.push(`Running low: ${low.join(', ')}.`)
}

function adjustMaterial(tx: Tx, materialId: string, delta: number, info: Pick<MaterialMovement, 'reason' | 'orderNumber' | 'note'>) {
  const rounded = Math.round(delta * 100) / 100
  tx.state = {
    ...tx.state,
    materials: tx.state.materials.map((m) =>
      m.id === materialId ? { ...m, onHand: Math.round((m.onHand + rounded) * 100) / 100 } : m,
    ),
  }
  const movement: MaterialMovement = { id: tx.id('mv'), materialId, delta: rounded, at: tx.at, by: tx.actor, ...info }
  tx.state = { ...tx.state, movements: [movement, ...tx.state.movements] }
}

