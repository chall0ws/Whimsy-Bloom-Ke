import { api } from '../state/api'

/**
 * Paystack's payment window (M-Pesa or card). The server starts the payment with the order's
 * real total and confirms it with Paystack afterwards; the browser never decides it's paid.
 */
interface PaystackTx {
  reference?: string
}
interface PaystackPopup {
  resumeTransaction(accessCode: string, callbacks?: { onSuccess?: (tx: PaystackTx) => void; onCancel?: () => void; onError?: (e: { message?: string }) => void }): void
}
declare global {
  interface Window {
    PaystackPop?: new () => PaystackPopup
  }
}

let script: Promise<void> | null = null
function loadPaystack(): Promise<void> {
  script ??= new Promise<void>((resolve, reject) => {
    const tag = document.createElement('script')
    tag.src = 'https://js.paystack.co/v2/inline.js'
    const fail = () => {
      script = null
      reject(new Error('Paystack didn’t load'))
    }
    // A blocked or very slow script would otherwise leave the shopper waiting forever.
    const timer = setTimeout(fail, 10_000)
    tag.onload = () => {
      clearTimeout(timer)
      resolve()
    }
    tag.onerror = () => {
      clearTimeout(timer)
      fail()
    }
    document.head.appendChild(tag)
  })
  return script
}

export type PayOutcome = { status: 'paid' | 'cancelled' | 'pending' } | { status: 'error'; error: string }

/** Query parameter Paystack's hosted page sends people back with (used if the window can't open). */
export const RETURN_PARAM = 'paid_order'

export async function payOrder(orderId: string): Promise<PayOutcome> {
  const callbackUrl = `${window.location.origin}${window.location.pathname}?${RETURN_PARAM}=${encodeURIComponent(orderId)}`
  let start: { ok: true; accessCode: string; reference: string; authorizationUrl: string } | { ok: false; error: string }
  try {
    start = await api('pay/start', { orderId, callbackUrl })
  } catch {
    return { status: 'error', error: 'We couldn’t reach the shop to start the payment. Check your connection and try again.' }
  }
  if (!start.ok) {
    console.error('Paystack start failed:', start.error)
    return { status: 'error', error: start.error }
  }
  const { accessCode, reference, authorizationUrl } = start
  // Couldn't open the window here (blocked script, ad blocker…): go to Paystack's own page, which brings them back after.
  const goToPaystack = (): PayOutcome => {
    window.location.href = authorizationUrl
    return { status: 'pending' }
  }
  try {
    await loadPaystack()
    if (!window.PaystackPop) return goToPaystack()
    return await new Promise<PayOutcome>((resolve) => {
      new window.PaystackPop!().resumeTransaction(accessCode, {
        onSuccess: async (tx) => resolve(await confirm(tx.reference ?? reference)),
        onCancel: () => resolve({ status: 'cancelled' }),
        onError: (e) => resolve({ status: 'error', error: e?.message ?? 'The payment couldn’t start. Please try again.' }),
      })
    })
  } catch (error) {
    console.error('Paystack window failed, using Paystack’s page instead:', error)
    return goToPaystack()
  }
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
      return null
    case 'error':
      return { text: outcome.error, tone: 'error' }
  }
}
