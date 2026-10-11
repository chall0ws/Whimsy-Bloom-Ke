import { describe, expect, it } from 'vitest'
import { applyAction, AUTO_REPLY, type Action, type OrderDraft } from './actions'
import { parseStaffList, staffRoleFor } from './auth'
import { DEFAULT_SETTINGS, MATERIALS, PRODUCTS, RECIPES, USERS } from './catalog'
import { feeSummary } from './fees'
import { netRevenue } from './orders'
import { createSeedState } from './seed'
import type { AppState } from './types'

const NOW = new Date('2026-10-09T12:00:00+03:00')
const SIGN_IN_PARTNER: Action = { type: 'SIGN_IN_STAFF', email: 'Partner@Example.com', name: 'Partner', role: 'SUPER_ADMIN' }

function emptyState(overrides: Partial<AppState> = {}): AppState {
  return {
    version: 1,
    users: USERS,
    currentUserId: 'u-owner',
    // The order, fee and stock rules are checked with the original sample bouquets and their recipes.
    products: PRODUCTS.map((p) => ({ ...p, hidden: false })),
    materials: MATERIALS.map((m) => ({ ...m })),
    recipes: RECIPES,
    customers: [],
    orders: [],
    threads: [
      {
        id: 't-1',
        customerId: 'c-wanjiru',
        startedFrom: 'CHAT_LINK',
        startedAt: NOW.toISOString(),
        messages: [{ id: 'm-1', from: 'CUSTOMER', text: 'Hi!', at: NOW.toISOString(), read: false }],
      },
    ],
    fees: [],
    payouts: [],
    movements: [],
    audit: [],
    settings: { ...DEFAULT_SETTINGS },
    chatStatus: 'ONLINE',
    nextOrderNumber: 1001,
    nextId: 1,
    ...overrides,
  }
}

function apply(state: AppState, action: Action): AppState {
  const result = applyAction(state, action, NOW)
  if (!result.ok) throw new Error(result.error)
  return result.state
}

function applyAll(state: AppState, actions: Action[]): AppState {
  return actions.reduce(apply, state)
}

const draft = (overrides: Partial<OrderDraft> = {}): OrderDraft => ({
  customerName: 'Wanjiru Kamau',
  instagram: '@wanjiru.blooms',
  channel: 'LIVE_CHAT',
  threadId: 't-1',
  items: [{ productId: 'p-pink-lily', qty: 1 }],
  customisation: 'Bigger size',
  method: 'SHIPPING',
  address: 'Lavington, Nairobi',
  payment: { kind: 'PAID', method: 'MPESA', reference: 'sjk7h2l9qx' },
  ...overrides,
})

function createPaidOrder(state: AppState, overrides: Partial<OrderDraft> = {}) {
  const result = applyAction(state, { type: 'CREATE_ORDER', draft: draft(overrides) }, NOW)
  if (!result.ok) throw new Error(result.error)
  return { state: result.state, orderId: result.createdOrderId! }
}

const ship = (orderId: string): Action[] => [
  { type: 'SET_STATUS', orderId, status: 'PROCESSING' },
  { type: 'SET_STATUS', orderId, status: 'SHIPPED', courier: 'G4S', trackingNumber: 'G4S-123' },
]

