import { describe, expect, it } from 'vitest'
import { applyAction, type Action, type OrderDraft } from '../src/domain/actions'
import { forSale, PRODUCTS } from '../src/domain/catalog'
import { createEmptyState } from '../src/domain/seed'
import type { AppState } from '../src/domain/types'
import { CHAT_QUIET_MS, parseRecipients, teamAlerts, withAlerts, type AlertRecipient } from './alerts'
import { runAction, type Caller, type Ctx } from './core'
import { MemoryRepo } from './repo'

const SITE = 'https://whimsy-bloom-ke.vercel.app'
const T0 = new Date('2026-10-11T09:00:00+03:00')
const at = (minutes: number) => new Date(T0.getTime() + minutes * 60_000)
const BOUQUET = forSale(PRODUCTS)[0]
const owner: Caller = { email: 'owner@example.com', name: 'Owner', verified: true }
const staff = new Map([['owner@example.com', 'ADMIN' as const]])

function apply(state: AppState, action: Action, now = T0): AppState {
  const r = applyAction(state, action, now)
  if (!r.ok) throw new Error(r.error)
  return r.state
}

const draft: OrderDraft = {
  customerName: 'Joy Wairimu',
  phone: '0712 345 678',
  channel: 'WEB_FORM',
  items: [{ productId: BOUQUET.id, qty: 1 }],
  customisation: '',
  method: 'HAND_DELIVERY',
  deliveryOption: 'PICKUP_MTAANI',
  address: 'Sarit Centre agent',
  payment: { kind: 'UNPAID' },
}

describe('WhatsApp alerts for the team', () => {
  it('announces a new order when its deposit is paid, then the balance', () => {
    const placed = applyAction(createEmptyState(), { type: 'CUSTOMER_PLACE_ORDER', draft }, T0)
    if (!placed.ok) throw new Error(placed.error)
    const orderId = placed.createdOrderId!
    // Placing an order without paying isn't news yet.
    expect(teamAlerts(createEmptyState(), placed.state, SITE)).toEqual([])

    const deposit = Math.ceil(BOUQUET.price / 2)
    const paid = apply(placed.state, { type: 'PAYMENT_RECEIVED', orderId, method: 'MPESA', reference: 'ps_dep', amount: deposit })
    const [alert] = teamAlerts(placed.state, paid, SITE)
    expect(alert).toBe(
      [
        `🛍️ New order WB-1001 from Joy Wairimu`,
        `${BOUQUET.name} · Within Nairobi · Pickup Mtaani`,
        `Deposit KES ${deposit.toLocaleString('en-KE')} paid (M-Pesa). Balance when ready: KES ${(BOUQUET.price - deposit).toLocaleString('en-KE')} + delivery.`,
        `${SITE}/#/admin/orders`,
      ].join('\n'),
    )
    // Saving again without a new payment doesn't repeat it.
    expect(teamAlerts(paid, paid, SITE)).toEqual([])

    const signedIn = apply(paid, { type: 'SIGN_IN_STAFF', email: owner.email, name: owner.name, role: 'ADMIN' })
    const ready = apply(signedIn, { type: 'ORDER_READY', orderId, deliveryFee: 200 })
    const balance = BOUQUET.price - deposit + 200
    const done = apply(ready, { type: 'PAYMENT_RECEIVED', orderId, method: 'CARD', reference: 'ps_bal', amount: balance })
    const [second] = teamAlerts(ready, done, SITE)
    expect(second).toContain(`💳 WB-1001: KES ${balance.toLocaleString('en-KE')} balance paid by Joy Wairimu (card)`)
    expect(second).toContain('Fully paid: ready to send.')
  })

  it('reads the recipients from CALLMEBOT_ALERTS', () => {
    expect(parseRecipients('254712345678:123456, 0798 765 432:654321;bad, 0700000000:')).toEqual([
      { phone: '254712345678', apiKey: '123456' },
      { phone: '254798765432', apiKey: '654321' },
    ])
    expect(parseRecipients(undefined)).toEqual([])
  })
})

describe('alerts from the live server', () => {
  function setup(fail = false) {
    const sent: { to: AlertRecipient; text: string }[] = []
    const inner = MemoryRepo.from(createEmptyState())
    const recipients = parseRecipients('254712345678:111, 254798765432:222')
    const repo = withAlerts(inner, recipients, SITE, async (to, text) => {
      if (fail) throw new Error('CallMeBot is down')
      sent.push({ to, text })
    })
    let now = T0
    const tokens: string[] = []
    const ctx = (caller: Caller | null = null): Ctx => ({ repo, caller, guestTokens: tokens, staff, now: () => now })
    return { sent, inner, ctx, tokens, setNow: (d: Date) => (now = d) }
  }

  it('alerts on a new chat, stays quiet while chatting, and alerts again after 10 quiet minutes', async () => {
    const { sent, ctx, tokens, setNow } = setup()
    const started = await runAction(ctx(), { type: 'CUSTOMER_START_CHAT', name: 'Joy Wairimu', phone: '0712345678', startedFrom: 'CHAT_LINK', text: 'Hi! Do you have red roses?' })
    if (!started.ok) throw new Error(started.error)
    const threadId = started.threadId!
    if (started.guestToken) tokens.push(started.guestToken)
    const send = async (c: Ctx, action: Action) => {
      const r = await runAction(c, action)
      if (!r.ok) throw new Error(r.error)
    }
    // Each person gets one message.
    expect(sent.map((s) => s.to.phone)).toEqual(['254712345678', '254798765432'])
    expect(sent[0].text).toBe(`💬 Joy Wairimu on live chat:\n“Hi! Do you have red roses?”\nReply: ${SITE}/#/admin/inbox/${threadId}`)

    setNow(at(2))
    await send(ctx(), { type: 'CUSTOMER_SEND_MESSAGE', threadId, text: 'For Saturday' })
    setNow(at(5))
    await send(ctx(owner), { type: 'SEND_MESSAGE', threadId, text: 'Yes we do!' })
    setNow(at(5 + CHAT_QUIET_MS / 60_000 - 1))
    await send(ctx(), { type: 'CUSTOMER_SEND_MESSAGE', threadId, text: 'Great, thanks' })
    expect(sent).toHaveLength(2)

    setNow(at(60))
    await send(ctx(), { type: 'CUSTOMER_SEND_MESSAGE', threadId, text: 'One more question' })
    expect(sent).toHaveLength(4)
    expect(sent[2].text).toContain('“One more question”')
  })

  it('still saves when WhatsApp can’t be reached', async () => {
    const { inner, ctx } = setup(true)
    const r = await runAction(ctx(), { type: 'CUSTOMER_START_CHAT', name: 'Joy', phone: '0712345678', startedFrom: 'CHAT_LINK', text: 'Hello' })
    expect(r.ok).toBe(true)
    expect((await inner.load()).state.threads).toHaveLength(1)
  })
})
