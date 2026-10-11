import { accessToken } from '../lib/supabase'

const TOKENS_KEY = 'whimsy-bloom:guest-tokens'

/** Secrets for guest orders and chats from this browser (live mode). */
export function guestTokens(): string[] {
  try {
    return JSON.parse(localStorage.getItem(TOKENS_KEY) ?? '[]') as string[]
  } catch {
    return []
  }
}

export function saveGuestToken(token: string) {
  try {
    localStorage.setItem(TOKENS_KEY, JSON.stringify([token, ...guestTokens().filter((t) => t !== token)].slice(0, 50)))
  } catch {
    // Without storage the guest can still finish this visit.
  }
}

/** Calls one of the shop's server functions as the signed-in person (or as a guest). */
export async function api<T>(path: string, body: Record<string, unknown> = {}): Promise<T> {
  const token = await accessToken().catch(() => null)
  const res = await fetch(`./api/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ ...body, guestTokens: guestTokens() }),
  })
  const data = (await res.json().catch(() => ({ ok: false, error: 'The shop’s server didn’t answer. Please try again.' }))) as T
  return data
}