describe('creating orders', () => {
  it('creates a chat order linked to the conversation and a new customer', () => {
    const { state, orderId } = createPaidOrder(emptyState())
    const order = state.orders.find((o) => o.id === orderId)!
    expect(order.number).toBe('WB-1001')
    expect(order.status).toBe('PENDING')
    expect(order.channel).toBe('LIVE_CHAT')
    expect(order.threadId).toBe('t-1')
    expect(order.fulfilment.deliveryFee).toBe(DEFAULT_SETTINGS.defaultShippingFee)
    expect(order.payment.reference).toBe('SJK7H2L9QX')
    expect(state.customers).toHaveLength(1)
    expect(state.nextOrderNumber).toBe(1002)
  })

  it('charges nothing for hand delivery', () => {
    const { state, orderId } = createPaidOrder(emptyState(), { method: 'HAND_DELIVERY', deliveryFee: 500 })
    const order = state.orders.find((o) => o.id === orderId)!
    expect(order.fulfilment.deliveryFee).toBe(0)
    expect(netRevenue(order)).toBe(3500)
  })

  it('reuses an existing customer matched by handle', () => {
    let { state } = createPaidOrder(emptyState())
    ;({ state } = createPaidOrder(state, { customerName: 'Wanjiru K', instagram: 'Wanjiru.Blooms', phone: '+254 712 000 000' }))
    expect(state.customers).toHaveLength(1)
    expect(state.customers[0].name).toBe('Wanjiru Kamau')
    expect(state.customers[0].phone).toBe('+254 712 000 000')
  })

  it('posts a payment link and waits for payment when asked to send a link', () => {
    const { state, orderId } = createPaidOrder(emptyState(), { payment: { kind: 'SEND_LINK' } })
    const order = state.orders.find((o) => o.id === orderId)!
    expect(order.status).toBe('PENDING_PAYMENT')
    expect(order.payment.linkSentAt).toBe(NOW.toISOString())
    const last = state.threads[0].messages.at(-1)!
    expect(last).toMatchObject({ from: 'SHOP', kind: 'PAYMENT_LINK', orderId })
    expect(last.text).toContain('WB-1001')
  })

  it('rejects an order without an address', () => {
    const result = applyAction(emptyState(), { type: 'CREATE_ORDER', draft: draft({ address: ' ' }) }, NOW)
    expect(result.ok).toBe(false)
  })
})

describe('payment', () => {
  it('moves an order from awaiting payment to pending once paid', () => {
    const created = createPaidOrder(emptyState(), { payment: { kind: 'UNPAID' } })
    const state = apply(created.state, { type: 'CONFIRM_PAYMENT', orderId: created.orderId, method: 'MPESA', reference: 'SAB123' })
    const order = state.orders[0]
    expect(order.status).toBe('PENDING')
    expect(order.payment.status).toBe('PAID')
  })

  it('cannot skip payment by toggling the status', () => {
    const created = createPaidOrder(emptyState(), { payment: { kind: 'UNPAID' } })
    const result = applyAction(created.state, { type: 'SET_STATUS', orderId: created.orderId, status: 'PROCESSING' }, NOW)
    expect(result.ok).toBe(false)
  })
})

