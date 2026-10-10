import { handleWebhook } from '../core'
import { serverEnv } from '../env'
import { liveContext, paystackFromEnv, readBody, route } from '../http'

/** POST /api/pay/webhook: Paystack calls this when a payment succeeds. Set it in Paystack → Settings → API Keys & Webhooks. */
export default route(async (req, res) => {
  const raw = await readBody(req)
  const { paystackSecret } = serverEnv()
  const paystack = paystackFromEnv()
  const ctx = await liveContext(req, [])
  if (!paystackSecret || !paystack || 'error' in ctx) {
    res.statusCode = 503
    return void res.end('Not configured')
  }
  const signature = req.headers['x-paystack-signature']
  const result = await handleWebhook(ctx.repo, paystack, raw, typeof signature === 'string' ? signature : undefined, paystackSecret)
  res.statusCode = result.status
  res.end(result.body)
})
