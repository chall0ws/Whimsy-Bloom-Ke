import { COURIERS, DEFAULT_SETTINGS, MATERIALS, PRODUCTS, RECIPES, USERS } from './catalog'
import { formatKES } from './format'
import { orderTotal, STATUS_LABEL } from './orders'
import { startOfWeek } from './metrics'
import type {
  AppState,
  AuditEvent,
  Channel,
  Customer,
  FeeEntry,
  MaterialMovement,
  Message,
  Order,
  OrderStatus,
  Payout,
  StatusEvent,
  Thread,
} from './types'

export const STATE_VERSION = 3

const OWNER = 'u-owner'
const PARTNER = 'u-partner'
const HOUR = 3_600_000
const DAY = 24 * HOUR

/**
 * Builds a realistic, internally consistent demo dataset relative to `now`:
 * every KPI, chart and fee figure is derived from these orders, never hard-coded.
 */
export function createSeedState(now: Date, seed = 20261009): AppState {
  const rand = mulberry32(seed)
  const g = new Gen(rand, now)

  const customers = g.customers()
  const orders = g.historicalOrders(customers)
  const story = g.storyline(customers, orders)

  // Number orders in the order they were placed.
  orders.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  orders.forEach((o, i) => (o.number = `WB-${1001 + i}`))

  const threads = story.buildThreads()
  const fees = buildFees(orders)
  const payouts = buildPayouts(fees, now, rand)
  const movements = buildMovements(orders, now, rand)
  const audit = buildAudit(orders, payouts, movements, now)

  return {
    version: STATE_VERSION,
    users: USERS,
    currentUserId: OWNER,
    products: PRODUCTS,
    materials: MATERIALS.map((m) => ({ ...m })),
    recipes: RECIPES,
    customers,
    orders: orders.reverse(),
    threads,
    fees,
    payouts,
    movements,
    audit,
    settings: { ...DEFAULT_SETTINGS },
    chatStatus: 'ONLINE',
    nextOrderNumber: 1001 + orders.length,
    nextId: 1000,
  }
}

const FIRST = [
  'Wanjiru', 'Achieng', 'Brian', 'Faith', 'Kevin', 'Mercy', 'Amina', 'Grace', 'Dennis', 'Lucy', 'Ivy', 'Sharon',
  'Joy', 'Tom', 'Esther', 'Naomi', 'Cynthia', 'Peter', 'Linda', 'Ruth', 'Diana', 'Collins', 'Purity', 'Stacy',
  'Wambui', 'Halima', 'Moses', 'Beatrice', 'Elsie', 'Victor', 'Nadia', 'Teresa',
]
const LAST = [
  'Kamau', 'Otieno', 'Mwangi', 'Njeri', 'Odhiambo', 'Wambui', 'Hassan', 'Mutua', 'Kiprop', 'Chebet', 'Akinyi',
  'Nyambura', 'Wairimu', 'Ochieng', 'Moraa', 'Jepchirchir', 'Atieno', 'Kariuki', 'Mumbi', 'Wangari', 'Omondi', 'Kendi',
]
const NAIROBI = ['Kilimani', 'Westlands', 'Kileleshwa', 'Lavington', 'Karen', 'South B', 'Ruaka', 'Kasarani', 'Parklands', 'Langata']
const UPCOUNTRY = ['Kisumu', 'Mombasa', 'Nakuru', 'Eldoret', 'Nyeri', 'Thika', 'Machakos', 'Kitengela']
const NOTES = [
  'Prefers soft pink tulips.',
  'Always asks for no glitter.',
  'Orders for her mum’s birthday every March.',
  'Likes kraft paper wrapping with a satin ribbon.',
  'Gifts for colleagues — keep receipts formal.',
  'Allergic-friendly gift buyer: wants scent-free.',
]
const CUSTOMISATIONS = [
  '',
  '',
  'Card: “Happy birthday, Mum!”',
  'Blush ribbon instead of white.',
  'Add a small handwritten card.',
  'Extra greenery please.',
  'Card: “Congratulations on the new job!”',
  'Wrap in kraft paper.',
]
const PRODUCT_WEIGHTS: [string, number][] = [
  ['p-pink-lily', 30],
  ['p-tulip', 20],
  ['p-giant-rose', 15],
  ['p-peony', 14],
  ['p-rosebud-box', 12],
  ['p-sunflower', 9],
]

class Gen {
  private seq = 0
  constructor(
    private rand: () => number,
    private now: Date,
  ) {}

