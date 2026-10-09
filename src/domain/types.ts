export type Role = 'SUPER_ADMIN' | 'ADMIN'

/** A team member who signs in to the dashboard with their Google account. */
export interface User {
  id: string
  name: string
  email: string
  role: Role
  title: string
}

/** Where an order came from: live chat, the web order form, the signed-in client portal, or entered by hand. */
export type Channel = 'LIVE_CHAT' | 'WEB_FORM' | 'PORTAL' | 'MANUAL'

/**
 * Order lifecycle:
 *   PENDING_PAYMENT → PENDING → PROCESSING → SHIPPED → (REFUNDED)
 * and CANCELLED from anything before SHIPPED.
 */
export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'PENDING'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'CANCELLED'
  | 'REFUNDED'

/** SHIPPING goes by courier and carries a delivery fee; HAND_DELIVERY costs the customer nothing. */
export type FulfilmentMethod = 'SHIPPING' | 'HAND_DELIVERY'
export type PaymentStatus = 'UNPAID' | 'PAID' | 'REFUNDED'
export type PaymentMethod = 'MPESA' | 'CARD'

export interface Product {
  id: string
  name: string
  price: number
  blurb: string
}

export type MaterialUnit = 'roll' | 'sheet' | 'm' | 'pcs' | 'ml'

export interface Material {
  id: string
  name: string
  unit: MaterialUnit
  onHand: number
  reorderLevel: number
}

export interface RecipeLine {
  materialId: string
  qty: number
}

/** Materials used to make one unit of each product. */
export type Recipes = Record<string, RecipeLine[]>

export interface OrderItem {
  productId: string
  qty: number
  unitPrice: number
}

export interface StatusEvent {
  status: OrderStatus
  at: string
  by: string
  note?: string
}

export interface Fulfilment {
  method: FulfilmentMethod
  address: string
  deliveryFee: number
  courier?: string
  trackingNumber?: string
}

export interface Payment {
  status: PaymentStatus
  method?: PaymentMethod
  reference?: string
  paidAt?: string
  linkSentAt?: string
  refundedAmount?: number
}

export interface Order {
  id: string
  number: string
  customerId: string
  channel: Channel
  threadId?: string
  items: OrderItem[]
  customisation: string
  fulfilment: Fulfilment
  payment: Payment
  status: OrderStatus
  createdAt: string
  shippedAt?: string
  history: StatusEvent[]
  materialsDeducted: boolean
}

export interface Customer {
  id: string
  name: string
  instagram?: string
  phone?: string
  /** Also the Google account they sign in to the client portal with. */
  email?: string
  /** Default delivery address, saved from the client portal. */
  address?: string
  notes: string
  tags: string[]
  createdAt: string
}

export type MessageSender = 'CUSTOMER' | 'SHOP' | 'SYSTEM'

export interface Message {
  id: string
  from: MessageSender
  text: string
  at: string
  /** For customer messages: has the shop read it. */
  read: boolean
  /** User id of the shop member who sent it, for SHOP messages. */
  by?: string
  /** A payment-link message renders as a "Pay with M-Pesa" card in the customer's chat. */
  kind?: 'PAYMENT_LINK'
  orderId?: string
}

/** A live-chat conversation started by a customer from the chat page or the order form. */
export interface Thread {
  id: string
  customerId: string
  startedFrom: 'CHAT_LINK' | 'ORDER_FORM' | 'PORTAL'
  startedAt: string
  messages: Message[]
  /** Last time the customer looked at the conversation; shop messages before this show as "Seen". */
  customerReadAt?: string
}

export type ChatStatus = 'ONLINE' | 'AWAY'

/** One service-fee charge. Written once when an order ships and never removed. */
export interface FeeEntry {
  id: string
  orderId: string
  orderNumber: string
  amount: number
  at: string
}

export interface Payout {
  id: string
  amount: number
  reference: string
  sentAt: string
  sentBy: string
  status: 'SENT' | 'CONFIRMED'
  confirmedAt?: string
  confirmedBy?: string
}

export type MovementReason = 'PURCHASE' | 'ORDER' | 'ORDER_REVERSAL'

export interface MaterialMovement {
  id: string
  materialId: string
  delta: number
  reason: MovementReason
  orderNumber?: string
  note?: string
  at: string
  by: string
}

export interface AuditEvent {
  id: string
  at: string
  by: string
  text: string
}

export interface Settings {
  serviceFee: number
  feeOnHandDelivery: boolean
  defaultShippingFee: number
  payoutSchedule: 'WEEKLY' | 'MONTHLY'
}

export interface AppState {
  version: number
  users: User[]
  currentUserId: string
  products: Product[]
  materials: Material[]
  recipes: Recipes
  customers: Customer[]
  orders: Order[]
  threads: Thread[]
  fees: FeeEntry[]
  payouts: Payout[]
  movements: MaterialMovement[]
  audit: AuditEvent[]
  settings: Settings
  /** Whether she's answering chats right now. Customers see this; when away they get an automatic reply. */
  chatStatus: ChatStatus
  nextOrderNumber: number
  nextId: number
}

/** Actor id used for orders that customers place themselves through the web form. */
export const CUSTOMER_ACTOR = 'customer'