describe('service fee', () => {
  it('adds the fee once when an order ships', () => {
    const created = createPaidOrder(emptyState())
    const state = applyAll(created.state, ship(created.orderId))
    expect(state.fees).toHaveLength(1)
    expect(state.fees[0].amount).toBe(100)
    expect(feeSummary(state).payable).toBe(100)
  })

  it('does not charge before shipping', () => {
    const created = createPaidOrder(emptyState())
    const state = apply(created.state, { type: 'SET_STATUS', orderId: created.orderId, status: 'PROCESSING' })
    expect(state.fees).toHaveLength(0)
  })

  it('locks shipped orders so the fee cannot be charged twice', () => {
    const created = createPaidOrder(emptyState())
    const state = applyAll(created.state, ship(created.orderId))
    const back = applyAction(state, { type: 'SET_STATUS', orderId: created.orderId, status: 'PROCESSING' }, NOW)
    expect(back.ok).toBe(false)
    const again = apply(state, { type: 'SET_STATUS', orderId: created.orderId, status: 'SHIPPED' })
    expect(again.fees).toHaveLength(1)
  })

  it('keeps the service and delivery fees when a shipped order is refunded', () => {
    const created = createPaidOrder(emptyState())
    let state = applyAll(created.state, ship(created.orderId))
    state = apply(state, { type: 'REFUND_ORDER', orderId: created.orderId })
    const order = state.orders[0]
    expect(order.status).toBe('REFUNDED')
    expect(order.payment.refundedAmount).toBe(3500)
    expect(netRevenue(order)).toBe(300)
    expect(state.fees).toHaveLength(1)
  })

  it('refunds everything when an order is cancelled before shipping, with no fee', () => {
    const created = createPaidOrder(emptyState())
    const state = apply(created.state, { type: 'SET_STATUS', orderId: created.orderId, status: 'CANCELLED' })
    expect(netRevenue(state.orders[0])).toBe(0)
    expect(state.fees).toHaveLength(0)
  })

  it('charges hand-delivered orders unless the super admin turns that off', () => {
    const hand = createPaidOrder(emptyState(), { method: 'HAND_DELIVERY' })
    expect(applyAll(hand.state, ship(hand.orderId)).fees).toHaveLength(1)

    let state = apply(emptyState(), SIGN_IN_PARTNER)
    state = apply(state, { type: 'UPDATE_SETTINGS', patch: { feeOnHandDelivery: false } })
    const created = createPaidOrder(state, { method: 'HAND_DELIVERY' })
    expect(applyAll(created.state, ship(created.orderId)).fees).toHaveLength(0)
  })

  it('uses the fee rate in force when the order ships', () => {
    let state = apply(emptyState(), SIGN_IN_PARTNER)
    state = apply(state, { type: 'UPDATE_SETTINGS', patch: { serviceFee: 150 } })
    const created = createPaidOrder(state)
    expect(applyAll(created.state, ship(created.orderId)).fees[0].amount).toBe(150)
  })

  it('posts the shipping confirmation in the DM thread', () => {
    const created = createPaidOrder(emptyState())
    const state = applyAll(created.state, ship(created.orderId))
    expect(state.threads[0].messages.at(-1)!.text).toContain('G4S-123')
  })
})

describe('roles', () => {
  it('stops the admin from changing settings or confirming payouts', () => {
    const state = emptyState()
    expect(applyAction(state, { type: 'UPDATE_SETTINGS', patch: { serviceFee: 0 } }, NOW).ok).toBe(false)
    expect(applyAction(state, { type: 'CONFIRM_PAYOUT', payoutId: 'x' }, NOW).ok).toBe(false)
  })
})

describe('payouts', () => {
  function withFees() {
    let state = emptyState()
    for (let i = 0; i < 3; i++) {
      const created = createPaidOrder(state)
      state = applyAll(created.state, ship(created.orderId))
    }
    return state
  }

  it('only reduces the balance once the super admin confirms receipt', () => {
    let state = apply(withFees(), { type: 'RECORD_PAYOUT', amount: 200, reference: 'sxy1' })
    expect(feeSummary(state)).toMatchObject({ collected: 300, inTransit: 200, payable: 300, availableToSend: 100 })
    state = apply(state, SIGN_IN_PARTNER)
    state = apply(state, { type: 'CONFIRM_PAYOUT', payoutId: state.payouts[0].id })
    expect(feeSummary(state)).toMatchObject({ paidOut: 200, inTransit: 0, payable: 100 })
  })

  it('refuses to pay out more than is owed', () => {
    const state = apply(withFees(), { type: 'RECORD_PAYOUT', amount: 300, reference: 'A' })
    expect(applyAction(state, { type: 'RECORD_PAYOUT', amount: 100, reference: 'B' }, NOW).ok).toBe(false)
  })
})

