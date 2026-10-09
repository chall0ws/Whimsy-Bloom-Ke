import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { applyAction, type Action, type ActionResult } from '../domain/actions'
import { unreadTotals } from '../domain/metrics'
import { createSeedState, STATE_VERSION } from '../domain/seed'
import type { AppState, User } from '../domain/types'

const STORAGE_KEY = 'whimsy-bloom:state'

export interface Toast {
  id: number
  text: string
  tone: 'info' | 'error'
}

interface Store {
  state: AppState
  now: Date
  user: User
  isSuperAdmin: boolean
  /** Applies an action, shows its notices or error as toasts, and returns the result. */
  dispatch: (action: Action) => ActionResult
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
  // Nobody is signed in until the sign-in check says so, whatever the last tab saved.
  return { ...(readStored() ?? createSeedState(now)), currentUserId: '' }
}

/** Customer-facing pages don't show team notifications. */
const onCustomerPage = () => /^#\/?(chat|portal|order-form)/.test(window.location.hash)

function saveState(state: AppState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Not fatal: the dashboard still works for this visit.
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(() => loadState(new Date()))
  const stateRef = useRef(state)
  const [now, setNow] = useState(() => new Date())
  const [toasts, setToasts] = useState<Toast[]>([])
  const [openOrderId, openOrder] = useState<string | null>(null)
  const toastId = useRef(0)

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(timer)
  }, [])

  // Save only our own changes. Saving data that just arrived from another tab would echo it back forever.
  useEffect(() => {
    if (!readStored()) saveState(stateRef.current)
  }, [])

  // Live updates: another tab (for example the customer chat) changed the shared data.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return
      const incoming = readStored()
      if (!incoming) return
      const before = stateRef.current
      // Who is signed in belongs to this tab only.
      const next = { ...incoming, currentUserId: before.currentUserId }
      stateRef.current = next
      setState(next)
      if (!onCustomerPage() && unreadTotals(next.threads).messages > unreadTotals(before.threads).messages) {
        const thread = next.threads.find((t) => t.messages.at(-1)?.from === 'CUSTOMER' && t.messages.at(-1)?.at !== before.threads.find((b) => b.id === t.id)?.messages.at(-1)?.at)
        const name = next.customers.find((c) => c.id === thread?.customerId)?.name ?? 'a customer'
        toastRef.current(`New chat message from ${name}`)
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

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

  const dispatch = useCallback(
    (action: Action) => {
      // Start from the latest saved data so changes made in another tab aren't overwritten.
      const stored = readStored()
      const base = stored ? { ...stored, currentUserId: stateRef.current.currentUserId } : stateRef.current
      const result = applyAction(base, action, new Date())
      if (result.ok) {
        stateRef.current = result.state
        setState(result.state)
        saveState(result.state)
        if (!action.type.startsWith('CUSTOMER_')) result.notices.forEach((n) => toast(n))
      } else {
        toast(result.error, 'error')
      }
      return result
    },
    [toast],
  )

  const resetDemo = useCallback(() => {
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
      now,
      user,
      isSuperAdmin: user.role === 'SUPER_ADMIN',
      dispatch,
      toasts,
      toast,
      dismissToast,
      openOrderId,
      openOrder,
      resetDemo,
    }
  }, [state, now, dispatch, toasts, toast, dismissToast, openOrderId, resetDemo])

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
  return state.users.find((u) => u.id === id)?.name ?? id
}
