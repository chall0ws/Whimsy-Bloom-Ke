import { readState } from '../core'
import { liveContext, readJson, route, send } from '../http'

/** POST /api/state { guestTokens } → the shop as this caller may see it. */
export default route(async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Use POST.' })
  const body = await readJson<{ guestTokens?: unknown }>(req)
  const ctx = await liveContext(req, body.guestTokens)
  if ('error' in ctx) return send(res, 503, { ok: false, error: ctx.error })
  send(res, 200, { ok: true, state: await readState(ctx) })
})
