import { ChevronLeft, CircleCheck, ExternalLink, Mail, MailOpen, Plus, Search, Send, StickyNote } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { PageHeader } from '../components/Layout'
import { CreateOrderDialog } from '../components/orders'
import { Avatar, Button, cx, EmptyState, inputClass, Segmented, StatusChip, UnreadBadge } from '../components/ui'
import { AUTO_REPLY } from '../domain/actions'
import { formatDate, formatKES, formatTime, isSameDay, relativeTime } from '../domain/format'
import { customerStats, lastMessageAt, unreadCount, unreadTotals } from '../domain/metrics'
import { orderSummary, orderTotal } from '../domain/orders'
import type { Message, Thread } from '../domain/types'
import { navigate } from '../router'
import { makeTypingNotifier, useLiveSignals } from '../state/live'
import { userName, useStore } from '../state/store'

type Filter = 'ALL' | 'UNREAD' | 'ONLINE'

const STARTED_FROM: Record<Thread['startedFrom'], string> = {
  CHAT_LINK: 'Started from the chat link',
  ORDER_FORM: 'Started from the shop',
  PORTAL: 'Started from My account',
}

export function Inbox({ threadId }: { threadId?: string }) {
  const { state } = useStore()
  const live = useLiveSignals()
  const [filter, setFilter] = useState<Filter>('ALL')
  const [query, setQuery] = useState('')
  const selected = state.threads.find((t) => t.id === threadId)
  const q = query.trim().toLowerCase()
  const threads = [...state.threads]
    .filter((t) => {
      if (filter === 'UNREAD' && unreadCount(t) === 0) return false
      if (filter === 'ONLINE' && !live.isOnline(t.id)) return false
      if (!q) return true
      const c = state.customers.find((x) => x.id === t.customerId)
      return [c?.name ?? '', c?.phone ?? '', ...t.messages.map((m) => m.text)].some((s) => s.toLowerCase().includes(q))
    })
    .sort((a, b) => lastMessageAt(b).localeCompare(lastMessageAt(a)))
  const unread = unreadTotals(state.threads)
  const onlineNow = state.threads.filter((t) => live.isOnline(t.id)).length

  return (
    <>
      <div className={cx(selected && 'hidden lg:block')}>
        <PageHeader
          title="Live chat"
          subtitle={`Customers chat from the shop and the link in your bio · ${unread.messages} unread`}
          actions={
            <>
              <AvailabilitySwitch />
              <a href="#/chat" className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line-strong bg-surface px-4 text-sm font-medium hover:bg-surface-2">
                <ExternalLink size={14} aria-hidden /> Customer view
              </a>
            </>
          }
        />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:h-[calc(100vh-170px)] lg:min-h-[520px] lg:grid-cols-[320px_1fr] xl:grid-cols-[320px_1fr_280px]">
        <section className={cx('flex min-h-0 flex-col rounded-2xl border border-line bg-surface shadow-card', selected && 'hidden lg:flex')}>
          <div className="space-y-3 border-b border-line p-3">
            <label className="relative block">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
              <input id="inbox-search" className={`${inputClass} pl-9`} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search chats" aria-label="Search chats" />
            </label>
            <Segmented
              label="Filter chats"
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'ALL', label: 'All' },
                { value: 'UNREAD', label: 'Unread', count: unread.threads },
                { value: 'ONLINE', label: 'Online now', count: onlineNow },
              ]}
            />
          </div>
          <ul className="scroll-thin min-h-0 flex-1 overflow-y-auto p-2">
            {threads.length === 0 && (
              <li className="p-4 text-center text-sm text-muted">{filter === 'ONLINE' ? 'No customers have the chat open right now.' : 'No chats.'}</li>
            )}
            {threads.map((t) => (
              <ThreadRow key={t.id} thread={t} active={t.id === threadId} online={live.isOnline(t.id)} typing={live.isTyping(t.id, 'customer')} />
            ))}
          </ul>
          <p className="border-t border-line px-4 py-3 text-[11px] leading-snug text-muted">
            Try it: open <a href="#/chat" className="font-medium text-ink underline">Customer view</a> in a second tab and send a message. It appears here instantly.
          </p>
        </section>

        {selected ? (
          <Conversation key={selected.id} thread={selected} online={live.isOnline(selected.id)} typing={live.isTyping(selected.id, 'customer')} />
        ) : (
          <section className="hidden items-center justify-center rounded-2xl border border-line bg-surface lg:flex">
            <p className="text-sm text-muted">Pick a chat to read and reply.</p>
          </section>
        )}
        {selected && <CustomerPanel thread={selected} />}
      </div>
    </>
  )
}

