import { ChevronLeft, Mail, MailOpen, Plus, Search, Send, StickyNote } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { PageHeader } from '../components/Layout'
import { CreateOrderDialog } from '../components/orders'
import { Avatar, Button, CHANNEL_LABEL, ChannelIcon, ChannelTag, cx, EmptyState, inputClass, Segmented, StatusChip, UnreadBadge } from '../components/ui'
import { formatDate, formatKES, formatTime, isSameDay, relativeTime } from '../domain/format'
import { customerStats, lastMessageAt, unreadCount, unreadTotals } from '../domain/metrics'
import { orderSummary } from '../domain/orders'
import type { Thread } from '../domain/types'
import { navigate } from '../router'
import { useStore } from '../state/store'

type Filter = 'ALL' | 'UNREAD' | 'INSTAGRAM' | 'FACEBOOK'

export function Inbox({ threadId }: { threadId?: string }) {
  const { state } = useStore()
  const [filter, setFilter] = useState<Filter>('ALL')
  const [query, setQuery] = useState('')
  const selected = state.threads.find((t) => t.id === threadId)
  const q = query.trim().toLowerCase()
  const threads = [...state.threads]
    .filter((t) => {
      if (filter === 'UNREAD' && unreadCount(t) === 0) return false
      if ((filter === 'INSTAGRAM' || filter === 'FACEBOOK') && t.channel !== filter) return false
      if (!q) return true
      const name = state.customers.find((c) => c.id === t.customerId)?.name ?? ''
      return [name, t.handle, ...t.messages.map((m) => m.text)].some((s) => s.toLowerCase().includes(q))
    })
    .sort((a, b) => lastMessageAt(b).localeCompare(lastMessageAt(a)))
  const unread = unreadTotals(state.threads)

  return (
    <>
      <div className={cx(selected && 'hidden lg:block')}>
        <PageHeader title="Consolidated messages" subtitle={`Instagram and Messenger in one inbox · ${unread.messages} unread`} />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:h-[calc(100vh-170px)] lg:min-h-[520px] lg:grid-cols-[320px_1fr] xl:grid-cols-[320px_1fr_280px]">
        <section className={cx('flex min-h-0 flex-col rounded-2xl border border-line bg-surface shadow-card', selected && 'hidden lg:flex')}>
          <div className="space-y-3 border-b border-line p-3">
            <label className="relative block">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
              <input className={`${inputClass} pl-9`} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search conversations" aria-label="Search conversations" />
            </label>
            <Segmented
              label="Filter conversations"
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'ALL', label: 'All' },
                { value: 'UNREAD', label: 'Unread', count: unread.threads },
                { value: 'INSTAGRAM', label: 'Instagram' },
                { value: 'FACEBOOK', label: 'Messenger' },
              ]}
            />
          </div>
          <ul className="scroll-thin min-h-0 flex-1 overflow-y-auto p-2">
            {threads.length === 0 && <li className="p-4 text-center text-sm text-muted">No conversations.</li>}
            {threads.map((t) => (
              <ThreadRow key={t.id} thread={t} active={t.id === threadId} />
            ))}
          </ul>
        </section>

        {selected ? (
          <Conversation key={selected.id} thread={selected} />
        ) : (
          <section className="hidden items-center justify-center rounded-2xl border border-line bg-surface lg:flex">
            <p className="text-sm text-muted">Pick a conversation to read and reply.</p>
          </section>
        )}
        {selected && <CustomerPanel thread={selected} />}
      </div>
    </>
  )
}

