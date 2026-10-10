import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { LIVE } from '../config'
import { applyAction, type Action, type ActionResult } from '../domain/actions'
import { unreadTotals } from '../domain/metrics'
import { createEmptyState, createSeedState, STATE_VERSION } from '../domain/seed'
import type { AppState, User } from '../domain/types'
import { getSupabase } from '../lib/supabase'
import { api, saveGuestToken } from './api'

const STORAGE_KEY = 'whimsy-bloom:state'

export interface Toast {
  id: number
  text: string
  tone: 'info' | 'error'
}

interface Store {
  state: AppState
  /** False until live data has arrived from the server. Always true in demo mode. */
  ready: boolean
  now: Date
  user: User
  isSuperAdmin: boolean
  /** Applies an action, shows its notices or error as toasts, and returns the result. */
  dispatch: (action: Action) => Promise<ActionResult>
  /** Fetches the latest data from the server (live mode). */
  refresh: () => Promise<void>
  toasts: Toast[]
  toast: (text: string, tone?: Toast['tone']) => void
  dismissToast: (id: number) => void
  openOrderId: string | null
  openOrder: (id: string | null) => void
  resetDemo: () => void
}

const StoreContext = createContext<Store | null>(null)

function readStored(): AppState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as AppState
      if (parsed.version === STATE_VERSION) return parsed
    }
  } catch {
    // Storage can be blocked (private mode, previews); fall back to fresh demo data.
  }
  return null
}

function loadState(now: Date): AppState {
  // Live: start with the catalogue so the shop shows at once; the rest arrives from the server.
  if (LIVE) return createEmptyState()
  // Nobody is signed in until the sign-in check says so, whatever the last tab saved.
  return { ...(readStored() ?? createSeedState(now)), currentUserId: '' }
}

/** Only the dashboard (#/admin) shows team notifications; everything else is the shop. */
const onCustomerPage = () => !/^#\/?admin/.test(window.location.hash)

function saveState(state: AppState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Not fatal: the dashboard still works for this visit.
  }
}

type ServerAction = Extract<ActionResult, { ok: true }> & { guestToken?: string }

