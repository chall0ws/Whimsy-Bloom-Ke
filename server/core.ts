import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { applyAction, type Action, type ActionResult } from '../src/domain/actions'
import { staffRoleFor } from '../src/domain/auth'
import { productPerformance } from '../src/domain/metrics'
import { orderTotal } from '../src/domain/orders'
import { createEmptyState, STATE_VERSION } from '../src/domain/seed'
import type { AppState, Customer, Role } from '../src/domain/types'
import type { Repo } from './repo'

/**
 * The server's rules. Browsers send actions; this decides who may do what, applies the
 * same domain rules the demo uses, saves, and returns only what that person may see.
 */

/** Who is calling, from their Supabase sign-in. Null for a guest. */
export interface Caller {
  email: string
  name: string
  /** Google, or an email address that has been confirmed. */
  verified: boolean
}

export interface Ctx {
  repo: Repo
  caller: Caller | null
  /** Secrets for guest orders and chats placed from this browser. */
  guestTokens: string[]
  /** Team list from configuration (VITE_STAFF_EMAILS). */
  staff: Map<string, Role>
  now?: () => Date
}

export type ActionResponse =
  | { ok: true; notices: string[]; createdOrderId?: string; threadId?: string; customerId?: string; guestToken?: string; state: AppState }
  | { ok: false; error: string; status: number }

const newToken = () => randomBytes(24).toString('base64url')

function roleOf(ctx: Ctx, state: AppState): Role | null {
  return ctx.caller?.verified ? staffRoleFor(ctx.caller.email, ctx.staff, state.users) : null
}

function customerOf(ctx: Ctx, state: AppState): Customer | undefined {
  const email = ctx.caller?.email.toLowerCase()
  return email ? state.customers.find((c) => c.email?.toLowerCase() === email) : undefined
}

/** Loads the shop, creating the starting catalogue the very first time. */
async function loadOrCreate(repo: Repo): Promise<{ state: AppState; version: number }> {
  const loaded = await repo.load()
  if (loaded.version > 0 || loaded.state.products.length > 0) return loaded
  const version = await repo.save(loaded.state, createEmptyState(), loaded.version)
  if (version === null) return repo.load()
  return { state: createEmptyState(), version }
}

/** What this caller may see. Team: everything. Customers and guests: their own orders and chats only. */
export function viewFor(state: AppState, ctx: Ctx, extraTokens: string[] = []): AppState {
  const role = roleOf(ctx, state)
  if (role) {
    const me = state.users.find((u) => u.email.toLowerCase() === ctx.caller!.email.toLowerCase())
    return { ...state, currentUserId: me?.id ?? '' }
  }
  const me = customerOf(ctx, state)
  const tokens = new Set([...ctx.guestTokens, ...extraTokens])
  const threads = state.threads.filter((t) => (me && t.customerId === me.id) || (t.accessToken && tokens.has(t.accessToken)))
  const threadIds = new Set(threads.map((t) => t.id))
  const orders = state.orders.filter(
    (o) => (me && o.customerId === me.id) || (o.accessToken && tokens.has(o.accessToken)) || (o.threadId && threadIds.has(o.threadId)),
  )
  const customerIds = new Set([me?.id, ...orders.map((o) => o.customerId), ...threads.map((t) => t.customerId)])
  return {
    version: STATE_VERSION,
    users: [],
    currentUserId: '',
    products: state.products,
    materials: [],
    recipes: {},
    // The team's private notes and tags stay private.
    customers: state.customers.filter((c) => customerIds.has(c.id)).map((c) => ({ ...c, notes: '', tags: [] })),
    orders,
    threads,
    fees: [],
    payouts: [],
    movements: [],
    audit: [],
    settings: { ...state.settings, serviceFee: 0 },
    chatStatus: state.chatStatus,
    nextOrderNumber: 0,
    nextId: 0,
    popularProductIds: productPerformance(state).map((p) => p.productId),
  }
}

type Authorized = { action: Action } | { error: string; status: number }