describe('materials', () => {
  const onHand = (state: AppState, id: string) => state.materials.find((m) => m.id === id)!.onHand

  it('uses materials when work starts and returns them if it is moved back', () => {
    const created = createPaidOrder(emptyState(), { items: [{ productId: 'p-pink-lily', qty: 2 }] })
    const before = onHand(created.state, 'm-crepe-pink')
    const started = apply(created.state, { type: 'SET_STATUS', orderId: created.orderId, status: 'PROCESSING' })
    expect(onHand(started, 'm-crepe-pink')).toBe(before - 1)
    expect(onHand(started, 'm-wire')).toBe(320 - 24)
    const undone = apply(started, { type: 'SET_STATUS', orderId: created.orderId, status: 'PENDING' })
    expect(onHand(undone, 'm-crepe-pink')).toBe(before)
  })

  it('warns when a material drops to its reorder level', () => {
    const created = createPaidOrder(emptyState(), { items: [{ productId: 'p-giant-rose', qty: 1 }] })
    const result = applyAction(created.state, { type: 'SET_STATUS', orderId: created.orderId, status: 'PROCESSING' }, NOW)
    expect(result.ok && result.notices.join(' ')).toContain('Crepe paper — red')
  })

  it('records purchases', () => {
    const state = apply(emptyState(), { type: 'RECORD_PURCHASE', materialId: 'm-wrap', qty: 10 })
    expect(onHand(state, 'm-wrap')).toBe(52)
    expect(state.movements[0]).toMatchObject({ reason: 'PURCHASE', delta: 10 })
  })
})

describe('inbox', () => {
  it('marks a conversation read and unread', () => {
    let state = apply(emptyState(), { type: 'SET_THREAD_READ', threadId: 't-1', read: true })
    expect(state.threads[0].messages[0].read).toBe(true)
    state = apply(state, { type: 'SET_THREAD_READ', threadId: 't-1', read: false })
    expect(state.threads[0].messages[0].read).toBe(false)
  })

  it('replying marks the conversation read', () => {
    const state = apply(emptyState(), { type: 'SEND_MESSAGE', threadId: 't-1', text: 'Hello!' })
    expect(state.threads[0].messages.every((m) => m.read)).toBe(true)
    expect(state.threads[0].messages).toHaveLength(2)
  })
})

describe('live chat (customer side)', () => {
  const start = (state: AppState, extra: Partial<Extract<Action, { type: 'CUSTOMER_START_CHAT' }>> = {}) => {
    const result = applyAction(
      state,
      { type: 'CUSTOMER_START_CHAT', name: 'Joy Wairimu', phone: '0712 345 678', startedFrom: 'CHAT_LINK', text: 'Hi! Do you deliver to Thika?', ...extra },
      NOW,
    )
    if (!result.ok) throw new Error(result.error)
    return { state: result.state, threadId: result.threadId! }
  }

  it('starts a chat as the customer, without a signed-in user', () => {
    const { state, threadId } = start(emptyState({ currentUserId: 'nobody' }))
    const thread = state.threads.find((t) => t.id === threadId)!
    expect(state.customers).toHaveLength(1)
    expect(thread.messages.map((m) => m.from)).toEqual(['SHOP', 'CUSTOMER'])
    expect(thread.messages[1].read).toBe(false)
  })

  it('reuses the same conversation when the customer comes back with the same number', () => {
    const first = start(emptyState())
    const again = start(first.state, { name: 'Joy W', phone: '+254 712 345 678', text: 'Me again' })
    expect(again.threadId).toBe(first.threadId)
    expect(again.state.threads).toHaveLength(2)
    expect(again.state.customers).toHaveLength(1)
  })

  it('requires a name and a phone number', () => {
    expect(applyAction(emptyState(), { type: 'CUSTOMER_START_CHAT', name: '', phone: '0712345678', startedFrom: 'CHAT_LINK' }, NOW).ok).toBe(false)
    expect(applyAction(emptyState(), { type: 'CUSTOMER_START_CHAT', name: 'Joy', phone: '123', startedFrom: 'CHAT_LINK' }, NOW).ok).toBe(false)
  })

  it('sends one automatic away reply while she is away', () => {
    const away = apply(emptyState(), { type: 'SET_CHAT_STATUS', status: 'AWAY' })
    let { state, threadId } = start(away)
    state = apply(state, { type: 'CUSTOMER_SEND_MESSAGE', threadId, text: 'Hello?' })
    const autos = state.threads.find((t) => t.id === threadId)!.messages.filter((m) => m.by === AUTO_REPLY && m.text.startsWith('Thanks for your message'))
    expect(autos).toHaveLength(1)
  })

  it('lets the customer pay from the chat, which moves the order to pending', () => {
    const created = createPaidOrder(emptyState(), { payment: { kind: 'SEND_LINK' } })
    const state = apply(created.state, { type: 'CUSTOMER_PAY', orderId: created.orderId, reference: 'sab12cd34e' })
    const order = state.orders[0]
    expect(order).toMatchObject({ status: 'PENDING', payment: { status: 'PAID', reference: 'SAB12CD34E' } })
    expect(order.history.at(-1)!.by).toBe('customer')
    expect(state.threads[0].messages.at(-1)!.from).toBe('SYSTEM')
  })

  it('records when the customer has seen the shop’s replies', () => {
    const state = apply(emptyState(), { type: 'CUSTOMER_READ', threadId: 't-1' })
    expect(state.threads[0].customerReadAt).toBe(NOW.toISOString())
  })
})