function ThreadRow({ thread, active }: { thread: Thread; active: boolean }) {
  const { state } = useStore()
  const customer = state.customers.find((c) => c.id === thread.customerId)
  const last = thread.messages[thread.messages.length - 1]
  const n = unreadCount(thread)
  return (
    <li>
      <a
        href={`#/inbox/${thread.id}`}
        aria-current={active ? 'true' : undefined}
        className={cx('flex items-center gap-3 rounded-xl px-3 py-2.5', active ? 'bg-green-wash' : 'hover:bg-surface-2')}
      >
        <div className="relative">
          <Avatar name={customer?.name ?? thread.handle} size={40} />
          <span className="absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-surface bg-surface p-0.5 text-ink-2">
            <ChannelIcon channel={thread.channel} size={11} />
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className={cx('truncate text-sm', n ? 'font-semibold' : 'font-medium')}>{customer?.name ?? thread.handle}</span>
            <span className="shrink-0 text-[11px] text-muted">{relativeTime(last.at)}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className={cx('truncate text-xs', n ? 'text-ink' : 'text-muted')}>
              {last.from === 'SHOP' ? 'You: ' : ''}
              {last.text}
            </span>
            <UnreadBadge count={n} />
          </div>
        </div>
      </a>
    </li>
  )
}

const QUICK_REPLIES = ['Thank you so much! 🌸', 'Your bouquet is being made right now 💐', 'Could you share your delivery location?', 'Would you like a card message with it?']

function Conversation({ thread }: { thread: Thread }) {
  const { state, dispatch } = useStore()
  const [text, setText] = useState('')
  const [creating, setCreating] = useState(false)
  const end = useRef<HTMLDivElement>(null)
  const customer = state.customers.find((c) => c.id === thread.customerId)
  const unpaid = state.orders.find((o) => o.threadId === thread.id && o.status === 'PENDING_PAYMENT')
  const n = unreadCount(thread)

  // Opening a conversation marks it read.
  useEffect(() => {
    if (unreadCount(thread) > 0) dispatch({ type: 'SET_THREAD_READ', threadId: thread.id, read: true })
  }, [thread.id])

  useEffect(() => end.current?.scrollIntoView({ block: 'end' }), [thread.messages.length])

  const send = () => {
    const r = dispatch({ type: 'SEND_MESSAGE', threadId: thread.id, text })
    if (r.ok) setText('')
  }

  return (
    <section className="flex min-h-[70vh] flex-col rounded-2xl border border-line bg-surface shadow-card lg:min-h-0">
      <header className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
        <button type="button" onClick={() => navigate({ page: 'inbox' })} className="-ml-1 rounded-full p-1.5 hover:bg-surface-2 lg:hidden" aria-label="Back to conversations">
          <ChevronLeft size={20} />
        </button>
        <Avatar name={customer?.name ?? thread.handle} size={40} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{customer?.name ?? thread.handle}</div>
          <div className="flex items-center gap-2 text-xs text-muted">
            <ChannelTag channel={thread.channel} />
            <span className="truncate">{thread.handle}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => dispatch({ type: 'SET_THREAD_READ', threadId: thread.id, read: n > 0 })} title={n > 0 ? 'Mark as read' : 'Mark as unread'}>
            {n > 0 ? <MailOpen size={14} aria-hidden /> : <Mail size={14} aria-hidden />}
            <span className="hidden sm:inline">{n > 0 ? 'Mark read' : 'Mark unread'}</span>
          </Button>
          <Button size="sm" variant="primary" onClick={() => setCreating(true)}>
            <Plus size={14} aria-hidden /> Create order
          </Button>
        </div>
      </header>

      <div className="scroll-thin min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {thread.messages.map((m, i) => {
          const prev = thread.messages[i - 1]
          const newDay = !prev || !isSameDay(new Date(prev.at), new Date(m.at))
          return (
            <div key={m.id}>
              {newDay && <div className="my-3 text-center text-[11px] font-medium text-muted">{formatDate(m.at)}</div>}
              {m.from === 'SYSTEM' ? (
                <div className="flex justify-center">
                  <span className="rounded-full bg-green-wash px-3 py-1 text-xs text-green-ink">{m.text}</span>
                </div>
              ) : (
                <div className={cx('flex', m.from === 'SHOP' ? 'justify-end' : 'justify-start')}>
                  <div className={cx('max-w-[78%] rounded-2xl px-3.5 py-2 text-sm', m.from === 'SHOP' ? 'rounded-br-md bg-green text-on-green' : 'rounded-bl-md bg-surface-2 text-ink')}>
                    <p className="whitespace-pre-wrap">{m.text}</p>
                    <div className={cx('mt-0.5 text-right text-[10px]', m.from === 'SHOP' ? 'opacity-70' : 'text-muted')}>
                      {formatTime(m.at)}
                      {m.from === 'CUSTOMER' && !m.read && ' · unread'}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
        <div ref={end} />
      </div>

      <footer className="border-t border-line p-3">
        <div className="scroll-thin mb-2 flex gap-1.5 overflow-x-auto pb-1">
          {unpaid && (
            <button type="button" onClick={() => dispatch({ type: 'SEND_PAYMENT_LINK', orderId: unpaid.id })} className="shrink-0 rounded-full border border-pink bg-pink-wash px-3 py-1 text-xs font-medium text-pink-ink">
              Resend payment link · {unpaid.number}
            </button>
          )}
          {QUICK_REPLIES.map((r) => (
            <button key={r} type="button" onClick={() => setText(r)} className="shrink-0 rounded-full border border-line-strong px-3 py-1 text-xs text-ink-2 hover:bg-surface-2">
              {r}
            </button>
          ))}
        </div>
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            send()
          }}
        >
          <textarea
            className={cx(inputClass, 'max-h-32 min-h-10 resize-none')}
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
            placeholder={`Reply on ${CHANNEL_LABEL[thread.channel]}…`}
            aria-label="Reply"
          />
          <Button type="submit" variant="primary" className="!h-10 !w-10 !px-0" aria-label="Send">
            <Send size={16} />
          </Button>
        </form>
        <p className="mt-1.5 text-[11px] text-muted">Demo: replies stay in the dashboard. Stage C sends them to Instagram and Messenger.</p>
      </footer>

      <CreateOrderDialog key={`${thread.id}-${creating}`} open={creating} onClose={() => setCreating(false)} thread={thread} />
    </section>
  )
}

