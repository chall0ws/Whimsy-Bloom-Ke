import { feeSummary } from './fees'
import { formatKES } from './format'
import { canTransition, earnsServiceFee, orderTotal, refundAmountFor, STATUS_LABEL } from './orders'
import type {
  AppState,
  Channel,
  ChatStatus,
  Customer,
  Role,
  FulfilmentMethod,
  MaterialMovement,
  Order,
  OrderStatus,
  PaymentMethod,
  Settings,
  Message,
  MessageSender,
  Thread,
} from './types'
import { CUSTOMER_ACTOR, PAYSTACK_ACTOR } from './types'

export interface OrderDraft {
  customerId?: string
  customerName: string
  phone?: string
  email?: string
  instagram?: string
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
  | { type: 'SET_CHAT_STATUS'; status: ChatStatus }
  // Sign-in. The auth layer has already checked the Google account and its role.
  | { type: 'SIGN_IN_STAFF'; email: string; name: string; role: Role }
  | { type: 'SIGN_OUT' }
  // Customer side: live chat, order form and client portal. These run as the customer, not as a team member.
  | {
      type: 'CUSTOMER_START_CHAT'
      name: string
      phone: string
      email?: string
      startedFrom: Thread['startedFrom']
      text?: string
      /** The signed-in customer's own record, when known. */
      customerId?: string
      /** Start a separate conversation instead of continuing the customer's existing one. */
      newThread?: boolean
    }
  | { type: 'CUSTOMER_SEND_MESSAGE'; threadId: string; text: string }
  | { type: 'CUSTOMER_READ'; threadId: string }
  | { type: 'CUSTOMER_PAY'; orderId: string; reference: string; customerId?: string }
  | { type: 'CUSTOMER_PLACE_ORDER'; draft: OrderDraft }
  | {
      type: 'CUSTOMER_LINK_ACCOUNT'
      email: string
      name: string
      phone: string
      address?: string
      claimOrderId?: string
      /** Bring over past orders made with the same phone number. Off in live mode until numbers are verified by SMS. */
      allowPhoneMatch?: boolean
    }
  // Sent only by the server when Paystack confirms a payment.
  | { type: 'PAYMENT_RECEIVED'; orderId: string; method: PaymentMethod; reference: string; amount: number }
  | { type: 'CUSTOMER_UPDATE_PROFILE'; customerId: string; email: string; patch: Partial<Pick<Customer, 'name' | 'phone' | 'address'>> }

export type ActionResult =
  | { ok: true; state: AppState; notices: string[]; createdOrderId?: string; threadId?: string; customerId?: string }
  | { ok: false; error: string }

/** Author id for messages the system sends on her behalf (greeting, away reply). */
export const AUTO_REPLY = 'auto'
const AWAY_REPLY_EVERY_MS = 60 * 60_000

const SUPER_ADMIN_ONLY: Action['type'][] = ['UPDATE_SETTINGS', 'CONFIRM_PAYOUT']

/**
 * Applies one user action to the state. Pure: the same state, action and time
 * always give the same result, which is what the tests rely on.
 */
const NO_TEAM_MEMBER_NEEDED: Action['type'][] = ['SIGN_IN_STAFF', 'SIGN_OUT']

export function applyAction(state: AppState, action: Action, now: Date): ActionResult {
  let actor = CUSTOMER_ACTOR
  if (action.type === 'PAYMENT_RECEIVED') {
    actor = PAYSTACK_ACTOR
  } else if (NO_TEAM_MEMBER_NEEDED.includes(action.type)) {
    actor = state.currentUserId
  } else if (!action.type.startsWith('CUSTOMER_')) {
    const user = state.users.find((u) => u.id === state.currentUserId)
    if (!user) return fail('No signed-in user.')
    if (SUPER_ADMIN_ONLY.includes(action.type) && user.role !== 'SUPER_ADMIN') {
      return fail('Only the super admin can do that.')
    }
    actor = user.id
  }
  const tx = new Tx(state, now, actor)
  const error = run(tx, action)
  if (error) return fail(error)
  return { ok: true, state: tx.state, notices: tx.notices, createdOrderId: tx.createdOrderId, threadId: tx.threadId, customerId: tx.customerId }
}

function fail(error: string): ActionResult {
  return { ok: false, error }
}

/** Working copy of the state for one action, with helpers for ids, audit and notices. */
class Tx {
  notices: string[] = []
  createdOrderId?: string
  threadId?: string
  customerId?: string
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

  thread(threadId: string | undefined): Thread | undefined {
    return this.state.threads.find((t) => t.id === threadId)
  }

