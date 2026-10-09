import type { AppState, Order, OrderStatus, Settings } from './types'

export const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'Awaiting payment',
  PENDING: 'Pending',
  PROCESSING: 'Processing',
  SHIPPED: 'Shipped',
  CANCELLED: 'Cancelled',
  REFUNDED: 'Refunded',
}

/** The three statuses shown as toggle buttons in Order Management. */
export const FLOW_STATUSES = ['PENDING', 'PROCESSING', 'SHIPPED'] as const

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  // Leaving PENDING_PAYMENT for PENDING only happens by confirming a payment.
  PENDING_PAYMENT: ['CANCELLED'],
  PENDING: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['PENDING', 'SHIPPED', 'CANCELLED'],
  // Shipping is final: the service and delivery fees are non-refundable.
  SHIPPED: ['REFUNDED'],
  CANCELLED: [],
  REFUNDED: [],
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to)
}

export function itemsSubtotal(order: Order): number {
  return order.items.reduce((sum, item) => sum + item.qty * item.unitPrice, 0)
}

export function orderTotal(order: Order): number {
  return itemsSubtotal(order) + order.fulfilment.deliveryFee
}

/** What the business actually keeps from an order: paid total minus any refund. */
export function netRevenue(order: Order): number {
  if (order.payment.status === 'UNPAID') return 0
  return orderTotal(order) - (order.payment.refundedAmount ?? 0)
}

/** Amount returned to the customer. Before shipping everything is refunded; after shipping the delivery fee is kept. */
export function refundAmountFor(order: Order): number {
  if (order.payment.status !== 'PAID') return 0
  return order.status === 'SHIPPED' ? itemsSubtotal(order) : orderTotal(order)
}

export function earnsServiceFee(order: Order, settings: Settings): boolean {
  return order.fulfilment.method === 'SHIPPING' || settings.feeOnHandDelivery
}

export function productName(state: AppState, productId: string): string {
  return state.products.find((p) => p.id === productId)?.name ?? 'Unknown product'
}

export function orderSummary(state: AppState, order: Order): string {
  return order.items
    .map((item) => `${productName(state, item.productId)}${item.qty > 1 ? ` ×${item.qty}` : ''}`)
    .join(', ')
}

export function sourceLabel(order: Order): string {
  if (order.channel === 'WEB_FORM') return 'Web Form'
  const prefix = order.channel === 'INSTAGRAM' ? 'IG DM' : 'FB DM'
  return order.sourceHandle ? `${prefix}: ${order.sourceHandle}` : prefix
}

/** The order she should work on next: the oldest paid order still waiting to be started. */
export function nextUpOrder(orders: Order[]): Order | undefined {
  return orders
    .filter((o) => o.status === 'PENDING')
    .reduce<Order | undefined>((oldest, o) => (!oldest || o.createdAt < oldest.createdAt ? o : oldest), undefined)
}

export function sortNewestFirst(orders: Order[]): Order[] {
  return [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}