function CustomerPanel({ thread }: { thread: Thread }) {
  const { state, openOrder } = useStore()
  const customer = state.customers.find((c) => c.id === thread.customerId)
  if (!customer) return null
  const stats = customerStats(state, customer.id)
  return (
    <aside className="scroll-thin hidden min-h-0 flex-col gap-4 overflow-y-auto rounded-2xl border border-line bg-surface p-4 shadow-card xl:flex">
      <div>
        <div className="eyebrow mb-1">Customer</div>
        <a href={`#/customers/${customer.id}`} className="font-semibold hover:underline">
          {customer.name}
        </a>
        {customer.phone && <div className="text-sm text-muted">{customer.phone}</div>}
        <div className="mt-2 flex flex-wrap gap-1">
          {customer.tags.map((t) => (
            <span key={t} className="rounded-full bg-taupe-wash px-2 py-0.5 text-[11px] font-medium text-taupe-ink">
              {t}
            </span>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-xl bg-surface-2 p-2.5">
          <div className="text-[11px] text-muted">Orders</div>
          <div className="font-semibold">{stats.orderCount}</div>
        </div>
        <div className="rounded-xl bg-surface-2 p-2.5">
          <div className="text-[11px] text-muted">Spent</div>
          <div className="font-semibold">{formatKES(stats.lifetimeSpend)}</div>
        </div>
      </div>
      <div>
        <div className="eyebrow mb-1 flex items-center gap-1">
          <StickyNote size={12} aria-hidden /> Notes
        </div>
        <p className="text-sm text-ink-2">{customer.notes || <span className="text-muted">No notes yet.</span>}</p>
      </div>
      <div>
        <div className="eyebrow mb-2">Orders</div>
        {stats.orders.length === 0 ? (
          <EmptyState>No orders yet.</EmptyState>
        ) : (
          <ul className="space-y-2">
            {stats.orders.slice(0, 5).map((o) => (
              <li key={o.id}>
                <button type="button" onClick={() => openOrder(o.id)} className="w-full rounded-xl border border-line p-2.5 text-left hover:bg-surface-2">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-semibold">{o.number}</span>
                    <StatusChip status={o.status} />
                  </div>
                  <div className="mt-1 truncate text-xs text-muted">
                    {orderSummary(state, o)} · {formatDate(o.createdAt)}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  )
}
