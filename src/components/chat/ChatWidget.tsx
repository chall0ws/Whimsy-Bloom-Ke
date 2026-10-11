import { CircleCheck, Send, Smartphone, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { formatDate, formatKES, formatTime, isSameDay } from '../../domain/format'
import { amountDue, orderSummary, orderTotal, paymentStage } from '../../domain/orders'
import type { Message, Thread } from '../../domain/types'
import { makeTypingNotifier, useLiveSignals, usePresence } from '../../state/live'
import { payLabel, payingLabel, usePayNow } from '../../shop/OrderBits'
import { useStore } from '../../state/store'
import { BloomMark } from '../Logo'
import { Button, cx, Field, inputClass } from '../ui'

const MY_CHAT_KEY = 'whimsy-bloom:my-chat'

function readMyChat(): string | null {
  try {
    return localStorage.getItem(MY_CHAT_KEY)
  } catch {
    return null
  }
}

function writeMyChat(id: string | null) {
  try {
    if (id) localStorage.setItem(MY_CHAT_KEY, id)
    else localStorage.removeItem(MY_CHAT_KEY)
  } catch {
    // Without storage the chat still works until the page is closed.
  }
}

/** The customer's own conversation in this browser, if they've started one. */
export function useMyThread() {
  const { state } = useStore()
  const [, rerender] = useState(0)
  // Read on every render so the chat pop-up and its button agree on which chat is ours.
  const threadId = readMyChat()
  const thread = state.threads.find((t) => t.id === threadId)
  const set = (id: string | null) => {
    writeMyChat(id)
    rerender((n) => n + 1)
  }
  return [thread, set] as const
}

/** Shop replies the customer hasn't seen yet. */
export function customerUnread(thread: Thread | undefined): number {
  if (!thread) return 0
  return thread.messages.filter((m) => m.from !== 'CUSTOMER' && (!thread.customerReadAt || m.at > thread.customerReadAt)).length
}

const STARTERS = ['I’d like to order a bouquet', 'How much is delivery?', 'Can you do custom colours?']

export interface ChatIdentity {
  customerId: string
  name: string
  phone: string
}

/**
 * Customer-facing live chat. Used full-page (the link in her bio), as the pop-up on
 * the order form, and inside the client portal, where `identity` comes from the
 * signed-in account so customers don't type their details again.
 */
export function ChatWidget({
  startedFrom,
  onClose,
  className,
  identity,
  initialText,
}: {
  startedFrom: Thread['startedFrom']
  onClose?: () => void
  className?: string
  identity?: ChatIdentity
  initialText?: string
}) {
  const { state } = useStore()
  const [myThread, setThreadId] = useMyThread()
  const thread = identity ? state.threads.find((t) => t.customerId === identity.customerId) : myThread
  const online = state.chatStatus === 'ONLINE'

  return (
    <div className={cx('flex min-h-0 flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-2xl', className)}>
      <header className="flex items-center gap-3 bg-green px-4 py-3 text-on-green">
        <span className="rounded-full bg-surface p-1">
          <BloomMark size={30} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-display text-lg font-semibold leading-tight tracking-wide">Whimsy &amp; Bloom</div>
          <div className="flex items-center gap-1.5 text-xs opacity-90">
            <span className={cx('h-2 w-2 rounded-full', online ? 'bg-[#7ee2a1]' : 'bg-[#e9c46a]')} aria-hidden />
            {online ? 'Online · usually replies in a few minutes' : 'Away · we’ll reply as soon as we’re back'}
          </div>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} className="rounded-full p-1.5 hover:bg-white/10" aria-label="Close chat">
            <X size={18} />
          </button>
        )}
      </header>
      {thread ? (
        <Conversation key={initialText} thread={thread} onReset={identity ? undefined : () => setThreadId(null)} initialText={initialText} />
      ) : identity ? (
        <FirstMessage identity={identity} startedFrom={startedFrom} initialText={initialText} />
      ) : (
        <StartChat startedFrom={startedFrom} onStarted={(id) => setThreadId(id)} />
      )}
    </div>
  )
}

