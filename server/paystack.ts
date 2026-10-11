import type { PaystackApi, PaystackTransaction } from './core'

/** Paystack's REST API with your secret key. Test keys (sk_test_…) never move real money. */
export function paystackClient(secret: string): PaystackApi {
  const call = async <T>(path: string, init?: RequestInit): Promise<T> => {
    const res = await fetch(`https://api.paystack.co${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json', ...init?.headers },
    })
    const body = (await res.json().catch(() => ({}))) as { status?: boolean; message?: string; data?: T }
    if (!res.ok || !body.status || !body.data) throw new Error(`Paystack: ${body.message ?? res.statusText}`)
    return body.data
  }
  return {
    initialize: (input) => call('/transaction/initialize', { method: 'POST', body: JSON.stringify(input) }),
    verify: (reference) => call<PaystackTransaction>(`/transaction/verify/${encodeURIComponent(reference)}`),
  }
}
