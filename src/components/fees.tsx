import { ArrowRight, Banknote, Hourglass } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { feeSummary } from '../domain/fees'
import { formatKES } from '../domain/format'
import { startOfWeek } from '../domain/metrics'
import { useStore } from '../state/store'
import { Button, Card, Field, inputClass, Modal } from './ui'

export function FeeTrackerCard() {
  const { state, now, isSuperAdmin } = useStore()
  const summary = feeSummary(state)
  const [paying, setPaying] = useState(false)
  const weekStart = startOfWeek(now)
  const thisWeek = state.fees.filter((f) => new Date(f.at) >= weekStart)
  const waiting = state.payouts.filter((p) => p.status === 'SENT')

  return (
    <Card
      title="Personal service fee tracker"
      subtitle={`${formatKES(state.settings.serviceFee)} per shipped order · non-refundable`}
      className="border-green/30"
    >
      <div className="rounded-xl bg-green px-4 py-3.5 text-on-green">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-80">Current payable balance</div>
        <div className="mt-1 text-[34px] font-semibold leading-none">{formatKES(summary.payable)}</div>
        <div className="mt-1.5 text-xs opacity-80">
          +{formatKES(thisWeek.reduce((s, f) => s + f.amount, 0))} this week from {thisWeek.length} shipped {thisWeek.length === 1 ? 'order' : 'orders'}
        </div>
      </div>
      <dl className="mt-4 space-y-2 text-sm">
        <Row label="Total service fees collected" value={formatKES(summary.collected)} />
        <Row label="Paid out to partner" value={formatKES(summary.paidOut)} />
        {summary.inTransit > 0 && (
          <Row
            label={
              <span className="inline-flex items-center gap-1">
                <Hourglass size={13} aria-hidden /> Sent, awaiting confirmation
              </span>
            }
            value={formatKES(summary.inTransit)}
          />
        )}
      </dl>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="primary" size="sm" onClick={() => setPaying(true)} disabled={summary.availableToSend <= 0}>
          <Banknote size={14} aria-hidden /> Record payout
        </Button>
        <a href="#/admin/fees" className="inline-flex h-8 items-center gap-1 rounded-full px-3 text-xs font-medium text-ink-2 hover:bg-surface-2">
          {isSuperAdmin && waiting.length > 0 ? `Confirm ${waiting.length} payout${waiting.length > 1 ? 's' : ''}` : 'Fee ledger'} <ArrowRight size={13} aria-hidden />
        </a>
      </div>
      <PayoutDialog open={paying} onClose={() => setPaying(false)} />
    </Card>
  )
}

function Row({ label, value }: { label: ReactNode; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line pb-2 last:border-0">
      <dt className="text-ink-2">{label}</dt>
      <dd className="tabular font-semibold">{value}</dd>
    </div>
  )
}

export function PayoutDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, dispatch } = useStore()
  const { availableToSend } = feeSummary(state)
  const [amount, setAmount] = useState<number | ''>('')
  const [reference, setReference] = useState('')
  const value = amount === '' ? availableToSend : amount
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record a payout"
      subtitle={`Up to ${formatKES(availableToSend)} can be sent now`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              const r = dispatch({ type: 'RECORD_PAYOUT', amount: value, reference })
              if (r.ok) {
                setAmount('')
                setReference('')
                onClose()
              }
            }}
          >
            Record payout
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-ink-2">
          Send the service fees by M-Pesa, then record it here. The balance goes down once the super admin confirms they received it.
        </p>
        <Field label="Amount (KES)">
          <input type="number" min={1} className={inputClass} value={value} onChange={(e) => setAmount(e.target.value === '' ? '' : Math.floor(Number(e.target.value)))} />
        </Field>
        <Field label="M-Pesa confirmation code">
          <input className={inputClass} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. SJK7H2L9QX" />
        </Field>
      </div>
    </Modal>
  )
}