function StartChat({ startedFrom, onStarted }: { startedFrom: Thread['startedFrom']; onStarted: (threadId: string) => void }) {
  const { dispatch } = useStore()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [text, setText] = useState('')
  const submit = async () => {
    const r = await dispatch({ type: 'CUSTOMER_START_CHAT', name, phone, text, startedFrom })
    if (r.ok && r.threadId) onStarted(r.threadId)
  }
  return (
    <form
      className="scroll-thin flex-1 space-y-4 overflow-y-auto p-5"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <div>
        <h2 className="font-display text-2xl font-semibold">Chat with us</h2>
        <p className="mt-1 text-sm text-muted">Ask about bouquets, colours, prices or delivery. We’ll reply right here.</p>
      </div>
      <Field label="Your name">
        <input id="chat-name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
      </Field>
      <Field label="Phone number" hint="So we can find your order and send M-Pesa payment requests.">
        <input id="chat-phone" className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07…" inputMode="tel" autoComplete="tel" />
      </Field>
      <Field label="Message">
        <textarea id="chat-first-message" className={inputClass} rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Hi! I’d like…" />
      </Field>
      <div className="flex flex-wrap gap-1.5">
        {STARTERS.map((s) => (
          <button key={s} type="button" onClick={() => setText(s)} className="rounded-full border border-line-strong px-3 py-1 text-xs text-ink-2 hover:bg-surface-2">
            {s}
          </button>
        ))}
      </div>
      <Button type="submit" variant="primary" className="w-full">
        Start chat
      </Button>
    </form>
  )
}

/** A signed-in customer's first message starts the chat with the details from their account. */
function FirstMessage({ identity, startedFrom, initialText = '' }: { identity: ChatIdentity; startedFrom: Thread['startedFrom']; initialText?: string }) {
  const { dispatch } = useStore()
  const [text, setText] = useState(initialText)
  const send = () => dispatch({ type: 'CUSTOMER_START_CHAT', name: identity.name, phone: identity.phone, text, startedFrom })
  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 py-8 text-center">
        <BloomMark size={44} />
        <p className="font-display text-xl font-semibold">Hi {identity.name.split(' ')[0]}!</p>
        <p className="max-w-xs text-sm text-muted">Ask about bouquets, colours, prices or an order. We’ll reply right here.</p>
        <div className="flex flex-wrap justify-center gap-1.5">
          {STARTERS.map((s) => (
            <button key={s} type="button" onClick={() => setText(s)} className="rounded-full border border-line-strong px-3 py-1 text-xs text-ink-2 hover:bg-surface-2">
              {s}
            </button>
          ))}
        </div>
      </div>
      <Composer text={text} setText={setText} onSend={send} />
    </>
  )
}

function Composer({ text, setText, onSend, onTyping }: { text: string; setText: (t: string) => void; onSend: () => void; onTyping?: () => void }) {
  return (
    <form
      className="flex items-end gap-2 border-t border-line p-3"
      onSubmit={(e) => {
        e.preventDefault()
        onSend()
      }}
    >
      <textarea
        id="chat-reply"
        className={cx(inputClass, 'max-h-28 min-h-10 resize-none')}
        rows={1}
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          onTyping?.()
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            onSend()
          }
        }}
        placeholder="Type a message…"
        aria-label="Message"
      />
      <Button type="submit" variant="primary" className="!h-10 !w-10 !px-0" aria-label="Send">
        <Send size={16} />
      </Button>
    </form>
  )
}

