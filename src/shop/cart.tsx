import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

export interface CartLine {
  productId: string
  qty: number
  /** Colours, card message and other wishes for this bouquet. */
  note: string
}

interface Cart {
  lines: CartLine[]
  count: number
  add: (productId: string, qty: number, note?: string) => void
  setQty: (index: number, qty: number) => void
  setNote: (index: number, note: string) => void
  remove: (index: number) => void
  clear: () => void
}

const KEY = 'whimsy-bloom:cart'
const CartContext = createContext<Cart | null>(null)

function read(): CartLine[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as CartLine[]) : []
  } catch {
    return []
  }
}

/** The basket lives in this browser, so shoppers never have to sign in to fill it. */
export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(read)

  const update = useCallback((fn: (prev: CartLine[]) => CartLine[]) => {
    setLines((prev) => {
      const next = fn(prev)
      try {
        localStorage.setItem(KEY, JSON.stringify(next))
      } catch {
        // The cart still works for this visit.
      }
      return next
    })
  }, [])

  const value = useMemo<Cart>(
    () => ({
      lines,
      count: lines.reduce((n, l) => n + l.qty, 0),
      add: (productId, qty, note = '') =>
        update((prev) => {
          // Same bouquet with the same wishes: just add to the quantity.
          const i = prev.findIndex((l) => l.productId === productId && l.note === note.trim())
          if (i >= 0) return prev.map((l, j) => (j === i ? { ...l, qty: l.qty + qty } : l))
          return [...prev, { productId, qty, note: note.trim() }]
        }),
      setQty: (index, qty) => update((prev) => prev.map((l, i) => (i === index ? { ...l, qty: Math.max(1, Math.min(20, qty)) } : l))),
      setNote: (index, note) => update((prev) => prev.map((l, i) => (i === index ? { ...l, note } : l))),
      remove: (index) => update((prev) => prev.filter((_, i) => i !== index)),
      clear: () => update(() => []),
    }),
    [lines, update],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart(): Cart {
  const cart = useContext(CartContext)
  if (!cart) throw new Error('useCart must be used inside CartProvider')
  return cart
}

const MY_ORDERS_KEY = 'whimsy-bloom:my-orders'

/** Orders placed in this browser, so a guest can see their thank-you page and save the order to a new account. */
export function rememberOrder(orderId: string) {
  try {
    const ids = JSON.parse(localStorage.getItem(MY_ORDERS_KEY) ?? '[]') as string[]
    localStorage.setItem(MY_ORDERS_KEY, JSON.stringify([orderId, ...ids.filter((id) => id !== orderId)].slice(0, 20)))
  } catch {
    // Not fatal.
  }
}

export function placedHere(orderId: string): boolean {
  try {
    return (JSON.parse(localStorage.getItem(MY_ORDERS_KEY) ?? '[]') as string[]).includes(orderId)
  } catch {
    return false
  }
}
