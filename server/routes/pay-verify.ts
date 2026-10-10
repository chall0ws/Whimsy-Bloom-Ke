import { confirmPaystack } from '../core'
import { liveContext, paystackFromEnv, readJson, route, send } from '../http'

/** POST /api/pay/verify { reference } → checks with Paystack and marks the order paid. */
export default route(async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Use POST.' })
  const body = await readJson<{ reference?: string }>(req)
  const paystack = paystackFromEnv()
  if (!paystack) return send(res, 503, { ok: false, error: 'Payments aren’t switched on yet (missing PAYSTACK_SECRET_KEY).' })
  const ctx = await liveContext(req, [])
  if ('error' in ctx) return send(res, 503, { ok: false, error: ctx.error })
  if (!body.reference) return send(res, 400, { ok: false, error: 'Missing payment reference.' })
  const result = await confirmPaystack(ctx.repo, paystack, body.reference)
  send(res, result.ok ? 200 : result.status, result)
})