function Conversation({ thread, onReset, initialText = '' }: { thread: Thread; onReset?: () => void; initialText?: string }) {
  const { dispatch } = useStore()
  const [text, setText] = useState(initialText)
  const end = useRef<HTMLDivElement>(null)
  const live = useLiveSignals()
  const notifyTyping = useMemo(() => makeTypingNotifier(thread.id, 'customer'), [thread.id])
  usePresence(thread.id)
  const unseen = customerUnread(thread)
  const lastCustomer = [...thread.messages].reverse().find((m) => m.from === 'CUSTOMER')

  // Mark replies as seen while the chat is open and visible.
  useEffect(() => {
    if (unseen > 0 && document.visibilityState === 'visible') dispatch({ type: 'CUSTOMER_READ', threadId: thread.id })
  }, [unseen, thread.id, dispatch])

  // Braces matter: newer browsers return a promise from scrollIntoView, and React would try to call it as a clean-up.
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' })
  }, [thread.messages.length])

  const send = async () => {
    const r = await dispatch({ type: 'CUSTOMER_SEND_MESSAGE', threadId: thread.id, text })
    if (r.ok) setText('')
  }

  return (
    <>
      <div className="scroll-thin min-h-0 flex-1 space-y-2 overflow-y-auto bg-bg/50 px-4 py-4" aria-live="polite">
        {thread.messages.map((m, i) => {
          const prev = thread.messages[i - 1]
          return (
            <div key={m.id}>
              {(!prev || !isSameDay(new Date(prev.at), new Date(m.at))) && <div className="my-2 text-center text-[11px] text-muted">{formatDate(m.at)}</div>}
              <CustomerBubble message={m} />
              {m.id === lastCustomer?.id && m.read && <div className="mt-0.5 text-right text-[10px] text-muted">Seen</div>}
            </div>
          )
        })}
        {live.isTyping(thread.id, 'shop') && <div className="text-xs italic text-muted">Whimsy &amp; Bloom is typing…</div>}
        <div ref={end} />
      </div>
      <Composer text={text} setText={setText} onSend={send} onTyping={notifyTyping} />
      {onReset && (
        <button type="button" onClick={onReset} className="pb-2 text-center text-[11px] text-muted hover:text-ink">
          Not you? Start a new chat
        </button>
      )}
    </>
  )
}

function CustomerBubble({ message: m }: { message: Message }) {
  if (m.from === 'SYSTEM') {
    return (
      <div className="flex justify-center">
        <span className="rounded-full bg-green-wash px-3 py-1 text-center text-xs text-green-ink">{m.text}</span>
      </div>
    )
  }
  const mine = m.from === 'CUSTOMER'
  return (
    <div className={cx('flex', mine ? 'justify-end' : 'justify-start')}>
      <div className={cx('max-w-[82%] rounded-2xl px-3.5 py-2 text-sm', mine ? 'rounded-br-md bg-pink text-[#3b1a24]' : 'rounded-bl-md border border-line bg-surface text-ink')}>
        <p className="whitespace-pre-wrap">{m.text}</p>
        {m.kind === 'PAYMENT_LINK' && m.orderId && <PaymentCard orderId={m.orderId} />}
        <div className={cx('mt-0.5 text-right text-[10px]', mine ? 'opacity-70' : 'text-muted')}>{formatTime(m.at)}</div>
      </div>
    </div>
  )
}

function PaymentCard({ orderId }: { orderId: string }) {
  const { state } = useStore()
  const { pay, busy } = usePayNow()
  const order = state.orders.find((o) => o.id === orderId)

  if (!order) return null
  const due = amountDue(order)
  const stage = paymentStage(order)
  return (
    <div className="mt-2 rounded-xl border border-line bg-surface-2 p-3">
      <div className="text-xs text-muted">Order {order.number}</div>
      <div className="text-sm font-medium">{orderSummary(state, order)}</div>
      <div className="mt-0.5 text-base font-semibold">
        {due > 0 ? `${stage === 'DEPOSIT' ? 'Deposit' : 'Balance'} ${formatKES(due)}` : formatKES(orderTotal(order))}
      </div>
      {order.status === 'CANCELLED' || order.status === 'REFUNDED' ? (
        <div className="mt-2 text-sm text-muted">This order was {order.status === 'CANCELLED' ? 'cancelled' : 'refunded'}.</div>
      ) : due === 0 ? (
        <div className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-green-ink">
          <CircleCheck size={16} aria-hidden /> {order.payment.status === 'DEPOSIT_PAID' ? 'Deposit paid' : 'Paid'}
        </div>
      ) : busy ? (
        <div className="mt-2 flex items-center gap-1.5 text-sm text-ink-2">
          <Smartphone size={16} className="animate-pulse" aria-hidden /> {payingLabel}
        </div>
      ) : (
        <Button variant="primary" size="sm" className="mt-2 w-full" onClick={() => pay(order)}>
          <Smartphone size={14} aria-hidden /> {payLabel(amountDue(order), paymentStage(order))}
        </Button>
      )}
    </div>
  )
}