  id(prefix: string) {
    return `seed-${prefix}-${++this.seq}`
  }
  pick<T>(xs: readonly T[]): T {
    return xs[Math.floor(this.rand() * xs.length)]
  }
  int(min: number, max: number) {
    return min + Math.floor(this.rand() * (max - min + 1))
  }
  chance(p: number) {
    return this.rand() < p
  }
  weighted(pairs: [string, number][]): string {
    const total = pairs.reduce((s, [, w]) => s + w, 0)
    let r = this.rand() * total
    for (const [v, w] of pairs) if ((r -= w) < 0) return v
    return pairs[0][0]
  }
  /** A time `daysAgo` days back, during working hours, and never in the future. */
  at(daysAgo: number): Date {
    const d = new Date(this.now.getTime() - daysAgo * DAY)
    d.setHours(this.int(8, 20), this.int(0, 59), 0, 0)
    return d > this.now ? new Date(this.now.getTime() - this.int(5, 50) * 60_000) : d
  }
  mpesaRef() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789'
    let s = 'S'
    for (let i = 0; i < 9; i++) s += chars[Math.floor(this.rand() * chars.length)]
    return s
  }
  phone() {
    return `+254 7${this.int(10, 99)} ${this.int(100, 999)} ${this.int(100, 999)}`
  }

  customers(): Customer[] {
    const used = new Set<string>()
    const out: Customer[] = []
    while (out.length < 52) {
      const first = this.pick(FIRST)
      const last = this.pick(LAST)
      const name = `${first} ${last}`
      if (used.has(name)) continue
      used.add(name)
      // Skewed towards recent dates so customer growth trends upward.
      const daysAgo = 84 * Math.pow(this.rand(), 1.5)
      const hasIg = this.chance(0.5)
      const notes = this.chance(0.25) ? this.pick(NOTES) : ''
      out.push({
        id: this.id('c'),
        name,
        instagram: hasIg ? `@${first.toLowerCase()}.${last.toLowerCase().slice(0, 4)}` : undefined,
        phone: this.chance(0.8) ? this.phone() : undefined,
        email: this.chance(0.3) ? `${first.toLowerCase()}.${last.toLowerCase()}@example.com` : undefined,
        notes,
        tags: [],
        createdAt: this.at(daysAgo).toISOString(),
      })
    }
    return out
  }

  historicalOrders(customers: Customer[]): Order[] {
    const orders: Order[] = []
    for (const c of customers) {
      const first = new Date(c.createdAt)
      orders.push(this.order(c, first))
      const span = (this.now.getTime() - first.getTime()) / DAY
      if (span > 7 && this.chance(0.35)) orders.push(this.order(c, this.at(this.rand() * (span - 1))))
      if (span > 20 && this.chance(0.12)) orders.push(this.order(c, this.at(this.rand() * (span - 1))))
      const count = orders.filter((o) => o.customerId === c.id).length
      if (count >= 2) c.tags = ['Repeat']
      if (count >= 3) c.tags = ['Repeat', 'VIP']
    }
    // A cancellation and a post-shipping refund, so those states show up.
    const shipped = orders.filter((o) => o.status === 'SHIPPED')
    const toRefund = shipped[3]
    if (toRefund) {
      const at = new Date(new Date(toRefund.shippedAt!).getTime() + 2 * DAY)
      if (at < this.now) {
        toRefund.status = 'REFUNDED'
        const subtotal = orderTotal(toRefund) - toRefund.fulfilment.deliveryFee
        toRefund.payment = { ...toRefund.payment, status: 'REFUNDED', refundedAmount: subtotal }
        toRefund.history.push({ status: 'REFUNDED', at: at.toISOString(), by: OWNER, note: 'Damaged in transit' })
      }
    }
    const toCancel = orders.find((o) => o.status === 'SHIPPED' && o !== toRefund && o.items[0].qty === 1)
    if (toCancel) cancelBeforeProcessing(toCancel)
    return orders
  }

  order(c: Customer, createdAt: Date, opts: Partial<{ productId: string; qty: number; channel: Channel; status: OrderStatus; hand: boolean }> = {}): Order {
    const channel: Channel =
      opts.channel ?? (this.chance(0.45) ? 'LIVE_CHAT' : this.chance(0.85) ? 'WEB_FORM' : 'MANUAL')
    const productId = opts.productId ?? this.weighted(PRODUCT_WEIGHTS)
    const qty = opts.qty ?? (this.chance(0.15) ? 2 : 1)
    const hand = opts.hand ?? this.chance(0.4)
    const product = PRODUCTS.find((p) => p.id === productId)!
    const created = createdAt.getTime()
    // Event times never land in the future, even for orders forced into a later status.
    const clamp = (t: number) => new Date(Math.min(t, Math.max(created, this.now.getTime() - 60_000)))
    const rawProcessing = created + (0.3 + this.rand() * 1.2) * DAY
    const rawShipped = rawProcessing + (0.6 + this.rand() * 1.4) * DAY
    const nowMs = this.now.getTime()
    let status: OrderStatus =
      opts.status ?? (rawShipped <= nowMs ? 'SHIPPED' : rawProcessing <= nowMs ? 'PROCESSING' : 'PENDING')
    const paidAt = clamp(created + this.int(2, 40) * 60_000)
    const processingAt = clamp(rawProcessing)
    const shippedAt = clamp(rawShipped)
    // Some of the newest orders are still waiting for the customer to pay.
    if (!opts.status && status === 'PENDING' && this.now.getTime() - created < DAY && this.chance(0.35)) {
      status = 'PENDING_PAYMENT'
    }
    const unpaid = status === 'PENDING_PAYMENT'

    const history: StatusEvent[] = []
    const by = channel === 'WEB_FORM' ? 'customer' : OWNER
    if (unpaid || channel !== 'WEB_FORM') history.push({ status: 'PENDING_PAYMENT', at: createdAt.toISOString(), by })
    if (!unpaid) history.push({ status: 'PENDING', at: paidAt.toISOString(), by, note: 'Payment confirmed' })
    if (status === 'PROCESSING' || status === 'SHIPPED') history.push({ status: 'PROCESSING', at: processingAt.toISOString(), by: OWNER })
    if (status === 'SHIPPED') history.push({ status: 'SHIPPED', at: shippedAt.toISOString(), by: OWNER })

    const courier = this.pick(COURIERS)
    return {
      id: this.id('o'),
      number: '',
      customerId: c.id,
      channel,
      items: [{ productId, qty, unitPrice: product.price }],
      customisation: this.pick(CUSTOMISATIONS),
      fulfilment: hand
        ? { method: 'HAND_DELIVERY', address: `${this.pick(NAIROBI)}, Nairobi`, deliveryFee: 0 }
        : {
            method: 'SHIPPING',
            address: this.chance(0.5) ? `${this.pick(NAIROBI)}, Nairobi` : this.pick(UPCOUNTRY),
            deliveryFee: DEFAULT_SETTINGS.defaultShippingFee,
            courier: status === 'SHIPPED' ? courier : undefined,
            trackingNumber: status === 'SHIPPED' ? `${courier.split(' ')[0].toUpperCase()}-${this.int(100000, 999999)}` : undefined,
          },
      payment: unpaid
        ? { status: 'UNPAID' }
        : { status: 'PAID', method: this.chance(0.85) ? 'MPESA' : 'CARD', reference: this.mpesaRef(), paidAt: paidAt.toISOString() },
      status,
      createdAt: createdAt.toISOString(),
      shippedAt: status === 'SHIPPED' ? shippedAt.toISOString() : undefined,
      history,
      materialsDeducted: status === 'PROCESSING' || status === 'SHIPPED',
    }
  }

  /** Hand-written customers, orders and live chats so the inbox reads like a real one. */
  storyline(customers: Customer[], orders: Order[]) {
    const now = this.now.getTime()
    const ago = (minutes: number) => new Date(now - minutes * 60_000).toISOString()
    const person = (name: string, extra: Partial<Customer>, createdMinutesAgo: number): Customer => {
      const c: Customer = { id: this.id('c'), name, notes: '', tags: [], createdAt: ago(createdMinutesAgo), ...extra }
      customers.push(c)
      return c
    }
    const linked = (c: Customer, minutesAgo: number, opts: Parameters<Gen['order']>[2], customisation = '') => {
      const o = this.order(c, new Date(now - minutesAgo * 60_000), opts)
      o.customisation = customisation
      orders.push(o)
      return o
    }

    const wanjiru = person('Wanjiru Kamau', { instagram: '@wanjiru.blooms', phone: this.phone() }, 40)
    const achieng = person('Achieng Otieno', { instagram: '@achieng.o', phone: this.phone() }, 185)
    const brian = person('Brian Mwangi', { phone: this.phone() }, 260)
    const faith = person(
      'Faith Njeri',
      { instagram: '@faith.njeri', phone: this.phone(), email: 'faith.njeri@example.com', address: 'Kileleshwa, Nairobi', notes: 'Prefers soft pink tulips. Usually orders for her sister’s birthday.', tags: ['Repeat', 'VIP'] },
      60 * 24 * 70,
    )
    const kevin = person('Kevin Odhiambo', { phone: this.phone() }, 300)
    const mercy = person('Mercy Wambui', { instagram: '@mercy.wambui', phone: this.phone() }, 60 * 26)
    const amina = person('Amina Hassan', { instagram: '@amina.h', phone: this.phone() }, 60 * 24 * 4)
    const grace = person(
      'Grace Mutua',
      { phone: this.phone(), email: 'grace.mutua@example.com', notes: 'Office events — asks for formal receipts.', tags: ['Corporate'] },
      60 * 24 * 5,
    )

    const achiengOrder = linked(achieng, 175, { productId: 'p-tulip', qty: 2, channel: 'LIVE_CHAT', status: 'PENDING_PAYMENT', hand: true }, 'Card: “Happy anniversary, love A.”')
    achiengOrder.fulfilment = { method: 'HAND_DELIVERY', address: 'Kilimani, Nairobi', deliveryFee: 0 }
    const brianOrder = linked(brian, 250, { productId: 'p-giant-rose', qty: 1, channel: 'LIVE_CHAT', status: 'PENDING', hand: false }, 'Deep red with gold-edged petals.')
    const mercyOrder = linked(mercy, 60 * 25, { productId: 'p-pink-lily', qty: 1, channel: 'LIVE_CHAT', status: 'PROCESSING', hand: true }, 'Blush ribbon.')
    const aminaOrder = linked(amina, 60 * 24 * 4, { productId: 'p-peony', qty: 1, channel: 'LIVE_CHAT' }, 'Card: “For the best teacher.”')
    for (const daysAgo of [68, 40, 12]) {
      linked(faith, daysAgo * 24 * 60, { productId: 'p-tulip', qty: 1, channel: 'LIVE_CHAT' }, 'Soft pink tulips, white ribbon.')
    }
    achiengOrder.payment.linkSentAt = ago(160)

    const msg = (from: Message['from'], minutesAgo: number, text: string, read = true, extra: Partial<Message> = {}): Message => ({
      id: this.id('m'),
      from,
      text,
      at: ago(minutesAgo),
      read: from === 'CUSTOMER' ? read : true,
      by: from === 'SHOP' ? OWNER : undefined,
      ...extra,
    })
    const greeting = (c: Customer, minutesAgo: number) =>
      msg('SHOP', minutesAgo, `Hi ${c.name.split(' ')[0]}! 🌸 Welcome to Whimsy & Bloom. How can we help?`, true, { by: 'auto' })
    // The customer has seen everything up to their own latest message.
    const thread = (c: Customer, startedFrom: Thread['startedFrom'], messages: Message[]): Thread => ({
      id: this.id('t'),
      customerId: c.id,
      startedFrom,
      startedAt: messages[0].at,
      messages,
      customerReadAt: [...messages].reverse().find((m) => m.from === 'CUSTOMER')?.at,
    })

    // Messages that mention order numbers are built after numbering.
    return {
      buildThreads: (): Thread[] => {
        const threads = [
          thread(wanjiru, 'CHAT_LINK', [
            greeting(wanjiru, 36),
            msg('CUSTOMER', 35, 'Hi! Do you make the Bespoke Pink Lily in a bigger size? 😍', false),
            msg('CUSTOMER', 33, 'It’s for my mum’s birthday on Saturday. Delivery to Lavington.', false),
          ]),
          thread(achieng, 'CHAT_LINK', [
            greeting(achieng, 181),
            msg('CUSTOMER', 180, 'Hello, I’d like the Soft Pink Tulips, 2 bouquets, delivered to Kilimani please'),
            msg('SHOP', 178, 'Hi Achieng! Absolutely 🌷 Would you like a card message with them?'),
            msg('CUSTOMER', 176, 'Yes please: “Happy anniversary, love A.”'),
            msg('SHOP', 160, `Here’s your payment link for order ${achiengOrder.number} (${formatKES(orderTotal(achiengOrder))}). Tap below to pay with M-Pesa 💳`, true, {
              kind: 'PAYMENT_LINK',
              orderId: achiengOrder.id,
            }),
            msg('CUSTOMER', 62, 'Will pay in a bit, thank you!', false),
          ]),
          thread(brian, 'ORDER_FORM', [
            greeting(brian, 263),
            msg('CUSTOMER', 262, 'Hey, I saw the Giant Rose on your Instagram. Can you do deep red with gold edges?'),
            msg('SHOP', 255, 'Hi Brian! Yes we can 🌹 That’s KES 4,800 plus KES 300 courier delivery.'),
            msg('CUSTOMER', 252, 'Perfect, deliver to Westlands. Paying now.'),
            msg('SYSTEM', 246, `Payment received for ${brianOrder.number} · M-Pesa ${brianOrder.payment.reference}`),
          ]),
          thread(faith, 'CHAT_LINK', [
            greeting(faith, 60 * 24 * 12 + 11),
            msg('CUSTOMER', 60 * 24 * 12 + 10, 'Same tulips as last time please 💕'),
            msg('SHOP', 60 * 24 * 12, 'Of course Faith! Soft pink with the white ribbon. Sending the link now.'),
            msg('CUSTOMER', 60 * 20, 'Hey love! Can I get the same again for my sister? Her birthday is next week 😊', false),
          ]),
          thread(kevin, 'ORDER_FORM', [
            greeting(kevin, 291),
            msg('CUSTOMER', 290, 'Do you deliver to Kisumu? How much would a Peony Posy cost to get there?', false),
          ]),
          thread(mercy, 'CHAT_LINK', [
            greeting(mercy, 60 * 26 + 1),
            msg('CUSTOMER', 60 * 26, 'Hi! One Bespoke Pink Lily please, I’ll collect… actually can you deliver to Ruaka?'),
            msg('SHOP', 60 * 25, `Sure Mercy! Order ${mercyOrder.number} is confirmed 🌸 We’ll hand-deliver it to you.`),
            msg('SHOP', 60 * 3, 'Quick question: would you like a lilac or blush ribbon?'),
            msg('CUSTOMER', 60 * 2.5, 'Blush please! Thank you 💗'),
          ]),
          thread(amina, 'CHAT_LINK', [
            greeting(amina, 60 * 24 * 4 + 6),
            msg('CUSTOMER', 60 * 24 * 4 + 5, 'Hi, a Peony Posy for my daughter’s teacher please.'),
            msg('SHOP', 60 * 24 * 4, `Lovely! Order ${aminaOrder.number} is in 🌸`),
            msg('CUSTOMER', 60 * 6, 'Received it, it’s stunning!! 😭💕 She loved it.'),
          ]),
          thread(grace, 'ORDER_FORM', [
            greeting(grace, 60 * 24 * 5 + 1),
            msg('CUSTOMER', 60 * 24 * 5, 'Hello, we’d like 15 Rosebud Boxes for our office’s Women’s Day. Is there a bulk price?'),
            msg('SHOP', 60 * 24 * 5 - 30, 'Hi Grace! For 15 boxes we can do KES 1,600 each. When do you need them?'),
            msg('CUSTOMER', 60 * 24 * 4.8, 'Great, I’ll confirm with finance and get back to you.'),
          ]),
        ]
        achiengOrder.threadId = threads[1].id
        brianOrder.threadId = threads[2].id
        mercyOrder.threadId = threads[5].id
        aminaOrder.threadId = threads[6].id
        return threads
      },
    }
  }
}

