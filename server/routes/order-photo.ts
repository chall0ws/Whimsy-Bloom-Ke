import { saveOrderPhoto } from '../core'
import { serverEnv } from '../env'
import { liveContext, readJson, route, send } from '../http'
import { adminClient, photoStore } from '../supabaseRepo'

/** POST /api/order-photo { orderId, image: "data:image/jpeg;base64,…" } → { url }. Team only. */
export default route(async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Use POST.' })
  // Photos are resized in the browser first; this leaves room for a large one.
  const body = await readJson<{ orderId?: string; image?: string }>(req, 4_200_000)
  const ctx = await liveContext(req, [])
  if ('error' in ctx) return send(res, 503, { ok: false, error: ctx.error })
  if (!body.orderId || !body.image) return send(res, 400, { ok: false, error: 'Missing photo.' })
  const env = serverEnv()
  try {
    const result = await saveOrderPhoto(ctx, photoStore(adminClient(env.supabaseUrl!, env.serviceKey!)), body.orderId, body.image)
    send(res, result.ok ? 200 : result.status, result)
  } catch (error) {
    // Usually the storage bucket hasn't been created yet.
    console.error(error)
    const missing = /bucket not found|not found/i.test(String(error))
    send(res, missing ? 503 : 500, {
      ok: false,
      error: missing ? 'Photo storage isn’t set up yet. Run the newest SQL in supabase/migrations (see docs/go-live.md).' : 'The photo couldn’t be saved. Please try again.',
    })
  }
})
