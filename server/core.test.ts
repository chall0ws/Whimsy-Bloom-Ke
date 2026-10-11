import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import type { Action, OrderDraft } from '../src/domain/actions'
import { createSeedState } from '../src/domain/seed'
import { forSale, PRODUCTS } from '../src/domain/catalog'
import { confirmPaystack, handleWebhook, readState, runAction, startPayment, type Caller, type Ctx, type PaystackApi, type PaystackTransaction } from './core'
import { diff, fromRecords, toMeta, toRecords } from './records'
import { MemoryRepo } from './repo'

const NOW = new Date('2026-10-10T12:00:00+03:00')
const staff = new Map([['partner@example.com', 'SUPER_ADMIN' as const], ['owner@example.com', 'ADMIN' as const]])
const owner: Caller = { email: 'owner@example.com', name: 'Owner', verified: true }
const joy: Caller = { email: 'joy@example.com', name: 'Joy Wairimu', verified: true }

function ctx(repo: MemoryRepo, caller: Caller | null, guestTokens: string[] = []): Ctx {
  return { repo, caller, guestTokens, staff, now: () => NOW }
}

const BOUQUET = forSale(PRODUCTS)[0]
const DEPOSIT = Math.ceil(BOUQUET.price / 2)

const draft = (over: Partial<OrderDraft> = {}): OrderDraft => ({
  customerName: 'Joy Wairimu',
  phone: '0712 345 678',
  channel: 'WEB_FORM',
  items: [{ productId: BOUQUET.id, qty: 1 }],
  customisation: '',
  method: 'SHIPPING',
  address: 'Thika',
  payment: { kind: 'UNPAID' },
  ...over,
})

class FakePaystack implements PaystackApi {
  initialized: Parameters<PaystackApi['initialize']>[0][] = []
  transactions = new Map<string, PaystackTransaction>()
  async initialize(input: Parameters<PaystackApi['initialize']>[0]) {
    this.initialized.push(input)
    this.transactions.set(input.reference, { status: 'abandoned', reference: input.reference, amount: input.amount, currency: 'KES', channel: 'mobile_money', metadata: { orderId: input.metadata.orderId } })
    return { authorization_url: `https://checkout.paystack.com/${input.reference}`, access_code: `ac_${input.reference}`, reference: input.reference }
  }
  async verify(reference: string) {
    const tx = this.transactions.get(reference)
    if (!tx) throw new Error('not found')
    return tx
  }
  pay(reference: string, amount?: number) {
    const tx = this.transactions.get(reference)!
    this.transactions.set(reference, { ...tx, status: 'success', amount: amount ?? tx.amount })
  }
}

async function guestOrder(repo: MemoryRepo) {
  const r = await runAction(ctx(repo, null), { type: 'CUSTOMER_PLACE_ORDER', draft: draft() })
  if (!r.ok) throw new Error(r.error)
  return r
}

describe('records', () => {
  it('round-trips the shop through rows without losing anything', () => {
    const state = createSeedState(NOW)
    const back = fromRecords(toRecords(state), toMeta(state))
    expect(back.orders).toEqual(state.orders)
    expect(back.products).toEqual(state.products)
    expect(back.recipes).toEqual(state.recipes)
    expect(back.threads.map((t) => t.id).sort()).toEqual(state.threads.map((t) => t.id).sort())
  })

  it('saves only what changed', () => {
    const state = createSeedState(NOW)
    const next = { ...state, chatStatus: 'AWAY' as const, orders: state.orders.map((o, i) => (i === 0 ? { ...o, customisation: 'changed' } : o)) }
    const d = diff(state, next)
    expect(d.upserts).toHaveLength(1)
    expect(d.deletes).toHaveLength(0)
    expect(d.meta.chatStatus).toBe('AWAY')
  })
})