function cancelBeforeProcessing(order: Order) {
  const paidEvent = order.history.find((h) => h.status === 'PENDING')!
  order.status = 'CANCELLED'
  order.shippedAt = undefined
  order.materialsDeducted = false
  order.fulfilment = { ...order.fulfilment, courier: undefined, trackingNumber: undefined }
  order.history = [
    ...order.history.filter((h) => h.status === 'PENDING_PAYMENT' || h.status === 'PENDING'),
    { status: 'CANCELLED', at: new Date(new Date(paidEvent.at).getTime() + 3 * HOUR).toISOString(), by: OWNER, note: 'Customer changed plans' },
  ]
  order.payment = { ...order.payment, status: 'REFUNDED', refundedAmount: orderTotal(order) }
}

function buildFees(orders: Order[]): FeeEntry[] {
  return orders
    .filter((o) => o.shippedAt && (o.status === 'SHIPPED' || o.status === 'REFUNDED'))
    .map((o) => ({ id: `seed-fee-${o.number}`, orderId: o.id, orderNumber: o.number, amount: DEFAULT_SETTINGS.serviceFee, at: o.shippedAt! }))
    .sort((a, b) => b.at.localeCompare(a.at))
}

/** Weekly payouts every Monday for the previous week. The latest one is still waiting for confirmation. */
function buildPayouts(fees: FeeEntry[], now: Date, rand: () => number): Payout[] {
  const thisWeek = startOfWeek(now)
  const payouts: Payout[] = []
  for (let w = 12; w >= 1; w--) {
    const start = new Date(thisWeek)
    start.setDate(start.getDate() - w * 7)
    const end = new Date(start)
    end.setDate(end.getDate() + 7)
    const amount = fees.filter((f) => new Date(f.at) >= start && new Date(f.at) < end).reduce((s, f) => s + f.amount, 0)
    if (amount === 0) continue
    const sentAt = new Date(end)
    sentAt.setHours(10, 15)
    if (sentAt > now) continue
    const latest = w === 1
    const ref = 'S' + Math.floor(rand() * 36 ** 9).toString(36).toUpperCase().padStart(9, '0')
    payouts.push({
      id: `seed-po-${w}`,
      amount,
      reference: ref,
      sentAt: sentAt.toISOString(),
      sentBy: OWNER,
      status: latest ? 'SENT' : 'CONFIRMED',
      confirmedAt: latest ? undefined : new Date(sentAt.getTime() + 2 * HOUR).toISOString(),
      confirmedBy: latest ? undefined : PARTNER,
    })
  }
  return payouts.reverse()
}

