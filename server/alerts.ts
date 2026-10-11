import { AUTO_REPLY } from '../src/domain/actions'
import { formatKES } from '../src/domain/format'
import { amountDue, deliveryLabel, itemsSubtotal, orderSummary, paymentRecords } from '../src/domain/orders'
import { whatsappNumber } from '../src/domain/whatsapp'
import type { AppState, Message, Order } from '../src/domain/types'
import { PAYSTACK_ACTOR } from '../src/domain/types'
import type { Repo } from './repo'

/** A customer who writes again after this long without anyone chatting gets a fresh alert. */
export const CHAT_QUIET_MS = 10 * 60_000

const customerName = (state: AppState, id: string) => state.customers.find((c) => c.id === id)?.name ?? 'A customer'
const method = (m: string) => (m === 'CARD' ? 'card' : 'M-Pesa')
const short = (text: string, max = 140) => (text.length > max ? `${text.slice(0, max - 1)}…` : text)

/** A message someone actually wrote (not an automatic reply or a payment receipt). */
const human = (m: Message) => m.from === 'CUSTOMER' || (m.from === 'SHOP' && m.by !== AUTO_REPLY && m.by !== PAYSTACK_ACTOR)

/**
 * What the team should hear about after a save: deposits (a new order), other payments, and
 * customers writing in the live chat (once per conversation, then again after 10 quiet minutes).
 */
export function teamAlerts(prev: AppState, next: AppState, siteUrl: string): string[] {
  const alerts: string[] = []
  const admin = `${siteUrl.replace(/\/$/, '')}/#/admin`

  for (const order of next.orders) {
    const before = prev.orders.find((o) => o.id === order.id)
    const known = new Set(before ? paymentRecords(before).map((p) => p.reference) : [])
    for (const p of paymentRecords(order).filter((r) => !known.has(r.reference))) {
      alerts.push(paymentAlert(next, order, p.kind, p.amount, p.method, admin))
    }
  }

  for (const thread of next.threads) {
    const before = prev.threads.find((t) => t.id === thread.id)
    const seen = new Set(before?.messages.map((m) => m.id) ?? [])
    thread.messages.forEach((m, i) => {
      if (m.from !== 'CUSTOMER' || seen.has(m.id)) return
      const earlier = thread.messages.slice(0, i).filter(human).at(-1)
      const quiet = !earlier || new Date(m.at).getTime() - new Date(earlier.at).getTime() >= CHAT_QUIET_MS
      if (!quiet) return
      alerts.push(`💬 ${customerName(next, thread.customerId)} on live chat:\n“${short(m.text)}”\nReply: ${admin}/inbox/${thread.id}`)
    })
  }
  return alerts
}

function paymentAlert(state: AppState, order: Order, kind: string, amount: number, via: string, admin: string): string {
  const who = customerName(state, order.customerId)
  const what = orderSummary(state, order)
  if (kind === 'DEPOSIT') {
    const rest = Math.max(0, itemsSubtotal(order) - amount)
    return [
      `🛍️ New order ${order.number} from ${who}`,
      `${what} · ${deliveryLabel(order.fulfilment)}`,
      `Deposit ${formatKES(amount)} paid (${method(via)}). Balance when ready: ${formatKES(rest)} + delivery.`,
      `${admin}/orders`,
    ].join('\n')
  }
  const due = amountDue(order)
  return [
    `💳 ${order.number}: ${formatKES(amount)} ${kind === 'BALANCE' ? 'balance ' : ''}paid by ${who} (${method(via)})`,
    `${what} · ${deliveryLabel(order.fulfilment)}`,
    due > 0 ? `Still due: ${formatKES(due)}.` : order.status === 'READY' ? 'Fully paid: ready to send.' : 'Fully paid.',
    `${admin}/orders`,
  ].join('\n')
}

export interface AlertRecipient {
  phone: string
  apiKey: string
}

/** "254712345678:1234567, 0798765432:7654321" → recipients (phone numbers in international form). */
export function parseRecipients(raw: string | undefined): AlertRecipient[] {
  return (raw ?? '')
    .split(/[,;\n]/)
    .map((pair) => pair.trim().split(':'))
    .map(([phone, apiKey]) => ({ phone: whatsappNumber(phone) ?? '', apiKey: (apiKey ?? '').trim() }))
    .filter((r) => r.phone && r.apiKey)
}

export type SendAlert = (to: AlertRecipient, text: string) => Promise<void>

/** Sends with CallMeBot (free WhatsApp messages to your own number). Gives up after a few seconds. */
export const callMeBot: SendAlert = async (to, text) => {
  const url = `https://api.callmebot.com/whatsapp.php?phone=${to.phone}&text=${encodeURIComponent(text)}&apikey=${encodeURIComponent(to.apiKey)}`
  const res = await fetch(url, { signal: AbortSignal.timeout(4000) })
  if (!res.ok) throw new Error(`CallMeBot answered ${res.status}`)
}

/**
 * A Repo that, after each successful save, sends the team a WhatsApp alert about new orders,
 * payments and chats. Alerts never block or undo a save: if sending fails it's only logged.
 */
export function withAlerts(repo: Repo, recipients: AlertRecipient[], siteUrl: string, send: SendAlert = callMeBot): Repo {
  if (recipients.length === 0) return repo
  return {
    load: () => repo.load(),
    notify: (version) => repo.notify(version),
    async save(prev, next, version) {
      const saved = await repo.save(prev, next, version)
      if (saved === null || saved === version) return saved
      let alerts: string[] = []
      try {
        alerts = teamAlerts(prev, next, siteUrl)
      } catch (error) {
        console.error('Couldn’t work out alerts', error)
      }
      // One message per person per save, so CallMeBot isn't asked for several at once.
      if (alerts.length) {
        const text = alerts.join('\n\n')
        await Promise.all(recipients.map((to) => send(to, text).catch((error) => console.error('WhatsApp alert failed', error))))
      }
      return saved
    },
  }
}
