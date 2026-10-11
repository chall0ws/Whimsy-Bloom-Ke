import { isSameDay } from './format'
import { netRevenue } from './orders'
import type { AppState, Customer, Order, OrderStatus, Thread } from './types'

/** Orders with a deposit paid that are still live (not cancelled or refunded) count as sales. */
const SOLD: OrderStatus[] = ['PENDING', 'PROCESSING', 'READY', 'SHIPPED']

export function ordersToday(orders: Order[], now: Date): Order[] {
  return orders.filter((o) => isSameDay(new Date(o.createdAt), now))
}

export function totalRevenue(orders: Order[]): number {
  return orders.reduce((sum, o) => sum + netRevenue(o), 0)
}

export function revenueSince(orders: Order[], since: Date): number {
  return totalRevenue(orders.filter((o) => o.payment.paidAt && new Date(o.payment.paidAt) >= since))
}

export function unreadCount(thread: Thread): number {
  return thread.messages.filter((m) => m.from === 'CUSTOMER' && !m.read).length
}

export function unreadTotals(threads: Thread[]) {
  const counts = threads.map(unreadCount)
  return { messages: counts.reduce((a, b) => a + b, 0), threads: counts.filter((c) => c > 0).length }
}

export function lastMessageAt(thread: Thread): string {
  return thread.messages[thread.messages.length - 1]?.at ?? ''
}

export interface ProductPerformance {
  productId: string
  name: string
  units: number
  revenue: number
}

export function productPerformance(state: AppState, since?: Date): ProductPerformance[] {
  const rows = new Map<string, ProductPerformance>(
    state.products.map((p) => [p.id, { productId: p.id, name: p.name, units: 0, revenue: 0 }]),
  )
  for (const order of state.orders) {
    if (!SOLD.includes(order.status)) continue
    if (since && new Date(order.createdAt) < since) continue
    for (const item of order.items) {
      const row = rows.get(item.productId)
      if (!row) continue
      row.units += item.qty
      row.revenue += item.qty * item.unitPrice
    }
  }
  // Retired bouquets only appear while they still have sales in the period.
  const retired = new Set(state.products.filter((p) => p.hidden).map((p) => p.id))
  return [...rows.values()].filter((r) => r.units > 0 || !retired.has(r.productId)).sort((a, b) => b.units - a.units || b.revenue - a.revenue)
}

export interface WeekBucket {
  weekStart: Date
  value: number
}

/** Monday 00:00 of the week containing `d`. */
export function startOfWeek(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  out.setDate(out.getDate() - ((out.getDay() + 6) % 7))
  return out
}

/** Counts dated things into the last `weeks` calendar weeks, oldest first. */
export function weeklyBuckets(dates: (string | Date)[], now: Date, weeks: number, weight: (i: number) => number = () => 1): WeekBucket[] {
  const thisWeek = startOfWeek(now)
  const buckets: WeekBucket[] = []
  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = new Date(thisWeek)
    weekStart.setDate(thisWeek.getDate() - i * 7)
    buckets.push({ weekStart, value: 0 })
  }
  dates.forEach((d, i) => {
    const week = startOfWeek(new Date(d)).getTime()
    const bucket = buckets.find((b) => b.weekStart.getTime() === week)
    if (bucket) bucket.value += weight(i)
  })
  return buckets
}

export function customerGrowth(customers: Customer[], now: Date, weeks = 12): WeekBucket[] {
  return weeklyBuckets(customers.map((c) => c.createdAt), now, weeks)
}

export interface CustomerStats {
  orders: Order[]
  orderCount: number
  lifetimeSpend: number
  lastOrderAt?: string
  favouriteProductId?: string
}

export function customerStats(state: AppState, customerId: string): CustomerStats {
  const orders = state.orders
    .filter((o) => o.customerId === customerId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const units = new Map<string, number>()
  for (const o of orders) {
    if (!SOLD.includes(o.status)) continue
    for (const item of o.items) units.set(item.productId, (units.get(item.productId) ?? 0) + item.qty)
  }
  const favourite = [...units.entries()].sort((a, b) => b[1] - a[1])[0]
  return {
    orders,
    orderCount: orders.filter((o) => o.status !== 'CANCELLED').length,
    lifetimeSpend: totalRevenue(orders),
    lastOrderAt: orders[0]?.createdAt,
    favouriteProductId: favourite?.[0],
  }
}

export type StockLevel = 'OK' | 'LOW' | 'OUT'

export function stockLevel(onHand: number, reorderLevel: number): StockLevel {
  if (onHand <= 0) return 'OUT'
  if (onHand <= reorderLevel) return 'LOW'
  return 'OK'
}

/** How many more of a product the current stock can make. */
export function buildableUnits(state: AppState, productId: string): number {
  const lines = state.recipes[productId] ?? []
  if (lines.length === 0) return 0
  return Math.max(
    0,
    Math.min(
      ...lines.map((line) => {
        const material = state.materials.find((m) => m.id === line.materialId)
        return material ? Math.floor(material.onHand / line.qty) : 0
      }),
    ),
  )
}
