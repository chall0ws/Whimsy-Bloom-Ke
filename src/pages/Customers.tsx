import { Mail, MessageCircle, Phone, Plus, Search, X } from 'lucide-react'
import { useState } from 'react'
import { PageHeader } from '../components/Layout'
import { Avatar, Button, Card, ChannelIcon, EmptyState, inputClass, Modal, StatusChip } from '../components/ui'
import { formatDate, formatKES } from '../domain/format'
import { customerStats } from '../domain/metrics'
import { orderSummary, productName } from '../domain/orders'
import type { Customer } from '../domain/types'
import { navigate } from '../router'
import { useStore } from '../state/store'

type Sort = 'recent' | 'spend' | 'name'

export function Customers({ customerId }: { customerId?: string }) {
  const { state } = useStore()
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<Sort>('recent')
  const q = query.trim().toLowerCase()
  const rows = state.customers
    .map((c) => ({ customer: c, stats: customerStats(state, c.id) }))
    .filter(({ customer: c }) => !q || [c.name, c.instagram, c.facebook, c.phone, c.notes, ...c.tags].some((s) => s?.toLowerCase().includes(q)))
    .sort((a, b) => {
      if (sort === 'spend') return b.stats.lifetimeSpend - a.stats.lifetimeSpend
      if (sort === 'name') return a.customer.name.localeCompare(b.customer.name)
      return (b.stats.lastOrderAt ?? b.customer.createdAt).localeCompare(a.stats.lastOrderAt ?? a.customer.createdAt)
    })
  const selected = state.customers.find((c) => c.id === customerId)
  const repeat = state.customers.filter((c) => customerStats(state, c.id).orderCount >= 2).length

  return (
    <>
      <PageHeader title="Customers" subtitle={`${state.customers.length} customers · ${repeat} have ordered more than once`} />
      <Card>
        <div className="mb-4 flex flex-wrap gap-3">
          <label className="relative min-w-[220px] flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
            <input className={`${inputClass} pl-9`} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, handle, phone, notes…" aria-label="Search customers" />
          </label>
          <select className={`${inputClass} !w-auto`} value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort customers">
            <option value="recent">Most recent order</option>
            <option value="spend">Highest spend</option>
            <option value="name">Name A–Z</option>
          </select>
        </div>
        {rows.length === 0 ? (
          <EmptyState>No customers match.</EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map(({ customer: c, stats }) => (
              <li key={c.id}>
                <a href={`#/customers/${c.id}`} className="flex items-center gap-3 rounded-xl px-2 py-3 hover:bg-surface-2">
                  <Avatar name={c.name} size={38} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{c.name}</span>
                      {c.tags.map((t) => (
                        <span key={t} className="rounded-full bg-taupe-wash px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-taupe-ink">
                          {t}
                        </span>
                      ))}
                    </div>
                    <div className="truncate text-xs text-muted">
                      {[c.instagram, c.facebook && !c.instagram ? `FB: ${c.facebook}` : undefined, c.phone].filter(Boolean).join(' · ')}
                      {c.notes && <span className="text-ink-2"> · {c.notes}</span>}
                    </div>
                  </div>
                  <div className="hidden text-right sm:block">
                    <div className="tabular text-sm font-semibold">{formatKES(stats.lifetimeSpend)}</div>
                    <div className="text-xs text-muted">
                      {stats.orderCount} {stats.orderCount === 1 ? 'order' : 'orders'}
                      {stats.lastOrderAt && ` · last ${formatDate(stats.lastOrderAt)}`}
                    </div>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {selected && <CustomerProfile key={selected.id} customer={selected} />}
    </>
  )
}

function CustomerProfile({ customer }: { customer: Customer }) {
  const { state, dispatch, openOrder } = useStore()
  const [notes, setNotes] = useState(customer.notes)
  const [tag, setTag] = useState('')
  const stats = customerStats(state, customer.id)
  const thread = state.threads.find((t) => t.customerId === customer.id)
  const close = () => navigate({ page: 'customers' })
  const saveNotes = () => notes !== customer.notes && dispatch({ type: 'UPDATE_CUSTOMER', customerId: customer.id, patch: { notes } })
  const addTag = () => {
    const t = tag.trim()
    if (t && !customer.tags.includes(t)) dispatch({ type: 'UPDATE_CUSTOMER', customerId: customer.id, patch: { tags: [...customer.tags, t] } })
    setTag('')
  }

  return (
    <Modal
      open
      variant="drawer"
      onClose={() => {
        saveNotes()
        close()
      }}
      title={customer.name}
      subtitle={`Customer since ${formatDate(customer.createdAt)}`}
      footer={
        thread && (
          <Button variant="primary" onClick={() => navigate({ page: 'inbox', threadId: thread.id })}>
            <MessageCircle size={14} aria-hidden /> Open chat
          </Button>
        )
      }
    >
      <div className="space-y-5">
        <ul className="space-y-1.5 text-sm">
          {customer.instagram && (
            <li className="flex items-center gap-2">
              <ChannelIcon channel="INSTAGRAM" /> {customer.instagram}
            </li>
          )}
          {customer.facebook && (
            <li className="flex items-center gap-2">
              <ChannelIcon channel="FACEBOOK" /> {customer.facebook}
            </li>
          )}
          {customer.phone && (
            <li className="flex items-center gap-2">
              <Phone size={14} aria-hidden /> {customer.phone}
            </li>
          )}
          {customer.email && (
            <li className="flex items-center gap-2">
              <Mail size={14} aria-hidden /> {customer.email}
            </li>
          )}
        </ul>

        <div className="grid grid-cols-3 gap-2">
          <Stat label="Orders" value={String(stats.orderCount)} />
          <Stat label="Spent" value={formatKES(stats.lifetimeSpend)} />
          <Stat label="Favourite" value={stats.favouriteProductId ? productName(state, stats.favouriteProductId) : '—'} />
        </div>

        <div>
          <label htmlFor="customer-notes" className="eyebrow mb-1 block">
            Notes & preferences
          </label>
          <textarea
            id="customer-notes"
            className={inputClass}
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={saveNotes}
            placeholder="e.g. Prefers soft pink tulips. Sister’s birthday is in March."
          />
          <p className="mt-1 text-xs text-muted">Saved when you click away. Shows next to this customer’s DMs.</p>
        </div>

        <div>
          <div className="eyebrow mb-2">Tags</div>
          <div className="flex flex-wrap items-center gap-1.5">
            {customer.tags.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 rounded-full bg-taupe-wash py-0.5 pl-2.5 pr-1 text-xs font-medium text-taupe-ink">
                {t}
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'UPDATE_CUSTOMER', customerId: customer.id, patch: { tags: customer.tags.filter((x) => x !== t) } })}
                  className="rounded-full p-0.5 hover:bg-surface"
                  aria-label={`Remove tag ${t}`}
                >
                  <X size={11} />
                </button>
              </span>
            ))}
            <form
              className="flex items-center gap-1"
              onSubmit={(e) => {
                e.preventDefault()
                addTag()
              }}
            >
              <input className={`${inputClass} !h-7 !w-28 !py-0 !text-xs`} value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Add tag" aria-label="New tag" />
              <button type="submit" className="rounded-full p-1 text-muted hover:bg-surface-2" aria-label="Add tag">
                <Plus size={14} />
              </button>
            </form>
          </div>
        </div>

        <div>
          <div className="eyebrow mb-2">Order history</div>
          {stats.orders.length === 0 ? (
            <EmptyState>No orders yet.</EmptyState>
          ) : (
            <ul className="space-y-2">
              {stats.orders.map((o) => (
                <li key={o.id}>
                  <button type="button" onClick={() => openOrder(o.id)} className="flex w-full items-center gap-3 rounded-xl border border-line px-3 py-2.5 text-left hover:bg-surface-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold">
                        {o.number} <span className="font-normal text-muted">· {formatDate(o.createdAt)}</span>
                      </div>
                      <div className="truncate text-xs text-muted">
                        {orderSummary(state, o)}
                        {o.customisation && ` · ${o.customisation}`}
                      </div>
                    </div>
                    <StatusChip status={o.status} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-2 p-3">
      <div className="text-[11px] text-muted">{label}</div>
      <div className="truncate text-sm font-semibold" title={value}>
        {value}
      </div>
    </div>
  )
}
