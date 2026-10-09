import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { applyAction, type Action, type ActionResult } from '../domain/actions'
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

function loadState(now: Date): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as AppState
      if (parsed.version === STATE_VERSION) return parsed
    }
  } catch {
    // Storage can be blocked (private mode, previews); fall back to fresh demo data.
  }
  return createSeedState(now)
}

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

  useEffect(() => saveState(state), [state])

  const dismissToast = useCallback((id: number) => setToasts((ts) => ts.filter((t) => t.id !== id)), [])

  const toast = useCallback(
    (text: string, tone: Toast['tone'] = 'info') => {
      const id = ++toastId.current
      setToasts((ts) => [...ts.slice(-3), { id, text, tone }])
      setTimeout(() => dismissToast(id), tone === 'error' ? 6000 : 4500)
    },
    [dismissToast],
  )

  const dispatch = useCallback(
    (action: Action) => {
      const result = applyAction(stateRef.current, action, new Date())
      if (result.ok) {
        stateRef.current = result.state
        setState(result.state)
        result.notices.forEach((n) => toast(n))
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
    openOrder(null)
    toast('Demo data reset.')
  }, [toast])

  const value = useMemo<Store>(() => {
    const user = state.users.find((u) => u.id === state.currentUserId) ?? state.users[0]
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
  if (id === 'customer') return 'Customer (web form)'
  return state.users.find((u) => u.id === id)?.name ?? id
}