function AvailabilitySwitch() {
  const { state, dispatch } = useStore()
  const online = state.chatStatus === 'ONLINE'
  return (
    <button
      type="button"
      role="switch"
      aria-checked={online}
      onClick={() => dispatch({ type: 'SET_CHAT_STATUS', status: online ? 'AWAY' : 'ONLINE' })}
      className={cx(
        'inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium',
        online ? 'border-green bg-green-wash text-green-ink' : 'border-line-strong bg-amber-wash text-amber-ink',
      )}
      title="Customers see whether you're available"
    >
      <span className={cx('h-2.5 w-2.5 rounded-full', online ? 'bg-[#3fa66b]' : 'bg-[#d39b2a]')} aria-hidden />
      {online ? 'Online' : 'Away'}
    </button>
  )
}

function ThreadRow({ thread, active, online, typing }: { thread: Thread; active: boolean; online: boolean; typing: boolean }) {
  const { state } = useStore()
  const customer = state.customers.find((c) => c.id === thread.customerId)
  const last = thread.messages[thread.messages.length - 1]
  const n = unreadCount(thread)
  return (
    <li>
      <a href={`#/admin/inbox/${thread.id}`} aria-current={active ? 'true' : undefined} className={cx('flex items-center gap-3 rounded-xl px-3 py-2.5', active ? 'bg-green-wash' : 'hover:bg-surface-2')}>
        <span className="relative">
          <Avatar name={customer?.name ?? 'Customer'} size={40} />
          {online && <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surface bg-[#3fa66b]" aria-label="Online now" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className={cx('truncate text-sm', n ? 'font-semibold' : 'font-medium')}>{customer?.name ?? 'Customer'}</span>
            <span className="shrink-0 text-[11px] text-muted">{relativeTime(last.at)}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className={cx('truncate text-xs', n ? 'text-ink' : 'text-muted')}>
              {typing ? <em className="text-green-ink">typing…</em> : `${last.from === 'SHOP' ? 'You: ' : ''}${last.text}`}
            </span>
            <UnreadBadge count={n} />
          </div>
        </div>
      </a>
    </li>
  )
}

const QUICK_REPLIES = ['Thank you so much! 🌸', 'Your bouquet is being made right now 💐', 'Could you share your delivery location?', 'Would you like a card message with it?']

function Conversation({ thread, online, typing }: { thread: Thread; online: boolean; typing: boolean }) {
  const { state, dispatch } = useStore()
  const [text, setText] = useState('')
  const [creating, setCreating] = useState(false)
  const end = useRef<HTMLDivElement>(null)
  const notifyTyping = useMemo(() => makeTypingNotifier(thread.id, 'shop'), [thread.id])
  const customer = state.customers.find((c) => c.id === thread.customerId)
  const unpaid = state.orders.find((o) => o.threadId === thread.id && o.status === 'PENDING_PAYMENT')
  const n = unreadCount(thread)
  const lastShop = [...thread.messages].reverse().find((m) => m.from === 'SHOP')
  const seen = lastShop && thread.customerReadAt && thread.customerReadAt >= lastShop.at

  // Opening a chat marks it read, and so does a new message arriving while it's open.
  const lastAt = lastMessageAt(thread)
  useEffect(() => {
    if (unreadCount(thread) > 0 && document.visibilityState === 'visible') dispatch({ type: 'SET_THREAD_READ', threadId: thread.id, read: true })
  }, [thread.id, lastAt])

  useEffect(() => end.current?.scrollIntoView({ block: 'end' }), [thread.messages.length, typing])

  const send = async () => {
    const r = await dispatch({ type: 'SEND_MESSAGE', threadId: thread.id, text })
    if (r.ok) setText('')
  }

  return (
    <section className="flex min-h-[70vh] flex-col rounded-2xl border border-line bg-surface shadow-card lg:min-h-0">
      <header className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
        <button type="button" onClick={() => navigate({ page: 'inbox' })} className="-ml-1 rounded-full p-1.5 hover:bg-surface-2 lg:hidden" aria-label="Back to chats">
          <ChevronLeft size={20} />
        </button>
        <Avatar name={customer?.name ?? 'Customer'} size={40} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{customer?.name ?? 'Customer'}</div>
          <div className="flex items-center gap-1.5 text-xs text-muted">
            {online ? (
              <>
                <span className="h-2 w-2 rounded-full bg-[#3fa66b]" aria-hidden /> <span className="text-green-ink">On the chat now</span>
              </>
            ) : (
              <span>{STARTED_FROM[thread.startedFrom]}</span>
            )}
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
          return (
            <div key={m.id}>
              {(!prev || !isSameDay(new Date(prev.at), new Date(m.at))) && <div className="my-3 text-center text-[11px] font-medium text-muted">{formatDate(m.at)}</div>}
              <StaffBubble message={m} />
              {m.id === lastShop?.id && seen && <div className="mt-0.5 text-right text-[10px] text-muted">Seen</div>}
            </div>
          )
        })}
        {typing && (
          <div className="flex justify-start">
            <span className="rounded-2xl rounded-bl-md bg-surface-2 px-3.5 py-2 text-sm italic text-muted">{customer?.name.split(' ')[0] ?? 'Customer'} is typing…</span>
          </div>
        )}
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
            id="inbox-reply"
            className={cx(inputClass, 'max-h-32 min-h-10 resize-none')}
            rows={1}
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              notifyTyping()
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
            placeholder={`Reply to ${customer?.name.split(' ')[0] ?? 'customer'}…`}
            aria-label="Reply"
          />
          <Button type="submit" variant="primary" className="!h-10 !w-10 !px-0" aria-label="Send">
            <Send size={16} />
          </Button>
        </form>
      </footer>

      <CreateOrderDialog key={`${thread.id}-${creating}`} open={creating} onClose={() => setCreating(false)} thread={thread} />
    </section>
  )
}