describe('sign-in and roles', () => {
  it('reads the team list from configuration', () => {
    const staff = parseStaffList(' You@Gmail.com:super_admin, her@gmail.com , broken ,x@y.com:ADMIN')
    expect([...staff.entries()]).toEqual([
      ['you@gmail.com', 'SUPER_ADMIN'],
      ['her@gmail.com', 'ADMIN'],
      ['x@y.com', 'ADMIN'],
    ])
    expect(staffRoleFor('HER@gmail.com', staff, USERS)).toBe('ADMIN')
    expect(staffRoleFor('owner@example.com', new Map(), USERS)).toBe('ADMIN')
    expect(staffRoleFor('customer@example.com', staff, USERS)).toBeNull()
  })

  it('signs a team member in, adding them to the team on first sign-in', () => {
    let state = apply(emptyState({ currentUserId: '' }), { type: 'SIGN_IN_STAFF', email: 'her@gmail.com', name: 'Her', role: 'ADMIN' })
    const user = state.users.find((u) => u.email === 'her@gmail.com')!
    expect(state.currentUserId).toBe(user.id)
    expect(applyAction(state, { type: 'UPDATE_SETTINGS', patch: { serviceFee: 50 } }, NOW).ok).toBe(false)
    state = apply(state, { type: 'SIGN_OUT' })
    expect(applyAction(state, { type: 'SET_CHAT_STATUS', status: 'AWAY' }, NOW).ok).toBe(false)
  })
})

