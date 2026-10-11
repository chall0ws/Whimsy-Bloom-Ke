import { Banknote, CircleCheck, Hourglass } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { ChartCard, ColumnChart } from '../components/charts/charts'
import { PayoutDialog } from '../components/fees'
import { PageHeader } from '../components/Layout'
import { Button, Card, cx, EmptyState, useDialog } from '../components/ui'
import { feeSummary } from '../domain/fees'
import { formatDate, formatDateTime, formatKES, formatNumber } from '../domain/format'
import { weeklyBuckets } from '../domain/metrics'
import { useStore, userName } from '../state/store'

export function Fees() {
  const { state, now, isSuperAdmin, dispatch, openOrder } = useStore()
  const paying = useDialog()
  const [showAll, setShowAll] = useState(false)
  const s = feeSummary(state)
  const feeDates = state.fees.map((f) => f.at)
  const counts = weeklyBuckets(feeDates, now, 12)
  const weekly = weeklyBuckets(feeDates, now, 12, (i) => state.fees[i].amount).map((b, i) => ({
    key: b.weekStart.toISOString(),
    label: formatDate(b.weekStart.toISOString()),
    value: b.value,
    detail: `${counts[i].value} shipped · week of ${formatDate(b.weekStart.toISOString())}`,
  }))
  const ledger = showAll ? state.fees : state.fees.slice(0, 15)
  const compactKES = (n: number) => (n >= 1000 ? `${formatNumber(n / 1000)}K` : formatNumber(n))

  return (
    <>
      <PageHeader
        title="Service fees"
        subtitle={`${formatKES(state.settings.serviceFee)} for every shipped order, paid ${state.settings.payoutSchedule === 'WEEKLY' ? 'weekly' : 'monthly'} to the platform partner.`}
        actions={
          <Button variant="primary" onClick={paying.show} disabled={s.availableToSend <= 0}>
            <Banknote size={16} aria-hidden /> Record payout
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl bg-green p-5 text-on-green shadow-card">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-80">Current payable balance</div>
          <div className="mt-2 whitespace-nowrap text-4xl font-semibold leading-tight">{formatKES(s.payable)}</div>
          <div className="mt-1 text-sm opacity-80">{formatKES(s.availableToSend)} not yet sent</div>
        </div>
        <Tile label="Total service fees collected" value={formatKES(s.collected)} detail={`${s.shippedCount} shipped orders`} />
        <Tile label="Paid out to partner" value={formatKES(s.paidOut)} detail={`${state.payouts.filter((p) => p.status === 'CONFIRMED').length} confirmed payouts`} />
        <Tile label="Sent, awaiting confirmation" value={formatKES(s.inTransit)} detail={isSuperAdmin && s.inTransit > 0 ? 'Confirm below once received' : 'Confirmed by the super admin'} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-5">
        <ChartCard className="xl:col-span-3" title="Fees by week" subtitle="Last 12 weeks, KES" data={weekly} format={compactKES} valueHeader="KES">
          <ColumnChart data={weekly} format={compactKES} ariaLabel="Service fees collected per week" />
        </ChartCard>
        <Card title="How the fee works" className="xl:col-span-2">
          <ul className="space-y-2.5 text-sm text-ink-2">
            <Rule>Charged once, the moment an order is marked <strong>Shipped</strong>. Nothing is charged before then.</Rule>
            <Rule>Shipped orders are final. If one is refunded later, the service fee and delivery fee are kept.</Rule>
            <Rule>
              Hand-delivered orders cost the customer nothing for delivery and{' '}
              {state.settings.feeOnHandDelivery ? 'still earn the service fee' : 'earn no service fee'}.
            </Rule>
            <Rule>The admin records each payout with its M-Pesa code. The balance goes down when the super admin confirms receipt.</Rule>
          </ul>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card title="Payouts">
          {state.payouts.length === 0 ? (
            <EmptyState>No payouts yet.</EmptyState>
          ) : (
            <ul className="divide-y divide-line">
              {state.payouts.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-3 py-3">
                  <span className={cx('rounded-full p-2', p.status === 'CONFIRMED' ? 'bg-green-wash text-green-ink' : 'bg-amber-wash text-amber-ink')}>
                    {p.status === 'CONFIRMED' ? <CircleCheck size={16} aria-hidden /> : <Hourglass size={16} aria-hidden />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="tabular font-semibold">{formatKES(p.amount)}</div>
                    <div className="text-xs text-muted">
                      {p.reference} · sent {formatDateTime(p.sentAt)} by {userName(state, p.sentBy)}
                      {p.confirmedAt && ` · confirmed ${formatDate(p.confirmedAt)}`}
                    </div>
                  </div>
                  {p.status === 'SENT' &&
                    (isSuperAdmin ? (
                      <Button size="sm" variant="primary" onClick={() => dispatch({ type: 'CONFIRM_PAYOUT', payoutId: p.id })}>
                        Confirm received
                      </Button>
                    ) : (
                      <span className="text-xs font-medium text-amber-ink">Awaiting confirmation</span>
                    ))}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Fee ledger" subtitle="One line per shipped order. Lines are never removed.">
          {state.fees.length === 0 ? (
            <EmptyState>No fees yet — they appear when orders ship.</EmptyState>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="eyebrow pb-2">Date</th>
                    <th className="eyebrow pb-2">Order</th>
                    <th className="eyebrow pb-2">Delivery</th>
                    <th className="eyebrow pb-2 text-right">Fee</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((f) => {
                    const order = state.orders.find((o) => o.id === f.orderId)
                    return (
                      <tr key={f.id} className="border-t border-line">
                        <td className="py-2 text-muted">{formatDate(f.at)}</td>
                        <td className="py-2">
                          <button type="button" className="font-medium hover:underline" onClick={() => openOrder(f.orderId)}>
                            {f.orderNumber}
                          </button>
                          {order?.status === 'REFUNDED' && <span className="ml-1.5 text-xs text-red-ink">refunded</span>}
                        </td>
                        <td className="py-2 text-ink-2">{order?.fulfilment.method === 'HAND_DELIVERY' ? 'Hand' : 'Courier'}</td>
                        <td className="tabular py-2 text-right font-medium">{formatKES(f.amount)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {state.fees.length > 15 && (
                <Button size="sm" variant="ghost" className="mt-3" onClick={() => setShowAll(!showAll)}>
                  {showAll ? 'Show fewer' : `Show all ${state.fees.length}`}
                </Button>
              )}
            </>
          )}
        </Card>
      </div>

      <PayoutDialog key={paying.key} open={paying.open} onClose={paying.hide} />
    </>
  )
}

function Tile({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
      <div className="eyebrow">{label}</div>
      <div className="mt-2 text-3xl font-semibold leading-tight">{value}</div>
      <div className="mt-1 text-sm text-muted">{detail}</div>
    </div>
  )
}

function Rule({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-2">
      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-pink-ink" aria-hidden />
      <span>{children}</span>
    </li>
  )
}
