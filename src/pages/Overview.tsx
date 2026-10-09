import { ArrowRight, FileText, MessageCircle, Plus, ShoppingBag, Wallet } from 'lucide-react'
import { useState } from 'react'
import { ChartCard, ColumnChart, HBarChart } from '../components/charts/charts'
import { FeeTrackerCard } from '../components/fees'
import { PageHeader } from '../components/Layout'
import { CreateOrderDialog, OrderTable } from '../components/orders'
import { Avatar, Card, ChannelIcon, cx, Segmented, UnreadBadge } from '../components/ui'
import { formatDate, formatKES, formatNumber, relativeTime } from '../domain/format'
import { customerGrowth, lastMessageAt, ordersToday, productPerformance, revenueSince, totalRevenue, unreadCount, unreadTotals } from '../domain/metrics'
import { sortNewestFirst } from '../domain/orders'
import type { OrderStatus } from '../domain/types'
import { useStore } from '../state/store'

type Filter = 'ALL' | OrderStatus
type Range = '30' | '90' | 'ALL'

export function Overview() {
  const { state, now, user } = useStore()
  const [filter, setFilter] = useState<Filter>('ALL')
  const [range, setRange] = useState<Range>('30')
  const [creating, setCreating] = useState(false)

  const today = ordersToday(state.orders, now)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const unread = unreadTotals(state.threads)
  const count = (s: OrderStatus) => state.orders.filter((o) => o.status === s).length
  const orders = sortNewestFirst(filter === 'ALL' ? state.orders : state.orders.filter((o) => o.status === filter)).slice(0, 10)

  const since = range === 'ALL' ? undefined : new Date(now.getTime() - Number(range) * 86_400_000)
  const firstCustomer = state.customers.reduce((min, c) => (c.createdAt < min ? c.createdAt : min), now.toISOString())
  const weeks = since ? Math.ceil(Number(range) / 7) : Math.max(4, Math.ceil((now.getTime() - new Date(firstCustomer).getTime()) / (7 * 86_400_000)))
  const products = productPerformance(state, since).map((p) => ({
    key: p.productId,
    label: p.name,
    value: p.units,
    detail: `${formatKES(p.revenue)} revenue`,
  }))
  const growth = customerGrowth(state.customers, now, weeks).map((b) => ({
    key: b.weekStart.toISOString(),
    label: formatDate(b.weekStart.toISOString()),
    value: b.value,
    detail: `Week of ${formatDate(b.weekStart.toISOString())}`,
  }))
  const newCustomers = growth.reduce((s, b) => s + b.value, 0)
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <>
      <PageHeader
        title={`${greeting}, ${user.name}`}
        subtitle={now.toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        actions={
          <>
            <a href="#/order-form" className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line-strong bg-surface px-4 text-sm font-medium hover:bg-surface-2">
              <FileText size={15} aria-hidden /> Order form
            </a>
            <button type="button" onClick={() => setCreating(true)} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-green px-4 text-sm font-medium text-on-green hover:opacity-90">
              <Plus size={16} aria-hidden /> New order
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Kpi
          icon={ShoppingBag}
          label="Orders today"
          value={formatNumber(today.length)}
          detail={`${count('PENDING_PAYMENT')} awaiting payment · ${count('PENDING')} to start`}
          href="#/orders"
        />
        <Kpi icon={Wallet} label="Total revenue (KES)" value={formatKES(totalRevenue(state.orders))} detail={`${formatKES(revenueSince(state.orders, monthStart))} this month`} />
        <Kpi
          icon={MessageCircle}
          label="Messages"
          value={`${unread.messages} unread`}
          detail={`Across ${unread.threads} ${unread.threads === 1 ? 'conversation' : 'conversations'}`}
          href="#/inbox"
          highlight={unread.messages > 0}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Card
          className="xl:col-span-8"
          title="Order management"
          subtitle="Newest first. Tap a status to move an order along."
          action={
            <a href="#/orders" className="inline-flex items-center gap-1 text-sm font-medium text-ink-2 hover:text-ink">
              All orders <ArrowRight size={14} aria-hidden />
            </a>
          }
        >
          <div className="mb-4">
            <Segmented
              label="Filter orders"
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'ALL', label: 'All' },
                { value: 'PENDING_PAYMENT', label: 'Awaiting payment', count: count('PENDING_PAYMENT') },
                { value: 'PENDING', label: 'Pending', count: count('PENDING') },
                { value: 'PROCESSING', label: 'Processing', count: count('PROCESSING') },
                { value: 'SHIPPED', label: 'Shipped', count: count('SHIPPED') },
              ]}
            />
          </div>
          <OrderTable orders={orders} compact />
        </Card>

        <div className="flex min-w-0 flex-col gap-4 xl:col-span-4">
          <FeeTrackerCard />
          <MessagesPanel />
        </div>
      </div>

      <div className="mt-8 mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-semibold">Performance</h2>
        <Segmented
          label="Date range"
          value={range}
          onChange={setRange}
          options={[
            { value: '30', label: 'Last 30 days' },
            { value: '90', label: 'Last 90 days' },
            { value: 'ALL', label: 'All time' },
          ]}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Product performance" subtitle="Bouquets sold" data={products} format={formatNumber} valueHeader="Bouquets">
          <HBarChart data={products} format={formatNumber} ariaLabel="Bouquets sold by product" />
        </ChartCard>
        <ChartCard title="Customer growth" subtitle={`${newCustomers} new customers, by week`} data={growth} format={formatNumber} valueHeader="New customers">
          <ColumnChart data={growth} format={formatNumber} ariaLabel="New customers per week" />
        </ChartCard>
      </div>

      <CreateOrderDialog key={String(creating)} open={creating} onClose={() => setCreating(false)} />
    </>
  )
}