export function StoreProvider({ children }: { children: ReactNode }) {
  const { account } = useAuth()
  const [state, setState] = useState(() => loadState(new Date()))
  const [ready, setReady] = useState(!LIVE)
  const stateRef = useRef(state)
  const [now, setNow] = useState(() => new Date())
  const [toasts, setToasts] = useState<Toast[]>([])
  const [openOrderId, openOrder] = useState<string | null>(null)
  const toastId = useRef(0)

  const dismissToast = useCallback((id: number) => setToasts((ts) => ts.filter((t) => t.id !== id)), [])

  const toast = useCallback(
    (text: string, tone: Toast['tone'] = 'info') => {
      const id = ++toastId.current
      setToasts((ts) => [...ts.slice(-3), { id, text, tone }])
      setTimeout(() => dismissToast(id), tone === 'error' ? 6000 : 4500)
    },
    [dismissToast],
  )
  const toastRef = useRef(toast)
  toastRef.current = toast

  /** Shows new data, with a nudge on the dashboard when a customer has written. */
  const receive = useCallback((next: AppState) => {
    const before = stateRef.current
    stateRef.current = next
    setState(next)
    if (!onCustomerPage() && unreadTotals(next.threads).messages > unreadTotals(before.threads).messages) {
      const thread = next.threads.find((t) => t.messages.at(-1)?.from === 'CUSTOMER' && t.messages.at(-1)?.at !== before.threads.find((b) => b.id === t.id)?.messages.at(-1)?.at)
      const name = next.customers.find((c) => c.id === thread?.customerId)?.name ?? 'a customer'
      toastRef.current(`New chat message from ${name}`)
    }
  }, [])

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(timer)
  }, [])

  // ------------------------------------------------------------ live mode

  const lastError = useRef('')
  const refresh = useCallback(async () => {
    if (!LIVE) return
    const res = await api<{ ok: boolean; state?: AppState; error?: string }>('state').catch(() => ({ ok: false, error: 'The shop’s server can’t be reached right now.' }) as const)
    if (res.ok && res.state) {
      receive(res.state)
      setReady(true)
      lastError.current = ''
    } else if (res.error && res.error !== lastError.current) {
      lastError.current = res.error
      toastRef.current(res.error, 'error')
      setReady(true)
    }
  }, [receive])

  // Fetch when the page opens and whenever someone signs in or out.
  useEffect(() => {
    if (LIVE) refresh()
  }, [account?.email, refresh])

  // Refresh when the server says something changed, when the tab comes back, and every 30 seconds as a fallback.
  useEffect(() => {
    if (!LIVE) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const soon = () => {
      clearTimeout(timer)
      timer = setTimeout(refresh, 250)
    }
    let unsubscribe = () => {}
    getSupabase().then((sb) => {
      const channel = sb.channel('whimsy-changes').on('broadcast', { event: 'changed' }, soon).subscribe()
      unsubscribe = () => void sb.removeChannel(channel)
    })
    const onVisible = () => document.visibilityState === 'visible' && soon()
    document.addEventListener('visibilitychange', onVisible)
    const poll = setInterval(() => document.visibilityState === 'visible' && refresh(), 30_000)
    return () => {
      unsubscribe()
      clearTimeout(timer)
      clearInterval(poll)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refresh])

  // ------------------------------------------------------------ demo mode

  // Save only our own changes. Saving data that just arrived from another tab would echo it back forever.
  useEffect(() => {
    if (!LIVE && !readStored()) saveState(stateRef.current)
  }, [])

  // Demo: another tab (for example the customer chat) changed the shared data.
  useEffect(() => {
    if (LIVE) return
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return
      const incoming = readStored()
      // Who is signed in belongs to this tab only.
      if (incoming) receive({ ...incoming, currentUserId: stateRef.current.currentUserId })
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [receive])

  const dispatch = useCallback(
    async (action: Action): Promise<ActionResult> => {
      const quiet = action.type.startsWith('CUSTOMER_')
      if (LIVE) {
        const res = await api<ServerAction | { ok: false; error: string }>('action', { action }).catch(
          () => ({ ok: false, error: 'The shop’s server can’t be reached right now. Please try again.' }) as const,
        )
        if (!res.ok) {
          toast(res.error, 'error')
          return res
        }
        if (res.guestToken) saveGuestToken(res.guestToken)
        stateRef.current = res.state
        setState(res.state)
        if (!quiet) res.notices.forEach((n) => toast(n))
        return res
      }
      // Start from the latest saved data so changes made in another tab aren't overwritten.
      const stored = readStored()
      const base = stored ? { ...stored, currentUserId: stateRef.current.currentUserId } : stateRef.current
      const result = applyAction(base, action, new Date())
      if (result.ok) {
        stateRef.current = result.state
        setState(result.state)
        saveState(result.state)
        if (!quiet) result.notices.forEach((n) => toast(n))
      } else {
        toast(result.error, 'error')
      }
      return result
    },
    [toast],
  )

  const resetDemo = useCallback(() => {
    if (LIVE) return
    const fresh = { ...createSeedState(new Date()), currentUserId: stateRef.current.currentUserId }
    stateRef.current = fresh
    setState(fresh)
    saveState(fresh)
    openOrder(null)
    toast('Demo data reset.')
  }, [toast])

  const value = useMemo<Store>(() => {
    const user = state.users.find((u) => u.id === state.currentUserId) ?? { id: '', name: '', email: '', role: 'ADMIN' as const, title: '' }
    return {
      state,
      ready,
      now,
      user,
      isSuperAdmin: user.role === 'SUPER_ADMIN',
      dispatch,
      refresh,
      toasts,
      toast,
      dismissToast,
      openOrderId,
      openOrder,
      resetDemo,
    }
  }, [state, ready, now, dispatch, refresh, toasts, toast, dismissToast, openOrderId, resetDemo])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): Store {
  const store = useContext(StoreContext)
  if (!store) throw new Error('useStore must be used inside StoreProvider')
  return store
}

export function userName(state: AppState, id: string): string {
  if (id === 'customer') return 'Customer'
  if (id === 'auto') return 'Automatic reply'
  if (id === 'paystack') return 'Paystack'
  return state.users.find((u) => u.id === id)?.name ?? (id.startsWith('u-') ? 'Whimsy & Bloom' : id)
}
