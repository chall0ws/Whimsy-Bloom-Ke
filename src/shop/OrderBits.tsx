import { Smartphone } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button, cx } from '../components/ui'
import { formatKES } from '../domain/format'
import { orderTotal } from '../domain/orders'
import type { Order } from '../domain/types'
import { useStore } from '../state/store'

export function mpesaReference() {
  return `S${Math.random().toString(36).slice(2, 11).toUpperCase()}`
}

/** Ordered → Paid → Being made → On its way, in customer words. */
export function OrderTracker({ order }: { order: Order }) {
  const last = order.fulfilment.method === 'HAND_DELIVERY' ? 'Out for delivery' : 'On its way'
  const labels = ['Ordered', 'Paid', 'Being made', last]
  const reached = { PENDING_PAYMENT: 0, PENDING: 1, PROCESSING: 2, SHIPPED: 3, CANCELLED: -1, REFUNDED: -1 }[order.status]
  if (reached < 0) return <p className="text-sm text-muted">This order was {order.status === 'CANCELLED' ? 'cancelled' : 'refunded'}.</p>
  return (
    <ol className="grid grid-cols-4 gap-1" aria-label="Order progress">
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

/** Simulated M-Pesa prompt; in Stage B the payment provider confirms it. */
export function PayButton({ order, size = 'sm' }: { order: Order; size?: 'sm' | 'md' }) {
  const { dispatch } = useStore()
  const [paying, setPaying] = useState(false)
  useEffect(() => {
    if (!paying) return
    const timer = setTimeout(() => {
      dispatch({ type: 'CUSTOMER_PAY', orderId: order.id, customerId: order.customerId, reference: mpesaReference() })
      setPaying(false)
    }, 2000)
    return () => clearTimeout(timer)
  }, [paying, order.id, order.customerId, dispatch])
  if (paying) {
    return (
      <span className="inline-flex h-8 items-center gap-1.5 text-sm text-ink-2">
        <Smartphone size={16} className="animate-pulse" aria-hidden /> Check your phone for the M-Pesa prompt…
      </span>
    )
  }
  return (
    <Button size={size} variant="primary" onClick={() => setPaying(true)}>
      <Smartphone size={14} aria-hidden /> Pay {formatKES(orderTotal(order))} with M-Pesa
    </Button>
  )
}