function buildMovements(orders: Order[], now: Date, rand: () => number): MaterialMovement[] {
  const moves: MaterialMovement[] = []
  const weekAgo = now.getTime() - 7 * DAY
  for (const o of orders) {
    const started = o.history.find((h) => h.status === 'PROCESSING')
    if (!o.materialsDeducted || !started || new Date(started.at).getTime() < weekAgo) continue
    for (const item of o.items) {
      for (const line of RECIPES[item.productId] ?? []) {
        moves.push({
          id: `seed-mv-${moves.length}`,
          materialId: line.materialId,
          delta: -line.qty * item.qty,
          reason: 'ORDER',
          orderNumber: o.number,
          at: started.at,
          by: OWNER,
        })
      }
    }
  }
  const purchases: [string, number, number, string][] = [
    ['m-crepe-pink', 10, 6, 'Kamukunji supplier'],
    ['m-wire', 200, 6, ''],
    ['m-wrap', 30, 4, 'Kraft + blush sheets'],
    ['m-crepe-red', 4, 9, ''],
    ['m-ribbon', 20, 2, 'Blush satin'],
  ]
  for (const [materialId, qty, daysAgo, note] of purchases) {
    const at = new Date(now.getTime() - daysAgo * DAY - rand() * 6 * HOUR)
    moves.push({ id: `seed-mv-${moves.length}`, materialId, delta: qty, reason: 'PURCHASE', note: note || undefined, at: at.toISOString(), by: OWNER })
  }
  return moves.sort((a, b) => b.at.localeCompare(a.at))
}