/** Checks an action from a browser and fills in identity from the sign-in, never from the browser. */
function authorize(action: Action, ctx: Ctx, state: AppState): Authorized {
  const role = roleOf(ctx, state)
  const me = customerOf(ctx, state)
  const tokens = new Set(ctx.guestTokens)
  const canSeeThread = (threadId: string) => {
    const t = state.threads.find((x) => x.id === threadId)
    return Boolean(t && (role || (me && t.customerId === me.id) || (t.accessToken && tokens.has(t.accessToken))))
  }

  switch (action.type) {
    case 'PAYMENT_RECEIVED':
    case 'CUSTOMER_PAY':
      // Payments are only ever confirmed by Paystack, through the server.
      return { error: 'Payments are confirmed by Paystack.', status: 403 }
    case 'SIGN_OUT':
      return { action }
    case 'SIGN_IN_STAFF':
      if (!role) return { error: 'This account isn’t on the team.', status: 403 }
      return { action: { type: 'SIGN_IN_STAFF', email: ctx.caller!.email, name: ctx.caller!.name, role } }
    case 'CUSTOMER_START_CHAT': {
      if (me) return { action: { ...action, customerId: me.id, name: me.name, phone: me.phone ?? action.phone, newThread: false } }
      // A guest giving a phone number that already has a chat gets a fresh one, not the old history.
      const digits = action.phone.replace(/\D/g, '').slice(-9)
      const existing = state.customers.find((c) => c.phone && c.phone.replace(/\D/g, '').slice(-9) === digits)
      const thread = existing && state.threads.find((t) => t.customerId === existing.id)
      const holdsToken = Boolean(thread?.accessToken && tokens.has(thread.accessToken))
      return { action: { ...action, customerId: undefined, newThread: Boolean(thread && !holdsToken) } }
    }
    case 'CUSTOMER_SEND_MESSAGE':
    case 'CUSTOMER_READ':
      return canSeeThread(action.threadId) ? { action } : { error: 'Chat not found.', status: 404 }
    case 'CUSTOMER_PLACE_ORDER': {
      const draft = { ...action.draft }
      if (draft.payment.kind !== 'UNPAID') return { error: 'Orders are paid through Paystack after they’re placed.', status: 400 }
      if (ctx.caller) {
        if (!me) return { error: 'Finish setting up your account first.', status: 400 }
        return { action: { type: 'CUSTOMER_PLACE_ORDER', draft: { ...draft, customerId: me.id, channel: 'PORTAL', threadId: undefined } } }
      }
      return { action: { type: 'CUSTOMER_PLACE_ORDER', draft: { ...draft, customerId: undefined, channel: 'WEB_FORM', threadId: undefined } } }
    }
    case 'CUSTOMER_LINK_ACCOUNT': {
      if (!ctx.caller) return { error: 'Please sign in first.', status: 401 }
      if (action.claimOrderId) {
        const order = state.orders.find((o) => o.id === action.claimOrderId)
        if (!order?.accessToken || !tokens.has(order.accessToken)) return { error: 'Order not found.', status: 404 }
      }
      // Phone numbers aren't verified yet, so they can't unlock someone else's history.
      return { action: { ...action, email: ctx.caller.email, allowPhoneMatch: false } }
    }
    case 'CUSTOMER_UPDATE_PROFILE':
      if (!ctx.caller || !me) return { error: 'Please sign in first.', status: 401 }
      return { action: { ...action, customerId: me.id, email: ctx.caller.email } }
    default:
      // Everything else is dashboard work.
      if (!role) return { error: 'Please sign in with a team account.', status: 403 }
      return { action }
  }
}

/** Gives new guest orders and chats a secret so only that browser can see them. */
function issueGuestToken(action: Action, result: Extract<ActionResult, { ok: true }>, ctx: Ctx): { state: AppState; token?: string } {
  // Signed-in customers see their things through their account; everyone else needs a token.
  if (customerOf(ctx, result.state)) return { state: result.state }
  if (action.type === 'CUSTOMER_PLACE_ORDER' && result.createdOrderId) {
    const token = newToken()
    return { state: { ...result.state, orders: result.state.orders.map((o) => (o.id === result.createdOrderId ? { ...o, accessToken: token } : o)) }, token }
  }
  if (action.type === 'CUSTOMER_START_CHAT' && result.threadId) {
    const thread = result.state.threads.find((t) => t.id === result.threadId)
    if (thread && !thread.accessToken) {
      const token = newToken()
      return { state: { ...result.state, threads: result.state.threads.map((t) => (t.id === thread.id ? { ...t, accessToken: token } : t)) }, token }
    }
  }
  return { state: result.state }
}

/** Applies one action with the domain rules and saves it, retrying if someone else saved first. */
export async function runAction(ctx: Ctx, action: Action): Promise<ActionResponse> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const { state, version } = await loadOrCreate(ctx.repo)
    const auth = authorize(action, ctx, state)
    if ('error' in auth) return { ok: false, error: auth.error, status: auth.status }
    const now = ctx.now?.() ?? new Date()

    let base = state
    const role = roleOf(ctx, state)
    if (role && ctx.caller) {
      // Act as the signed-in team member (adding them to the team list on first sign-in).
      const signedIn = applyAction(state, { type: 'SIGN_IN_STAFF', email: ctx.caller.email, name: ctx.caller.name, role }, now)
      if (signedIn.ok) base = signedIn.state
    }
    const signInOnly = auth.action.type === 'SIGN_IN_STAFF' || auth.action.type === 'SIGN_OUT'
    const result: ActionResult = signInOnly ? { ok: true, state: base, notices: [] } : applyAction(base, auth.action, now)
    if (!result.ok) return { ok: false, error: result.error, status: 400 }

    const { state: next, token } = issueGuestToken(auth.action, result, ctx)
    const saved = await ctx.repo.save(state, { ...next, currentUserId: '' }, version)
    if (saved === null) continue
    if (saved !== version) await ctx.repo.notify(saved)
    return {
      ok: true,
      notices: result.notices,
      createdOrderId: result.createdOrderId,
      threadId: result.threadId,
      customerId: result.customerId,
      guestToken: token,
      state: viewFor(next, ctx, token ? [token] : []),
    }
  }
  return { ok: false, error: 'The shop is busy. Please try again.', status: 409 }
}