describe('server rules', () => {
  it('starts a new shop with the catalogue and nothing else', async () => {
    const repo = new MemoryRepo()
    const state = await readState(ctx(repo, null))
    expect(state.products).toHaveLength(PRODUCTS.length)
    expect(state.orders).toHaveLength(0)
    expect(repo.version).toBe(1)
  })

  it('gives a guest a secret for their order, and only that browser sees it', async () => {
    const repo = new MemoryRepo()
    const placed = await guestOrder(repo)
    expect(placed.ok && placed.guestToken).toBeTruthy()
    if (!placed.ok) return
    expect(placed.state.orders).toHaveLength(1)
    expect((await readState(ctx(repo, null))).orders).toHaveLength(0)
    expect((await readState(ctx(repo, null, [placed.guestToken!]))).orders).toHaveLength(1)
    expect(repo.notified.length).toBeGreaterThan(0)
  })

  it('refuses payments sent from a browser', async () => {
    const repo = new MemoryRepo()
    const placed = await guestOrder(repo)
    if (!placed.ok) throw new Error()
    const paid = await runAction(ctx(repo, null, [placed.guestToken!]), { type: 'CUSTOMER_PAY', orderId: placed.createdOrderId!, reference: 'FAKE' })
    expect(paid).toMatchObject({ ok: false, status: 403 })
    const placePaid = await runAction(ctx(repo, null), { type: 'CUSTOMER_PLACE_ORDER', draft: draft({ payment: { kind: 'PAID', method: 'MPESA', reference: 'X' } }) })
    expect(placePaid.ok).toBe(false)
  })

  it('keeps dashboard actions for verified team members', async () => {
    const repo = MemoryRepo.from(createSeedState(NOW))
    const order = (await repo.load()).state.orders.find((o) => o.status === 'PENDING')!
    const move: Action = { type: 'SET_STATUS', orderId: order.id, status: 'PROCESSING' }
    expect(await runAction(ctx(repo, null), move)).toMatchObject({ ok: false, status: 403 })
    expect(await runAction(ctx(repo, joy), move)).toMatchObject({ ok: false, status: 403 })
    expect(await runAction(ctx(repo, { ...owner, verified: false }), move)).toMatchObject({ ok: false, status: 403 })
    const done = await runAction(ctx(repo, owner), move)
    expect(done.ok).toBe(true)
    // The owner can't do super-admin things.
    expect((await runAction(ctx(repo, owner), { type: 'UPDATE_SETTINGS', patch: { serviceFee: 0 } })).ok).toBe(false)
    expect((await runAction(ctx(repo, { email: 'partner@example.com', name: 'P', verified: true }), { type: 'UPDATE_SETTINGS', patch: { serviceFee: 120 } })).ok).toBe(true)
  })

  it('shows customers only their own orders, without the team’s notes', async () => {
    const repo = MemoryRepo.from(createSeedState(NOW))
    const faith: Caller = { email: 'faith.njeri@example.com', name: 'Faith Njeri', verified: true }
    const view = await readState(ctx(repo, faith))
    expect(view.orders.length).toBeGreaterThan(0)
    expect(view.orders.every((o) => view.customers.some((c) => c.id === o.customerId && c.email === 'faith.njeri@example.com'))).toBe(true)
    expect(view.customers[0].notes).toBe('')
    expect(view.fees).toHaveLength(0)
    expect(view.settings.serviceFee).toBe(0)
  })

  it('uses the signed-in email, not the one the browser sends', async () => {
    const repo = new MemoryRepo()
    const r = await runAction(ctx(repo, joy), { type: 'CUSTOMER_LINK_ACCOUNT', email: 'someone-else@example.com', name: 'Joy', phone: '0712345678' })
    expect(r.ok && r.state.customers[0].email).toBe('joy@example.com')
  })

  it('only lets a guest save an order to their account from the browser that placed it', async () => {
    const repo = new MemoryRepo()
    const placed = await guestOrder(repo)
    if (!placed.ok) throw new Error()
    const stranger = await runAction(ctx(repo, joy), { type: 'CUSTOMER_LINK_ACCOUNT', email: '', name: 'Joy', phone: '0712345678', claimOrderId: placed.createdOrderId })
    expect(stranger.ok).toBe(false)
    const owner = await runAction(ctx(repo, joy, [placed.guestToken!]), { type: 'CUSTOMER_LINK_ACCOUNT', email: '', name: 'Joy', phone: '', claimOrderId: placed.createdOrderId })
    expect(owner.ok && owner.state.orders).toHaveLength(1)
  })

  it('gives a guest a fresh chat instead of someone else’s history', async () => {
    const repo = new MemoryRepo()
    const first = await runAction(ctx(repo, null), { type: 'CUSTOMER_START_CHAT', name: 'Joy', phone: '0712345678', startedFrom: 'CHAT_LINK', text: 'Private question' })
    if (!first.ok) throw new Error()
    const other = await runAction(ctx(repo, null), { type: 'CUSTOMER_START_CHAT', name: 'Not Joy', phone: '0712345678', startedFrom: 'CHAT_LINK' })
    if (!other.ok) throw new Error()
    expect(other.threadId).not.toBe(first.threadId)
    expect(other.state.threads.flatMap((t) => t.messages).some((m) => m.text === 'Private question')).toBe(false)
    const send = await runAction(ctx(repo, null), { type: 'CUSTOMER_SEND_MESSAGE', threadId: first.threadId!, text: 'hi' })
    expect(send).toMatchObject({ ok: false, status: 404 })
  })
})