describe('client portal', () => {
  const link = (state: AppState, extra: Partial<Extract<Action, { type: 'CUSTOMER_LINK_ACCOUNT' }>> = {}) => {
    const result = applyAction(state, { type: 'CUSTOMER_LINK_ACCOUNT', email: 'joy@example.com', name: 'Joy Wairimu', phone: '0712 345 678', ...extra }, NOW)
    if (!result.ok) throw new Error(result.error)
    return { state: result.state, customerId: result.customerId! }
  }

  it('creates a customer for a new Google account', () => {
    const { state, customerId } = link(emptyState({ currentUserId: '' }))
    expect(state.customers.find((c) => c.id === customerId)).toMatchObject({ email: 'joy@example.com', phone: '0712 345 678' })
  })

  it('links to the existing customer with the same phone, keeping their history', () => {
    const chat = applyAction(emptyState(), { type: 'CUSTOMER_START_CHAT', name: 'Joy', phone: '+254712345678', startedFrom: 'CHAT_LINK' }, NOW)
    if (!chat.ok) throw new Error(chat.error)
    const { state, customerId } = link(chat.state)
    expect(state.customers).toHaveLength(1)
    expect(state.threads.find((t) => t.customerId === customerId)).toBeDefined()
    // Signing in again finds them by email, with no phone needed.
    expect(link(state, { phone: '' }).customerId).toBe(customerId)
  })

  it('places a portal order as the customer, and only lets them pay their own orders', () => {
    const { state: linked, customerId } = link(emptyState({ currentUserId: '' }))
    const placed = applyAction(
      linked,
      { type: 'CUSTOMER_PLACE_ORDER', draft: draft({ channel: 'PORTAL', threadId: undefined, customerId, customerName: 'Joy Wairimu', payment: { kind: 'UNPAID' } }) },
      NOW,
    )
    if (!placed.ok) throw new Error(placed.error)
    const order = placed.state.orders[0]
    expect(order).toMatchObject({ channel: 'PORTAL', customerId, status: 'PENDING_PAYMENT' })
    expect(order.history[0].by).toBe('customer')
    expect(applyAction(placed.state, { type: 'CUSTOMER_PAY', orderId: order.id, reference: 'X1', customerId: 'someone-else' }, NOW).ok).toBe(false)
    expect(applyAction(placed.state, { type: 'CUSTOMER_PAY', orderId: order.id, reference: 'X1', customerId }, NOW).ok).toBe(true)
  })

  it('saves a guest order to the account created right after checkout', () => {
    const placed = applyAction(
      emptyState({ currentUserId: '' }),
      { type: 'CUSTOMER_PLACE_ORDER', draft: draft({ channel: 'WEB_FORM', threadId: undefined, instagram: undefined, customerName: 'Joy Wairimu', phone: '0712 345 678', payment: { kind: 'UNPAID' } }) },
      NOW,
    )
    if (!placed.ok) throw new Error(placed.error)
    const orderId = placed.createdOrderId!
    // Signs up with a new email: the guest customer gets the email, and keeps the order.
    const { state, customerId } = link(placed.state, { email: 'joy@example.com', name: '', phone: '', claimOrderId: orderId })
    expect(state.customers).toHaveLength(1)
    expect(state.orders[0].customerId).toBe(customerId)
    expect(state.customers[0].email).toBe('joy@example.com')
  })

  it('moves a guest order into an existing account when a returning customer signs in after checkout', () => {
    const { state: withAccount, customerId } = link(emptyState({ currentUserId: '' }))
    const placed = applyAction(
      withAccount,
      { type: 'CUSTOMER_PLACE_ORDER', draft: draft({ channel: 'WEB_FORM', threadId: undefined, instagram: undefined, customerName: 'Joy', phone: '0799 000 111', payment: { kind: 'UNPAID' } }) },
      NOW,
    )
    if (!placed.ok) throw new Error(placed.error)
    const { state } = link(placed.state, { phone: '', claimOrderId: placed.createdOrderId! })
    expect(state.orders.find((o) => o.id === placed.createdOrderId)!.customerId).toBe(customerId)
  })

  it('does not let customers create orders as live chat or manual orders', () => {
    expect(applyAction(emptyState(), { type: 'CUSTOMER_PLACE_ORDER', draft: draft({ channel: 'MANUAL', threadId: undefined }) }, NOW).ok).toBe(false)
  })

  it('only lets a customer edit their own profile', () => {
    const { state, customerId } = link(emptyState())
    expect(applyAction(state, { type: 'CUSTOMER_UPDATE_PROFILE', customerId, email: 'other@example.com', patch: { name: 'X' } }, NOW).ok).toBe(false)
    const updated = apply(state, { type: 'CUSTOMER_UPDATE_PROFILE', customerId, email: 'joy@example.com', patch: { address: 'Thika' } })
    expect(updated.customers[0].address).toBe('Thika')
  })
})