function buildAudit(orders: Order[], payouts: Payout[], movements: MaterialMovement[], now: Date): AuditEvent[] {
  const since = now.getTime() - 4 * DAY
  const events: AuditEvent[] = []
  for (const o of orders) {
    let prev: OrderStatus | undefined
    for (const h of o.history) {
      if (new Date(h.at).getTime() >= since) {
        events.push({
          id: `seed-a-${events.length}`,
          at: h.at,
          by: h.by,
          text: prev ? `${o.number}: ${STATUS_LABEL[prev]} → ${STATUS_LABEL[h.status]}` : `${o.number}: created (${formatKES(orderTotal(o))})`,
        })
      }
      prev = h.status
    }
  }
  for (const p of payouts) {
    if (new Date(p.sentAt).getTime() < since - 10 * DAY) continue
    events.push({ id: `seed-a-${events.length}`, at: p.sentAt, by: p.sentBy, text: `Recorded service-fee payout of ${formatKES(p.amount)} (ref ${p.reference})` })
    if (p.confirmedAt) {
      events.push({ id: `seed-a-${events.length}`, at: p.confirmedAt, by: PARTNER, text: `Confirmed receipt of payout ${p.reference} (${formatKES(p.amount)})` })
    }
  }
  for (const m of movements.filter((m) => m.reason === 'PURCHASE')) {
    const material = MATERIALS.find((x) => x.id === m.materialId)!
    events.push({ id: `seed-a-${events.length}`, at: m.at, by: m.by, text: `Recorded purchase: ${m.delta} ${material.unit} of ${material.name}` })
  }
  return events.sort((a, b) => b.at.localeCompare(a.at))
}

function mulberry32(a: number) {
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
