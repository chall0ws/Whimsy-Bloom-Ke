import type { Action } from '../../src/domain/actions'
import { runAction } from '../core'
import { liveContext, readJson, route, send } from '../http'

/** POST /api/action { action, guestTokens } → applies one action with the shop's rules. */
export default route(async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Use POST.' })
  const body = await readJson<{ action?: Action; guestTokens?: unknown }>(req)
  if (!body.action || typeof body.action.type !== 'string') return send(res, 400, { ok: false, error: 'Missing action.' })
  const ctx = await liveContext(req, body.guestTokens)
  if ('error' in ctx) return send(res, 503, { ok: false, error: ctx.error })
  const result = await runAction(ctx, body.action)
  send(res, result.ok ? 200 : result.status, result)
})