function Kpi({
  icon: Icon,
  label,
  value,
  detail,
  href,
  highlight,
}: {
  icon: typeof ShoppingBag
  label: string
  value: string
  detail: string
  href?: string
  highlight?: boolean
}) {
  const body = (
    <>
      <div className="flex items-center justify-between">
        <span className="eyebrow">{label}</span>
        <span className={cx('rounded-full p-2', highlight ? 'bg-pink-wash text-pink-ink' : 'bg-surface-2 text-ink-2')}>
          <Icon size={16} aria-hidden />
        </span>
      </div>
      <div className="mt-2 text-3xl font-semibold leading-tight">{value}</div>
      <div className="mt-1 text-sm text-muted">{detail}</div>
    </>
  )
  const cls = 'block rounded-2xl border border-line bg-surface p-5 shadow-card'
  return href ? (
    <a href={href} className={cx(cls, 'transition-colors hover:border-line-strong')}>
      {body}
    </a>
  ) : (
    <div className={cls}>{body}</div>
  )
}

function MessagesPanel() {
  const { state } = useStore()
  const threads = [...state.threads].sort((a, b) => lastMessageAt(b).localeCompare(lastMessageAt(a))).slice(0, 5)
  const total = unreadTotals(state.threads).messages
  return (
    <Card
      title="Consolidated messages"
      subtitle="Instagram and Messenger in one place"
      action={total > 0 ? <span className="rounded-full bg-pink-wash px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-pink-ink">{total} unread</span> : undefined}
      bodyClassName="px-2 pb-3 pt-3"
    >
      <ul>
        {threads.map((t) => {
          const customer = state.customers.find((c) => c.id === t.customerId)
          const last = t.messages[t.messages.length - 1]
          const n = unreadCount(t)
          return (
            <li key={t.id}>
              <a href={`#/inbox/${t.id}`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-surface-2">
                <Avatar name={customer?.name ?? t.handle} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className={cx('truncate text-sm', n ? 'font-semibold' : 'font-medium')}>{customer?.name ?? t.handle}</span>
                    <span className="text-muted">
                      <ChannelIcon channel={t.channel} size={12} />
                    </span>
                  </div>
                  <div className={cx('truncate text-xs', n ? 'text-ink' : 'text-muted')}>
                    {last.from === 'SHOP' ? 'You: ' : ''}
                    {last.text}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-[11px] text-muted">{relativeTime(last.at)}</span>
                  <UnreadBadge count={n} />
                </div>
              </a>
            </li>
          )
        })}
      </ul>
      <a href="#/inbox" className="mx-3 mt-1 inline-flex items-center gap-1 text-sm font-medium text-ink-2 hover:text-ink">
        Open inbox <ArrowRight size={14} aria-hidden />
      </a>
    </Card>
  )
}