describe('Paystack', () => {
  it('charges the 50% deposit from the database and marks it paid once Paystack confirms', async () => {
    const repo = new MemoryRepo()
    const paystack = new FakePaystack()
    const placed = await guestOrder(repo)
    if (!placed.ok) throw new Error()
    const guest = ctx(repo, null, [placed.guestToken!])

    expect(await startPayment(ctx(repo, null), paystack, placed.createdOrderId!, { receiptEmail: 'shop@example.com' })).toMatchObject({ ok: false, status: 404 })
    const back = 'https://shop.example/?paid_order=' + placed.createdOrderId
    const start = await startPayment(guest, paystack, placed.createdOrderId!, { receiptEmail: 'shop@example.com', callbackUrl: back })
    if (!start.ok) throw new Error(start.error)
    expect(paystack.initialized[0]).toMatchObject({ amount: DEPOSIT * 100, currency: 'KES', email: 'shop@example.com', channels: ['mobile_money', 'card'], callback_url: back })
    expect(paystack.initialized[0].metadata.stage).toBe('DEPOSIT')
    // Cancelling on Paystack's page brings them back to their order too.
    expect(paystack.initialized[0].metadata.cancel_action).toBe(back)

    // Not paid yet: nothing changes.
    expect(await confirmPaystack(repo, paystack, start.reference)).toMatchObject({ ok: true, paid: false })
    paystack.pay(start.reference)
    expect(await confirmPaystack(repo, paystack, start.reference)).toMatchObject({ ok: true, paid: true })
    expect(await confirmPaystack(repo, paystack, start.reference)).toMatchObject({ ok: true, paid: true })
    const order = (await readState(guest)).orders[0]
    expect(order).toMatchObject({ status: 'PENDING', payment: { status: 'DEPOSIT_PAID', method: 'MPESA' } })
    expect(order.history.filter((h) => h.note?.startsWith('Deposit'))).toHaveLength(1)
    // Nothing more to pay until it's ready.
    expect(await startPayment(guest, paystack, order.id, { receiptEmail: 'shop@example.com' })).toMatchObject({ ok: false, status: 400 })
  })

  it('charges the balance plus delivery once the shop marks the order ready', async () => {
    const repo = new MemoryRepo()
    const paystack = new FakePaystack()
    const placed = await guestOrder(repo)
    if (!placed.ok) throw new Error()
    const guest = ctx(repo, null, [placed.guestToken!])
    const orderId = placed.createdOrderId!
    const deposit = await startPayment(guest, paystack, orderId, { receiptEmail: 'shop@example.com' })
    if (!deposit.ok) throw new Error(deposit.error)
    paystack.pay(deposit.reference)
    await confirmPaystack(repo, paystack, deposit.reference)

    // Only the team can mark it ready and set the delivery fee.
    expect(await runAction(guest, { type: 'ORDER_READY', orderId, deliveryFee: 0 })).toMatchObject({ ok: false, status: 403 })
    expect((await runAction(ctx(repo, owner), { type: 'ORDER_READY', orderId, deliveryFee: 400 })).ok).toBe(true)

    const balance = await startPayment(guest, paystack, orderId, { receiptEmail: 'shop@example.com' })
    if (!balance.ok) throw new Error(balance.error)
    expect(paystack.initialized[1]).toMatchObject({ amount: (BOUQUET.price - DEPOSIT + 400) * 100 })
    expect(paystack.initialized[1].metadata.stage).toBe('BALANCE')
    expect(balance.reference).toContain('-B-')
    paystack.pay(balance.reference)
    expect(await confirmPaystack(repo, paystack, balance.reference)).toMatchObject({ ok: true, paid: true })
    const order = (await readState(guest)).orders[0]
    expect(order).toMatchObject({ status: 'READY', payment: { status: 'PAID' } })
    // Fully paid: the team can send it.
    expect((await runAction(ctx(repo, owner), { type: 'SET_STATUS', orderId, status: 'SHIPPED' })).ok).toBe(true)
  })

  it('refuses a payment for the wrong amount', async () => {
    const repo = new MemoryRepo()
    const paystack = new FakePaystack()
    const placed = await guestOrder(repo)
    if (!placed.ok) throw new Error()
    const start = await startPayment(ctx(repo, null, [placed.guestToken!]), paystack, placed.createdOrderId!, { receiptEmail: 'shop@example.com' })
    if (!start.ok) throw new Error()
    paystack.pay(start.reference, 100)
    expect((await confirmPaystack(repo, paystack, start.reference)).ok).toBe(false)
  })

  it('accepts only webhooks signed with the secret key', async () => {
    const repo = new MemoryRepo()
    const paystack = new FakePaystack()
    const placed = await guestOrder(repo)
    if (!placed.ok) throw new Error()
    const start = await startPayment(ctx(repo, null, [placed.guestToken!]), paystack, placed.createdOrderId!, { receiptEmail: 'shop@example.com' })
    if (!start.ok) throw new Error()
    paystack.pay(start.reference)
    const body = JSON.stringify({ event: 'charge.success', data: { reference: start.reference } })
    expect((await handleWebhook(repo, paystack, body, 'forged', 'sk_test_secret')).status).toBe(401)
    const signature = createHmac('sha512', 'sk_test_secret').update(body).digest('hex')
    expect((await handleWebhook(repo, paystack, body, signature, 'sk_test_secret')).status).toBe(200)
    expect((await repo.load()).state.orders[0].payment.status).toBe('DEPOSIT_PAID')
  })
})

describe('catalogue', () => {
  it('always shows the catalogue from the code, keeping retired bouquets hidden for old orders', async () => {
    const repo = new MemoryRepo()
    await readState(ctx(repo, null))
    // A bouquet saved earlier that is no longer in the catalogue.
    repo.rows.set('product:p-old', { kind: 'product', id: 'p-old', data: { id: 'p-old', name: 'Old Bunch', price: 100, blurb: '' } })
    const { state } = await repo.load()
    expect(state.products.map((p) => p.id)).toEqual([...PRODUCTS.map((p) => p.id), 'p-old'])
    expect(state.products.find((p) => p.id === 'p-old')?.hidden).toBe(true)
    // Nobody can order it any more.
    const res = await runAction(ctx(repo, null), { type: 'CUSTOMER_PLACE_ORDER', draft: { ...draft(), items: [{ productId: 'p-old', qty: 1 }] } })
    expect(res).toMatchObject({ ok: false })
  })
})