  postToThread(threadId: string | undefined, from: MessageSender, text: string, extra: Partial<Message> = {}) {
    const thread = this.thread(threadId)
    if (!thread) return
    const message: Message = {
      id: this.id('msg'),
      from,
      text,
      at: this.at,
      // Only customer messages wait to be read by the shop.
      read: from !== 'CUSTOMER',
      by: from === 'SHOP' ? this.actor : undefined,
      ...extra,
    }
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
    case 'SIGN_IN_STAFF': {
      const email = action.email.trim().toLowerCase()
      if (!email) return 'Missing email.'
      const existing = tx.state.users.find((u) => u.email.toLowerCase() === email)
      const title = action.role === 'SUPER_ADMIN' ? 'Super admin · Platform partner' : 'Admin · Whimsy & Bloom'
      const user = existing ? { ...existing, role: action.role, title } : { id: tx.id('u'), name: action.name.trim() || email, email, role: action.role, title }
      const users = existing ? tx.state.users.map((u) => (u.id === user.id ? user : u)) : [...tx.state.users, user]
      tx.state = { ...tx.state, users, currentUserId: user.id }
      return
    }
    case 'SIGN_OUT':
      tx.state = { ...tx.state, currentUserId: '' }
      return
    case 'SET_CHAT_STATUS':
      tx.state = { ...tx.state, chatStatus: action.status }
      tx.notices.push(action.status === 'ONLINE' ? 'You’re online. Customers see that you reply quickly.' : 'You’re away. New chats get an automatic reply.')
      return
    case 'CUSTOMER_START_CHAT':
      return startChat(tx, action)
    case 'CUSTOMER_SEND_MESSAGE': {
      const thread = tx.thread(action.threadId)
      if (!thread) return 'This chat has ended. Please start a new one.'
      return customerMessage(tx, thread.id, action.text)
    }
    case 'CUSTOMER_READ': {
      const thread = tx.thread(action.threadId)
      if (!thread) return 'Chat not found.'
      tx.putThread({ ...thread, customerReadAt: tx.at })
      return
    }
    case 'CUSTOMER_PAY': {
      const order = tx.order(action.orderId)
      if (action.customerId && order?.customerId !== action.customerId) return 'Order not found.'
      return confirmPayment(tx, action.orderId, 'MPESA', action.reference)
    }
    case 'CUSTOMER_PLACE_ORDER': {
      if (action.draft.channel !== 'WEB_FORM' && action.draft.channel !== 'PORTAL') return 'Customers can only order from the order form or the portal.'
      if (action.draft.customerId) {
        // A signed-in customer can only order for themselves.
        const customer = tx.state.customers.find((c) => c.id === action.draft.customerId)
        if (!customer) return 'Your account wasn’t found. Please sign in again.'
      }
      return createOrder(tx, action.draft)
    }
    case 'CUSTOMER_LINK_ACCOUNT':
      return linkAccount(tx, action)
    case 'PAYMENT_RECEIVED': {
      const order = tx.order(action.orderId)
      if (!order) return 'Order not found.'
      // Paystack can report the same payment more than once.
      if (order.payment.status !== 'UNPAID') return order.payment.reference === action.reference.toUpperCase() ? undefined : 'This order is already paid.'
      if (order.status !== 'PENDING_PAYMENT') return `Payment received for ${order.number}, but the order is ${STATUS_LABEL[order.status].toLowerCase()}. Refund it in Paystack.`
      if (action.amount !== orderTotal(order)) return `Paid ${formatKES(action.amount)} but ${order.number} costs ${formatKES(orderTotal(order))}.`
      return confirmPayment(tx, order.id, action.method, action.reference)
    }
    case 'CUSTOMER_UPDATE_PROFILE': {
      const customer = tx.state.customers.find((c) => c.id === action.customerId)
      if (!customer || customer.email?.toLowerCase() !== action.email.trim().toLowerCase()) return 'You can only change your own details.'
      const patch = { ...action.patch }
      if (patch.name !== undefined && !patch.name.trim()) return 'Please add your name.'
      if (patch.phone !== undefined && digits(patch.phone).length < 9) return 'Please add a phone number we can reach you on.'
      tx.state = { ...tx.state, customers: tx.state.customers.map((c) => (c.id === customer.id ? { ...c, ...patch } : c)) }
      tx.customerId = customer.id
      return
    }
  }
}

/**
 * Connects a signed-in account (Google or email) to a customer record: by email if we know it,
 * otherwise by phone number (so past chats and orders carry over), otherwise as a new customer.
 * `claimOrderId` is a guest order just placed in this browser; it moves to the new account.
 */
function linkAccount(tx: Tx, a: Extract<Action, { type: 'CUSTOMER_LINK_ACCOUNT' }>) {
  const email = a.email.trim().toLowerCase()
  if (!email.includes('@')) return 'Sign in again to continue.'
  const claimed = a.claimOrderId ? tx.order(a.claimOrderId) : undefined
  if (a.claimOrderId && !claimed) return 'Order not found.'
  const claimedCustomer = claimed && tx.state.customers.find((c) => c.id === claimed.customerId)
  const phone = a.phone.trim() || claimedCustomer?.phone || ''
  const name = a.name.trim() || claimedCustomer?.name || ''

  const setCustomer = (c: Customer) => {
    tx.state = { ...tx.state, customers: tx.state.customers.map((x) => (x.id === c.id ? c : x)) }
  }
  let target = tx.state.customers.find((c) => c.email?.toLowerCase() === email)
  if (!target && claimedCustomer && !claimedCustomer.email) {
    target = { ...claimedCustomer, email, address: claimedCustomer.address ?? (a.address?.trim() || undefined) }
    setCustomer(target)
  }
  if (!target) {
    if (!name) return 'Please add your name.'
    if (digits(phone).length < 9) return 'Please add a phone number we can reach you on.'
    const byPhone = a.allowPhoneMatch === false ? undefined : tx.state.customers.find((c) => c.phone && digits(c.phone) === digits(phone) && !c.email)
    if (byPhone) {
      target = { ...byPhone, email, address: byPhone.address ?? (a.address?.trim() || undefined) }
      setCustomer(target)
    } else {
      target = { id: tx.id('c'), name, phone, email, address: a.address?.trim() || undefined, notes: '', tags: [], createdAt: tx.at }
      tx.state = { ...tx.state, customers: [...tx.state.customers, target] }
    }
  }
  if (claimed && claimed.customerId !== target.id) {
    tx.putOrder({ ...claimed, customerId: target.id })
    tx.audit(`${claimed.number}: guest order saved to ${target.name}’s account`, CUSTOMER_ACTOR)
  }
  tx.customerId = target.id
}

const digits = (s?: string) => (s ?? '').replace(/\D/g, '').slice(-9)

function startChat(tx: Tx, a: Extract<Action, { type: 'CUSTOMER_START_CHAT' }>) {
  const name = a.name.trim()
  if (!name) return 'Please add your name.'
  if (digits(a.phone).length < 9) return 'Please add a phone number we can reach you on.'

  let customer = a.customerId
    ? tx.state.customers.find((c) => c.id === a.customerId)
    : tx.state.customers.find((c) => c.phone && digits(c.phone) === digits(a.phone))
  if (a.customerId && !customer) return 'Your account wasn’t found. Please sign in again.'
  if (!customer) {
    customer = { id: tx.id('c'), name, phone: a.phone.trim(), email: a.email?.trim() || undefined, notes: '', tags: [], createdAt: tx.at }
    tx.state = { ...tx.state, customers: [...tx.state.customers, customer] }
  }

  // One conversation per customer, so she sees their whole history in one place.
  let thread = a.newThread ? undefined : tx.state.threads.find((t) => t.customerId === customer.id)
  if (!thread) {
    thread = { id: tx.id('t'), customerId: customer.id, startedFrom: a.startedFrom, startedAt: tx.at, messages: [], customerReadAt: tx.at }
    tx.state = { ...tx.state, threads: [...tx.state.threads, thread] }
    tx.postToThread(thread.id, 'SHOP', `Hi ${name.split(' ')[0]}! 🌸 Welcome to Whimsy & Bloom. How can we help?`, { by: AUTO_REPLY })
  }
  tx.threadId = thread.id
  if (a.text?.trim()) return customerMessage(tx, thread.id, a.text)
}

function customerMessage(tx: Tx, threadId: string, raw: string) {
  const text = raw.trim()
  if (!text) return 'Write a message first.'
  if (text.length > 2000) return 'That message is too long. Please split it up.'
  tx.postToThread(threadId, 'CUSTOMER', text)
  const thread = tx.thread(threadId)!
  tx.putThread({ ...thread, customerReadAt: tx.at })
  tx.threadId = threadId

  if (tx.state.chatStatus === 'AWAY') {
    const lastAway = [...thread.messages].reverse().find((m) => m.by === AUTO_REPLY && m.text.startsWith('Thanks for your message'))
    if (!lastAway || new Date(tx.at).getTime() - new Date(lastAway.at).getTime() > AWAY_REPLY_EVERY_MS) {
      tx.postToThread(
        threadId,
        'SHOP',
        'Thanks for your message! We’re away from the studio right now and will reply as soon as we’re back. You can also order any time from our order form.',
        { by: AUTO_REPLY },
      )
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
    tx.notices.push('Shipping confirmation sent in the chat.')
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
  const text = `Here’s your payment link for order ${order.number} (${formatKES(orderTotal(order))}). Tap below to pay with M-Pesa 💳`
  if (order.threadId) {
    tx.postToThread(order.threadId, 'SHOP', text, { kind: 'PAYMENT_LINK', orderId: order.id })
    tx.notices.push('Payment link sent in the chat.')
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

  const actor = tx.actor
  const customerId = upsertCustomer(tx, draft)
  const paid = draft.payment.kind === 'PAID'
  const number = `WB-${tx.state.nextOrderNumber}`
  const thread = tx.thread(draft.threadId)
  const order: Order = {
    id: tx.id('o'),
    number,
    customerId,
    channel: thread ? 'LIVE_CHAT' : draft.channel,
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
  const via = { WEB_FORM: 'web form', PORTAL: 'client portal', LIVE_CHAT: 'live chat', MANUAL: 'phone / in person' }[order.channel]
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
        (draft.phone && c.phone && digits(c.phone) === digits(draft.phone)),
    )
  const contact = {
    phone: draft.phone?.trim() || undefined,
    email: draft.email?.trim() || undefined,
    instagram: draft.instagram?.trim() || undefined,
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