describe('live-mode safeguards', () => {
  it('records a Paystack payment once, and only for the right amount', () => {
    const created = createPaidOrder(emptyState(), { payment: { kind: 'UNPAID' } })
    const wrong = applyAction(created.state, { type: 'PAYMENT_RECEIVED', orderId: created.orderId, method: 'MPESA', reference: 'ps_1', amount: 100 }, NOW)
    expect(wrong.ok).toBe(false)
    const paid = apply(created.state, { type: 'PAYMENT_RECEIVED', orderId: created.orderId, method: 'MPESA', reference: 'ps_1', amount: 3800 })
    expect(paid.orders[0]).toMatchObject({ status: 'PENDING', payment: { status: 'PAID', reference: 'PS_1' } })
    expect(paid.orders[0].history.at(-1)!.by).toBe('paystack')
    // The same notification again changes nothing.
    const again = applyAction(paid, { type: 'PAYMENT_RECEIVED', orderId: created.orderId, method: 'MPESA', reference: 'ps_1', amount: 3800 }, NOW)
    expect(again.ok && again.state.orders).toEqual(paid.orders)
  })

  it('can keep a new chat separate from a customer’s existing conversation', () => {
    const first = applyAction(emptyState(), { type: 'CUSTOMER_START_CHAT', name: 'Joy', phone: '0712345678', startedFrom: 'CHAT_LINK' }, NOW)
    if (!first.ok) throw new Error(first.error)
    const second = applyAction(first.state, { type: 'CUSTOMER_START_CHAT', name: 'Joy', phone: '0712345678', startedFrom: 'CHAT_LINK', newThread: true }, NOW)
    if (!second.ok) throw new Error(second.error)
    expect(second.threadId).not.toBe(first.threadId)
    expect(second.state.customers).toHaveLength(1)
  })

  it('does not bring over orders by phone number when phone matching is off', () => {
    const guest = applyAction(
      emptyState(),
      { type: 'CUSTOMER_PLACE_ORDER', draft: draft({ channel: 'WEB_FORM', threadId: undefined, instagram: undefined, customerName: 'Joy', phone: '0712 345 678', payment: { kind: 'UNPAID' } }) },
      NOW,
    )
    if (!guest.ok) throw new Error(guest.error)
    const linked = applyAction(guest.state, { type: 'CUSTOMER_LINK_ACCOUNT', email: 'joy@example.com', name: 'Joy', phone: '0712 345 678', allowPhoneMatch: false }, NOW)
    if (!linked.ok) throw new Error(linked.error)
    expect(linked.state.customers).toHaveLength(2)
    expect(linked.state.orders[0].customerId).not.toBe(linked.customerId)
  })
})

describe('seed data', () => {
  const state = createSeedState(NOW)

  it('is internally consistent', () => {
    const ids = new Set(state.orders.map((o) => o.id))
    expect(ids.size).toBe(state.orders.length)
    for (const order of state.orders) {
      expect(state.customers.some((c) => c.id === order.customerId)).toBe(true)
      expect(new Date(order.createdAt).getTime()).toBeLessThanOrEqual(NOW.getTime())
      for (const h of order.history) expect(new Date(h.at).getTime()).toBeLessThanOrEqual(NOW.getTime())
      if (order.fulfilment.method === 'HAND_DELIVERY') expect(order.fulfilment.deliveryFee).toBe(0)
    }
    const charged = state.orders.filter((o) => o.status === 'SHIPPED' || o.status === 'REFUNDED')
    expect(state.fees).toHaveLength(charged.length)
  })

  it('has five unread messages and a mix of statuses', () => {
    const unread = state.threads.flatMap((t) => t.messages).filter((m) => m.from === 'CUSTOMER' && !m.read)
    expect(unread).toHaveLength(5)
    const statuses = new Set(state.orders.map((o) => o.status))
    for (const s of ['PENDING_PAYMENT', 'PENDING', 'PROCESSING', 'SHIPPED', 'REFUNDED', 'CANCELLED']) {
      expect(statuses.has(s as never)).toBe(true)
    }
    expect(feeSummary(state).payable).toBeGreaterThan(0)
  })

  it('is deterministic', () => {
    expect(createSeedState(NOW)).toEqual(state)
  })
})
