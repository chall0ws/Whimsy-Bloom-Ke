import { useCallback, useRef, useState } from 'react'
import type { Message } from '../../domain/types'

/** A message shown straight away while it's on its way to the shop. */
export interface PendingMessage {
  clientId: string
  text: string
  at: string
}

export function newClientId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/**
 * The text box of a chat. Send clears it at once and shows the message as "Sending…", so a
 * slow connection never tempts anyone to press Enter twice. Messages go one at a time, in order,
 * each with its own id so the server ignores a repeat. If one fails, its text comes back.
 */
export function useChatComposer(post: (text: string, clientId: string) => Promise<{ ok: boolean }>, initialText = '') {
  const [text, setTextState] = useState(initialText)
  const [pending, setPending] = useState<PendingMessage[]>([])
  // The text as typed right now: a second Enter before React redraws must see the cleared box.
  const current = useRef(initialText)
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const postRef = useRef(post)
  postRef.current = post

  const setText = useCallback((value: string) => {
    current.current = value
    setTextState(value)
  }, [])

  const send = useCallback(() => {
    const message = current.current.trim()
    if (!message) return
    setText('')
    const item: PendingMessage = { clientId: newClientId(), text: message, at: new Date().toISOString() }
    setPending((list) => [...list, item])
    queue.current = queue.current.then(async () => {
      const result = await postRef.current(item.text, item.clientId).catch(() => ({ ok: false }))
      setPending((list) => list.filter((p) => p.clientId !== item.clientId))
      // Put it back to try again, unless they've started typing something else.
      if (!result.ok && !current.current.trim()) setText(item.text)
    })
  }, [setText])

  return { text, setText, send, pending, busy: pending.length > 0 }
}

/** Pending messages the shop's copy of the chat doesn't have yet. */
export function stillPending(pending: PendingMessage[], messages: Message[]): PendingMessage[] {
  if (pending.length === 0) return pending
  const arrived = new Set(messages.map((m) => m.clientId).filter(Boolean))
  return pending.filter((p) => !arrived.has(p.clientId))
}
