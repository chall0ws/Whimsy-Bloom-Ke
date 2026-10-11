import type { AppState, Channel, FulfilmentMethod, Order, OrderStatus, PaymentRecord, Settings } from './types'

export const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'Awaiting deposit',
  PENDING: 'Pending',
  PROCESSING: 'Processing',
  READY: 'Ready',
  SHIPPED: 'Shipped',
  CANCELLED: 'Cancelled',
  REFUNDED: 'Refunded',
}

/** The statuses shown as toggle buttons in Order Management. */
export const FLOW_STATUSES = ['PENDING', 'PROCESSING', 'READY', 'SHIPPED'] as const

export const PAYMENT_LABEL: Record<Order['payment']['status'], string> = {
  UNPAID: 'Not paid yet',
  DEPOSIT_PAID: 'Deposit paid',
  PAID: 'Fully paid',
  REFUNDED: 'Refunded',
}

/** The two kinds of delivery the customer picks at checkout. */
export const DELIVERY_LABEL: Record<FulfilmentMethod, string> = {
  HAND_DELIVERY: 'Within Nairobi',
  SHIPPING: 'Outside Nairobi',
}

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  // Leaving PENDING_PAYMENT for PENDING only happens when the deposit is paid.
  PENDING_PAYMENT: ['CANCELLED'],
  // Moving to READY goes through "Order ready", which sets the delivery fee.
  PENDING: ['PROCESSING', 'READY', 'CANCELLED'],
  PROCESSING: ['PENDING', 'READY', 'CANCELLED'],
  // Shipping needs the balance paid; back to Processing undoes a mistaken "ready".
  READY: ['PROCESSING', 'SHIPPED', 'CANCELLED'],
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

/** The 50% deposit paid when ordering, rounded up to a whole shilling. */
export function depositFor(order: Pick<Order, 'items'>): number {
  return Math.ceil(itemsSubtotal(order as Order) / 2)
}

/** Payments received. Orders paid in full before deposits existed count as one FULL payment. */
export function paymentRecords(order: Order): PaymentRecord[] {
  if (order.payment.records) return order.payment.records
  if (order.payment.status === 'UNPAID' || !order.payment.reference) return []
  return [{ kind: 'FULL', amount: orderTotal(order), method: order.payment.method ?? 'MPESA', reference: order.payment.reference, at: order.payment.paidAt ?? order.createdAt }]
}

export function amountPaid(order: Order): number {
  return paymentRecords(order).reduce((sum, p) => sum + p.amount, 0)
}

/** What the customer owes right now: the deposit while it's awaited, the balance once the order is ready. */
export function amountDue(order: Order): number {
  if (order.status === 'PENDING_PAYMENT') return Math.max(0, depositFor(order) - amountPaid(order))
  if (order.status === 'READY') return Math.max(0, orderTotal(order) - amountPaid(order))
  return 0
}

/** Which payment the customer is being asked for now, if any. */
export function paymentStage(order: Order): 'DEPOSIT' | 'BALANCE' | null {
  if (amountDue(order) === 0) return null
  return order.status === 'PENDING_PAYMENT' ? 'DEPOSIT' : 'BALANCE'
}

/** What the business actually keeps from an order: everything paid minus any refund. */
export function netRevenue(order: Order): number {
  return amountPaid(order) - (order.payment.refundedAmount ?? 0)
}

/**
 * Amount returned to the customer.
 * Cancelled before shipping: everything paid except the deposit, which is never refundable.
 * Refunded after shipping: the bouquets; the delivery fee is kept.
 */
export function refundAmountFor(order: Order): number {
  const paid = amountPaid(order)
  if (order.status === 'SHIPPED') return Math.min(paid, itemsSubtotal(order))
  const deposits = paymentRecords(order)
    .filter((p) => p.kind === 'DEPOSIT')
    .reduce((sum, p) => sum + p.amount, 0)
  return Math.max(0, paid - deposits)
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

export const CHANNEL_LABEL: Record<Channel, string> = {
  LIVE_CHAT: 'Live chat',
  WEB_FORM: 'Website (guest)',
  PORTAL: 'Website (account)',
  MANUAL: 'Phone / in person',
}

export function customerName(state: AppState, customerId: string): string {
  return state.customers.find((c) => c.id === customerId)?.name ?? 'Customer'
}

/** "Live chat: Wanjiru Kamau", "Web Form: Brian Mwangi". */
export function sourceLabel(state: AppState, order: Order): string {
  return `${CHANNEL_LABEL[order.channel]}: ${customerName(state, order.customerId)}`
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