export async function readState(ctx: Ctx): Promise<AppState> {
  const { state } = await loadOrCreate(ctx.repo)
  return viewFor(state, ctx)
}

// ---------------------------------------------------------------- Paystack

export interface PaystackTransaction {
  status: string
  reference: string
  /** In the smallest unit: cents for KES. */
  amount: number
  currency: string
  channel: string
  metadata?: { orderId?: string } | null
}

export interface PaystackApi {
  initialize(input: {
    email: string
    amount: number
    currency: 'KES'
    reference: string
    channels: string[]
    metadata: Record<string, string>
    callback_url?: string
  }): Promise<{ authorization_url: string; access_code: string; reference: string }>
  verify(reference: string): Promise<PaystackTransaction>
}

export type StartPaymentResponse =
  | { ok: true; accessCode: string; reference: string; authorizationUrl: string }
  | { ok: false; error: string; status: number }

/** Starts a Paystack payment for an order, using the total from the database, never from the browser. */
export async function startPayment(
  ctx: Ctx,
  paystack: PaystackApi,
  orderId: string,
  options: { receiptEmail: string; callbackUrl?: string },
): Promise<StartPaymentResponse> {
  const { state } = await loadOrCreate(ctx.repo)
  const order = state.orders.find((o) => o.id === orderId)
  const visible = order && viewFor(state, ctx).orders.some((o) => o.id === order.id)
  if (!order || !visible) return { ok: false, error: 'Order not found.', status: 404 }
  if (order.status !== 'PENDING_PAYMENT') return { ok: false, error: 'This order doesn’t need paying.', status: 400 }
  const customer = state.customers.find((c) => c.id === order.customerId)
  const tx = await paystack.initialize({
    email: customer?.email || options.receiptEmail,
    amount: orderTotal(order) * 100,
    currency: 'KES',
    reference: `${order.number}-${randomBytes(4).toString('hex')}`,
    channels: ['mobile_money', 'card'],
    // cancel_action: where Paystack's page sends someone who cancels (back to their order, unpaid).
    metadata: { orderId: order.id, orderNumber: order.number, ...(options.callbackUrl ? { cancel_action: options.callbackUrl } : {}) },
    callback_url: options.callbackUrl,
  })
  return { ok: true, accessCode: tx.access_code, reference: tx.reference, authorizationUrl: tx.authorization_url }
}

export type ConfirmResponse = { ok: true; orderId: string; paid: boolean; status: string } | { ok: false; error: string; status: number }

/** Asks Paystack whether a payment went through, and marks the order paid if so. Safe to call twice. */
export async function confirmPaystack(repo: Repo, paystack: PaystackApi, reference: string, now: () => Date = () => new Date()): Promise<ConfirmResponse> {
  const tx = await paystack.verify(reference)
  const orderId = tx.metadata?.orderId
  if (!orderId) return { ok: false, error: 'Unknown payment.', status: 404 }
  if (tx.status !== 'success') return { ok: true, orderId, paid: false, status: tx.status }
  if (tx.currency !== 'KES') return { ok: false, error: 'Unexpected currency.', status: 400 }
  const action: Action = {
    type: 'PAYMENT_RECEIVED',
    orderId,
    method: tx.channel === 'card' ? 'CARD' : 'MPESA',
    reference: tx.reference,
    amount: tx.amount / 100,
  }
  for (let attempt = 0; attempt < 4; attempt++) {
    const { state, version } = await loadOrCreate(repo)
    const result = applyAction(state, action, now())
    if (!result.ok) return { ok: false, error: result.error, status: 409 }
    const saved = await repo.save(state, result.state, version)
    if (saved === null) continue
    if (saved !== version) await repo.notify(saved)
    return { ok: true, orderId, paid: true, status: tx.status }
  }
  return { ok: false, error: 'The shop is busy. Please try again.', status: 409 }
}

/** Paystack signs each webhook with your secret key; anything else is ignored. */
export function verifyPaystackSignature(rawBody: string, signature: string | undefined, secret: string): boolean {
  if (!signature) return false
  const expected = createHmac('sha512', secret).update(rawBody).digest('hex')
  const a = Buffer.from(expected)
  const b = Buffer.from(signature)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function handleWebhook(repo: Repo, paystack: PaystackApi, rawBody: string, signature: string | undefined, secret: string): Promise<{ status: number; body: string }> {
  if (!verifyPaystackSignature(rawBody, signature, secret)) return { status: 401, body: 'Bad signature' }
  let event: { event?: string; data?: { reference?: string } }
  try {
    event = JSON.parse(rawBody)
  } catch {
    return { status: 400, body: 'Bad JSON' }
  }
  if (event.event === 'charge.success' && event.data?.reference) {
    // Ask Paystack directly rather than trusting the webhook body.
    await confirmPaystack(repo, paystack, event.data.reference)
  }
  // Always 200 for genuine webhooks so Paystack doesn't keep retrying ones we've handled or don't need.
  return { status: 200, body: 'OK' }
}
