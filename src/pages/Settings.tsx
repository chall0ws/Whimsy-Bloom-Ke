import { Lock, RotateCcw, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { PageHeader } from '../components/Layout'
import { Button, Card, cx, Field, inputClass, Modal } from '../components/ui'
import { useAuth } from '../auth/AuthProvider'
import { DEFAULT_SETTINGS } from '../domain/catalog'
import { formatDateTime } from '../domain/format'
import type { Settings as SettingsT } from '../domain/types'
import { userName, useStore } from '../state/store'

export function Settings() {
  const { state, isSuperAdmin, dispatch, resetDemo } = useStore()
  const { mode } = useAuth()
  const [draft, setDraft] = useState<SettingsT>(state.settings)
  const [confirmReset, setConfirmReset] = useState(false)
  const [showAll, setShowAll] = useState(false)

  if (!isSuperAdmin) {
    return (
      <>
        <PageHeader title="Settings" />
        <Card>
          <div className="flex items-center gap-3 text-sm text-ink-2">
            <Lock size={18} aria-hidden /> Settings are managed by the super admin.
          </div>
        </Card>
      </>
    )
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(state.settings)
  const changed = (Object.keys(draft) as (keyof SettingsT)[]).filter((k) => draft[k] !== state.settings[k])

  return (
    <>
      <PageHeader title="Settings" subtitle="Only the super admin can see and change these." />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card title="Fees & payouts">
          <div className="space-y-4">
            <Field label="Service fee per shipped order (KES)" hint="New rate applies to orders shipped from now on. Fees already charged don’t change.">
              <input type="number" min={0} className={inputClass} value={draft.serviceFee} onChange={(e) => setDraft({ ...draft, serviceFee: Math.floor(Number(e.target.value) || 0) })} />
            </Field>
            <label className="flex items-start gap-3 rounded-xl border border-line p-3">
              <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--green)]" checked={draft.feeOnHandDelivery} onChange={(e) => setDraft({ ...draft, feeOnHandDelivery: e.target.checked })} />
              <span>
                <span className="block text-sm font-semibold">Charge the service fee on orders delivered within Nairobi</span>
                <span className="block text-xs text-muted">This only decides whether those orders earn the partner fee.</span>
              </span>
            </label>
            <Field label="Usual delivery fee outside Nairobi (KES)" hint="Suggested when an order going outside Nairobi is marked ready. You set the actual fee each time.">
              <input
                type="number"
                min={0}
                className={inputClass}
                value={draft.defaultShippingFee}
                onChange={(e) => setDraft({ ...draft, defaultShippingFee: Math.floor(Number(e.target.value) || 0) })}
              />
            </Field>
            <Field label="Payout schedule">
              <select className={inputClass} value={draft.payoutSchedule} onChange={(e) => setDraft({ ...draft, payoutSchedule: e.target.value as SettingsT['payoutSchedule'] })}>
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
              </select>
            </Field>
            <div className="flex gap-2">
              <Button
                variant="primary"
                disabled={!dirty}
                onClick={async () => {
                  const patch = Object.fromEntries(changed.map((k) => [k, draft[k]])) as Partial<SettingsT>
                  const r = await dispatch({ type: 'UPDATE_SETTINGS', patch })
                  if (r.ok) setDraft(r.state.settings)
                }}
              >
                Save changes
              </Button>
              {dirty && (
                <Button variant="ghost" onClick={() => setDraft(state.settings)}>
                  Discard
                </Button>
              )}
            </div>
          </div>
        </Card>

        <Card title="Team">
          <ul className="space-y-3">
            {state.users.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-3 rounded-xl border border-line p-3">
                <div>
                  <div className="font-semibold">{u.name}</div>
                  <div className="text-xs text-muted">{u.email}</div>
                </div>
                <span
                  className={cx(
                    'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide',
                    u.role === 'SUPER_ADMIN' ? 'bg-green text-on-green' : 'bg-surface-2 text-ink-2',
                  )}
                >
                  {u.role === 'SUPER_ADMIN' && <ShieldCheck size={12} aria-hidden />}
                  {u.role === 'SUPER_ADMIN' ? 'Super admin' : 'Admin'}
                </span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <div className="rounded-xl bg-surface-2 p-3">
              <dt className="font-semibold">Admin can</dt>
              <dd className="mt-1 text-ink-2">Manage orders, messages, customers and materials. Record payouts.</dd>
            </div>
            <div className="rounded-xl bg-surface-2 p-3">
              <dt className="font-semibold">Only super admin can</dt>
              <dd className="mt-1 text-ink-2">Change fees and settings, confirm payouts, see this page and the activity log.</dd>
            </div>
          </dl>
          <p className="mt-4 text-sm text-ink-2">
            {mode === 'live' ? (
              <>Team members sign in with Google or a confirmed email. Who’s on the team is set by <code>VITE_STAFF_EMAILS</code>; everyone else who signs in is a customer.</>
            ) : (
              <>Demo mode: sign-in uses pretend accounts. To switch on real Google and email sign-in, follow <code>docs/google-login.md</code>.</>
            )}
          </p>
          {mode === 'demo' && (
            <div className="mt-4 border-t border-line pt-4">
              <Button variant="danger" onClick={() => setConfirmReset(true)}>
                <RotateCcw size={14} aria-hidden /> Reset demo data
              </Button>
            </div>
          )}
        </Card>

        <Card title="Activity log" subtitle="Every status change, payment, payout and settings change." className="xl:col-span-2">
          <ul className="divide-y divide-line">
            {(showAll ? state.audit : state.audit.slice(0, 20)).map((a) => (
              <li key={a.id} className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 py-2 text-sm">
                <span>{a.text}</span>
                <span className="text-xs text-muted">
                  {userName(state, a.by)} · {formatDateTime(a.at)}
                </span>
              </li>
            ))}
          </ul>
          {state.audit.length > 20 && (
            <Button size="sm" variant="ghost" className="mt-2" onClick={() => setShowAll(!showAll)}>
              {showAll ? 'Show fewer' : `Show all ${state.audit.length}`}
            </Button>
          )}
        </Card>
      </div>

      <Modal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Reset demo data?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmReset(false)}>
              Keep my changes
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                resetDemo()
                setDraft(DEFAULT_SETTINGS)
                setConfirmReset(false)
              }}
            >
              Reset
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-2">This replaces every order, message and fee with fresh sample data dated from today.</p>
      </Modal>
    </>
  )
}
