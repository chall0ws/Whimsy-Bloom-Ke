import { Smartphone } from 'lucide-react'
import { useCallback, useState } from 'react'
import { LIVE } from '../config'
import { Button, cx } from '../components/ui'
import { formatKES } from '../domain/format'
import { amountDue, amountPaid, depositFor, itemsSubtotal, paymentStage } from '../domain/orders'
import type { Order } from '../domain/types'
import { useStore } from '../state/store'
import { outcomeMessage, payOrder } from './paystack'

export function mpesaReference() {
  return `S${Math.random().toString(36).slice(2, 11).toUpperCase()}`
}

/** Ordered → Deposit paid → Being made → Ready → On its way, in customer words. */
export function OrderTracker({ order }: { order: Order }) {
  const labels = ['Ordered', 'Deposit paid', 'Being made', 'Ready', 'On its way']
  const reached = { PENDING_PAYMENT: 0, PENDING: 1, PROCESSING: 2, READY: 3, SHIPPED: 4, CANCELLED: -1, REFUNDED: -1 }[order.status]
  if (reached < 0) return <p className="text-sm text-muted">This order was {order.status === 'CANCELLED' ? 'cancelled' : 'refunded'}.</p>
  return (
    <ol className="grid grid-cols-5 gap-1" aria-label="Order progress">
      {labels.map((label, i) => (
        <li key={label} className="flex flex-col gap-1.5">
          <span className={cx('h-1.5 rounded-full', i <= reached ? 'bg-green' : 'bg-line-strong')} aria-hidden />
          <span className={cx('text-[11px] leading-tight', i === reached ? 'font-semibold text-ink' : i < reached ? 'text-ink-2' : 'text-muted')}>
            {label}
            {i === reached && <span className="sr-only"> (current step)</span>}
          </span>
        </li>
      ))}
    </ol>
  )
}

/**
 * Paying for an order. Live: Paystack's window (M-Pesa or card), confirmed by the server.
 * Demo: a pretend M-Pesa prompt that "pays" after two seconds.
 */
export function usePayNow() {
  const { dispatch, toast, refresh } = useStore()
  const [busy, setBusy] = useState(false)
  const pay = useCallback(
    async (order: Pick<Order, 'id' | 'customerId'>) => {
      setBusy(true)
      try {
        if (LIVE) {
          const outcome = await payOrder(order.id)
          // On the way to Paystack's page: keep showing "Taking you to Paystack…".
          if (outcome.status === 'redirecting') return
          const message = outcomeMessage(outcome)
          if (message) toast(message.text, message.tone)
          await refresh()
        } else {
          await new Promise((resolve) => setTimeout(resolve, 2000))
          await dispatch({ type: 'CUSTOMER_PAY', orderId: order.id, customerId: order.customerId, reference: mpesaReference() })
        }
        setBusy(false)
      } catch (error) {
        setBusy(false)
        throw error
      }
    },
    [dispatch, toast, refresh],
  )
  return { pay, busy }
}

export const payLabel = (amount: number, stage: 'DEPOSIT' | 'BALANCE' | null = null) => {
  const what = stage === 'DEPOSIT' ? 'Pay deposit' : stage === 'BALANCE' ? 'Pay balance' : 'Pay'
  return LIVE ? `${what} ${formatKES(amount)} · M-Pesa or card` : `${what} ${formatKES(amount)} with M-Pesa`
}
export const payingLabel = LIVE ? 'Taking you to Paystack’s secure page…' : 'Check your phone for the M-Pesa prompt…'

export function PayButton({ order, size = 'sm' }: { order: Order; size?: 'sm' | 'md' }) {
  const { pay, busy } = usePayNow()
  if (busy) {
    return (
      <span className="inline-flex h-8 items-center gap-1.5 text-sm text-ink-2">
        <Smartphone size={16} className="animate-pulse" aria-hidden /> {payingLabel}
      </span>
    )
  }
  return (
    <Button size={size} variant="primary" onClick={() => pay(order)}>
      <Smartphone size={14} aria-hidden /> {payLabel(amountDue(order), paymentStage(order))}
    </Button>
  )
}

/** What's been paid and what's still to come, in customer words. */
export function PaymentSummary({ order }: { order: Order }) {
  const paid = amountPaid(order)
  const due = amountDue(order)
  if (order.status === 'CANCELLED' || order.status === 'REFUNDED') return null
  if (order.status === 'PENDING_PAYMENT') {
    return (
      <p className="text-sm text-ink-2">
        Pay the <strong className="text-ink">{formatKES(due)}</strong> deposit (50%) and we’ll start making it. The other {formatKES(itemsSubtotal(order) - depositFor(order))} plus
        delivery is due when it’s ready.
      </p>
    )
  }
  if (order.status === 'READY' && due > 0) {
    const rest = Math.max(0, itemsSubtotal(order) - paid)
    return (
      <p className="text-sm text-ink-2">
        It’s ready! 🌸 Balance to pay: <strong className="text-ink">{formatKES(due)}</strong> ({formatKES(rest)} remaining + {formatKES(order.fulfilment.deliveryFee)} delivery).
      </p>
    )
  }
  if (order.status === 'PENDING' || order.status === 'PROCESSING') {
    return (
      <p className="text-sm text-ink-2">
        Deposit of {formatKES(paid)} paid. The rest plus delivery is due when it’s ready; we’ll message you.
      </p>
    )
  }
  return <p className="text-sm text-ink-2">Fully paid · {formatKES(paid)}</p>
}
