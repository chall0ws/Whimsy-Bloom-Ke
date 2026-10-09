import { useEffect, useState } from 'react'

/**
 * Short-lived chat signals (typing, "customer is on the page") that are never saved.
 * In Stage A they travel between browser tabs over a BroadcastChannel; in Stage B
 * the same events go over the backend's realtime connection.
 */
export interface LiveEvent {
  kind: 'typing' | 'presence'
  threadId: string
  from: 'customer' | 'shop'
  at: number
}

const TYPING_MS = 4_000
const PRESENCE_MS = 40_000

let channel: BroadcastChannel | null | undefined
const listeners = new Set<(e: LiveEvent) => void>()

function getChannel(): BroadcastChannel | null {
  if (channel !== undefined) return channel
  try {
    channel = new BroadcastChannel('whimsy-bloom:live')
    channel.onmessage = (msg: MessageEvent<LiveEvent>) => listeners.forEach((l) => l(msg.data))
  } catch {
    channel = null
  }
  return channel
}

export function sendLive(event: Omit<LiveEvent, 'at'>) {
  try {
    getChannel()?.postMessage({ ...event, at: Date.now() })
  } catch {
    // Signals are best-effort; the chat works without them.
  }
}

/** Sends a typing signal at most every 2 seconds while the user types. */
export function makeTypingNotifier(threadId: string, from: LiveEvent['from']) {
  let last = 0
  return () => {
    const now = Date.now()
    if (now - last < 2_000) return
    last = now
    sendLive({ kind: 'typing', threadId, from })
  }
}

export function useLiveSignals() {
  const [events, setEvents] = useState<Record<string, number>>({})
  const [, tick] = useState(0)

  useEffect(() => {
    getChannel()
    const onEvent = (e: LiveEvent) => setEvents((prev) => ({ ...prev, [`${e.kind}:${e.from}:${e.threadId}`]: e.at }))
    listeners.add(onEvent)
    // Re-render now and then so signals expire on time.
    const timer = setInterval(() => tick((n) => n + 1), 1_000)
    return () => {
      listeners.delete(onEvent)
      clearInterval(timer)
    }
  }, [])

  const fresh = (key: string, ms: number) => Date.now() - (events[key] ?? 0) < ms
  return {
    isTyping: (threadId: string, from: LiveEvent['from']) => fresh(`typing:${from}:${threadId}`, TYPING_MS),
    /** The customer has the chat open right now. */
    isOnline: (threadId: string) => fresh(`presence:customer:${threadId}`, PRESENCE_MS) || fresh(`typing:customer:${threadId}`, PRESENCE_MS),
  }
}

/** While mounted, tells other tabs this customer has the chat open. */
export function usePresence(threadId: string | undefined) {
  useEffect(() => {
    if (!threadId) return
    const ping = () => document.visibilityState === 'visible' && sendLive({ kind: 'presence', threadId, from: 'customer' })
    ping()
    const timer = setInterval(ping, 15_000)
    document.addEventListener('visibilitychange', ping)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', ping)
    }
  }, [threadId])
}
