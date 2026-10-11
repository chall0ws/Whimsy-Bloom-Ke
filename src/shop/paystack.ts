import { api } from '../state/api'

/**
 * Paying with Paystack (M-Pesa or card). The server starts the payment with the order's real
 * total; the shopper pays on Paystack's own secure page, which sends them back to their
 * thank-you page; the server then checks with Paystack. The browser never decides it's paid.
 *
 * We use Paystack's full page rather than its pop-up window: the pop-up runs inside this page,
 * where ad blockers and slow networks can stop it ("We could not start this transaction").
 */
export type PayOutcome = { status: 'paid' | 'cancelled' | 'pending' | 'redirecting' } | { status: 'error'; error: string }

/** Query parameter Paystack's page sends people back with. */
export const RETURN_PARAM = 'paid_order'

export async function payOrder(orderId: string): Promise<PayOutcome> {
  const backTo = `${window.location.origin}${window.location.pathname}?${RETURN_PARAM}=${encodeURIComponent(orderId)}`
  const start = await api<{ ok: true; authorizationUrl: string } | { ok: false; error: string }>('pay/start', { orderId, callbackUrl: backTo }).catch(
    () => ({ ok: false, error: 'We couldn’t reach the shop to start the payment. Check your connection and try again.' }) as const,
  )
  if (!start.ok) {
    console.error('Paystack start failed:', start.error)
    return { status: 'error', error: start.error }
  }
  window.location.assign(start.authorizationUrl)
  return { status: 'redirecting' }
}

/** Asks the server to check a payment with Paystack. */
export async function confirm(reference: string): Promise<PayOutcome> {
  const res = await api<{ ok: true; paid: boolean } | { ok: false; error: string }>('pay/verify', { reference }).catch(
    () => ({ ok: false, error: 'We couldn’t check the payment just now. This page will update once Paystack confirms it.' }) as const,
  )
  if (!res.ok) return { status: 'error', error: res.error }
  return { status: res.paid ? 'paid' : 'pending' }
}

/**
 * Someone coming back from Paystack's own payment page ("?paid_order=…&reference=…"):
 * tidies the address to their thank-you page. Call it before the app first renders.
 */
export function takeReturnFromPaystack(): { orderId: string; reference: string } | null {
  // Paid: "?paid_order=…&trxref=…&reference=…". Cancelled on Paystack's page: just "?paid_order=…".
  const params = new URLSearchParams(window.location.search)
  const orderId = params.get(RETURN_PARAM)
  const reference = params.get('reference') ?? params.get('trxref')
  if (!orderId) return null
  window.history.replaceState(null, '', `${window.location.pathname}#/thanks/${encodeURIComponent(orderId)}`)
  return reference ? { orderId, reference } : null
}

export function outcomeMessage(outcome: PayOutcome): { text: string; tone: 'info' | 'error' } | null {
  switch (outcome.status) {
    case 'paid':
      return { text: 'Payment received. Thank you! 🌸', tone: 'info' }
    case 'pending':
      return { text: 'We’re waiting for Paystack to confirm your payment. This page updates by itself.', tone: 'info' }
    case 'cancelled':
    case 'redirecting':
      return null
    case 'error':
      return { text: outcome.error, tone: 'error' }
  }
}