function StaffBubble({ message: m }: { message: Message }) {
  const { state } = useStore()
  if (m.from === 'SYSTEM') {
    return (
      <div className="flex justify-center">
        <span className="rounded-full bg-green-wash px-3 py-1 text-xs text-green-ink">{m.text}</span>
      </div>
    )
  }
  const shop = m.from === 'SHOP'
  const order = m.orderId ? state.orders.find((o) => o.id === m.orderId) : undefined
  return (
    <div className={cx('flex', shop ? 'justify-end' : 'justify-start')}>
      <div className={cx('max-w-[78%] rounded-2xl px-3.5 py-2 text-sm', shop ? 'rounded-br-md bg-green text-on-green' : 'rounded-bl-md bg-surface-2 text-ink')}>
        <p className="whitespace-pre-wrap">{m.text}</p>
        {m.kind === 'PAYMENT_LINK' && order && (
          <div className="mt-2 rounded-lg bg-black/10 px-2.5 py-1.5 text-xs">
            {orderSummary(state, order)} · {formatKES(orderTotal(order))} ·{' '}
            {order.payment.status === 'UNPAID' ? (
              'not paid yet'
            ) : (
              <span className="inline-flex items-center gap-1 font-semibold">
                <CircleCheck size={12} aria-hidden /> paid
              </span>
            )}
          </div>
        )}
        <div className={cx('mt-0.5 text-right text-[10px]', shop ? 'opacity-70' : 'text-muted')}>
          {m.by === AUTO_REPLY && `${userName(state, AUTO_REPLY)} · `}
          {formatTime(m.at)}
          {m.from === 'CUSTOMER' && !m.read && ' · unread'}
        </div>
      </div>
    </div>
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
        <a href={`#/admin/customers/${customer.id}`} className="font-semibold hover:underline">
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
