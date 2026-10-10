import { Plus, Search, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { PageHeader } from '../components/Layout'
import { CreateOrderDialog, OrderTable } from '../components/orders'
import { Button, Card, inputClass, Segmented } from '../components/ui'
import { relativeTime } from '../domain/format'
import { nextUpOrder, orderSummary, sortNewestFirst, sourceLabel } from '../domain/orders'
import type { Channel, OrderStatus } from '../domain/types'
import { useStore } from '../state/store'

type Filter = 'OPEN' | 'ALL' | OrderStatus

export function Orders() {
  const { state, dispatch, openOrder } = useStore()
  const [filter, setFilter] = useState<Filter>('OPEN')
  const [channel, setChannel] = useState<'ALL' | Channel>('ALL')
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const next = nextUpOrder(state.orders)

  const count = (s: OrderStatus) => state.orders.filter((o) => o.status === s).length
  const open: OrderStatus[] = ['PENDING_PAYMENT', 'PENDING', 'PROCESSING']
  const q = query.trim().toLowerCase()
  const orders = sortNewestFirst(
    state.orders.filter((o) => {
      if (filter === 'OPEN' && !open.includes(o.status)) return false
      if (filter !== 'OPEN' && filter !== 'ALL' && o.status !== filter) return false
      if (channel !== 'ALL' && o.channel !== channel) return false
      if (!q) return true
      const customer = state.customers.find((c) => c.id === o.customerId)
      return [o.number, sourceLabel(state, o), orderSummary(state, o), customer?.name ?? '', o.customisation].some((s) => s.toLowerCase().includes(q))
    }),
  )

  return (
    <>
      <PageHeader
        title="Orders"
        subtitle="Web-form, live-chat and phone orders in one queue."
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus size={16} aria-hidden /> New order
          </Button>
        }
      />

      {next && (
        <div className="mb-4 flex flex-wrap items-center gap-4 rounded-2xl border border-pink/60 bg-pink-wash px-5 py-4">
          <Sparkles size={20} className="text-pink-ink" aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="eyebrow !text-pink-ink">Next up · oldest pending order</div>
            <button type="button" onClick={() => openOrder(next.id)} className="mt-0.5 text-left text-sm hover:underline">
              <strong>{next.number}</strong> · {orderSummary(state, next)} · {sourceLabel(state, next)} · waiting {relativeTime(next.createdAt)}
            </button>
          </div>
          <Button variant="primary" onClick={() => dispatch({ type: 'SET_STATUS', orderId: next.id, status: 'PROCESSING' })}>
            Start making it
          </Button>
        </div>
      )}

      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Segmented
            label="Filter by status"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'OPEN', label: 'Open', count: state.orders.filter((o) => open.includes(o.status)).length },
              { value: 'PENDING_PAYMENT', label: 'Awaiting payment', count: count('PENDING_PAYMENT') },
              { value: 'PENDING', label: 'Pending', count: count('PENDING') },
              { value: 'PROCESSING', label: 'Processing', count: count('PROCESSING') },
              { value: 'SHIPPED', label: 'Shipped', count: count('SHIPPED') },
              { value: 'ALL', label: 'All', count: state.orders.length },
            ]}
          />
          <select className={`${inputClass} !w-auto`} value={channel} onChange={(e) => setChannel(e.target.value as typeof channel)} aria-label="Filter by source">
            <option value="ALL">All sources</option>
            <option value="LIVE_CHAT">Live chat</option>
            <option value="WEB_FORM">Web form</option>
            <option value="MANUAL">Phone / in person</option>
          </select>
          <label className="relative min-w-[200px] flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
            <input className={`${inputClass} pl-9`} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search order #, customer, product…" aria-label="Search orders" />
          </label>
        </div>
        <OrderTable orders={orders} emptyText={q ? 'No orders match that search.' : 'Nothing here — all caught up 🌸'} />
      </Card>

      <CreateOrderDialog key={String(creating)} open={creating} onClose={() => setCreating(false)} />
    </>
  )
}
