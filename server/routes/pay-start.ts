import { startPayment } from '../core'
import { serverEnv } from '../env'
import { liveContext, paystackFromEnv, readJson, route, send } from '../http'

/** POST /api/pay/start { orderId, guestTokens } → a Paystack access code for the payment window. */
export default route(async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Use POST.' })
  const body = await readJson<{ orderId?: string; callbackUrl?: string; guestTokens?: unknown }>(req)
  const paystack = paystackFromEnv()
  if (!paystack) return send(res, 503, { ok: false, error: 'Payments aren’t switched on yet (missing PAYSTACK_SECRET_KEY).' })
  const ctx = await liveContext(req, body.guestTokens)
  if ('error' in ctx) return send(res, 503, { ok: false, error: ctx.error })
  if (!body.orderId) return send(res, 400, { ok: false, error: 'Missing order.' })
  // Where Paystack's own page sends people back if the payment window can't open.
  const callbackUrl = typeof body.callbackUrl === 'string' && /^https?:\/\//.test(body.callbackUrl) ? body.callbackUrl : undefined
  const result = await startPayment(ctx, paystack, body.orderId, { receiptEmail: serverEnv().receiptEmail, callbackUrl })
  send(res, result.ok ? 200 : result.status, result)
})
