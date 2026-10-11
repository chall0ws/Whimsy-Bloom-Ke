import type { IncomingMessage, ServerResponse } from 'node:http'
import { parseStaffList } from '../src/domain/auth'
import type { Ctx } from './core'
import { serverEnv } from './env'
import { paystackClient } from './paystack'
import { adminClient, callerFromToken, SupabaseRepo } from './supabaseRepo'

export function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.setEncoding('utf8')
    req.on('data', (chunk) => {
      body += chunk
      if (body.length > 1_000_000) reject(new Error('Too large'))
    })
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })
}

export function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

export async function readJson<T>(req: IncomingMessage): Promise<T> {
  const raw = await readBody(req)
  return (raw ? JSON.parse(raw) : {}) as T
}

function bearer(req: IncomingMessage): string | null {
  const header = req.headers.authorization
  return header?.startsWith('Bearer ') ? header.slice(7) : null
}

/** Everything a request needs: the database, who is calling, and their guest tokens. */
export async function liveContext(req: IncomingMessage, guestTokens: unknown): Promise<Ctx | { error: string }> {
  const env = serverEnv()
  if (!env.supabaseUrl || !env.serviceKey) return { error: 'The server isn’t connected to Supabase yet (missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY).' }
  const db = adminClient(env.supabaseUrl, env.serviceKey)
  return {
    repo: new SupabaseRepo(db, env.supabaseUrl, env.serviceKey),
    caller: await callerFromToken(db, bearer(req)),
    guestTokens: Array.isArray(guestTokens) ? guestTokens.filter((t): t is string => typeof t === 'string').slice(0, 50) : [],
    staff: parseStaffList(env.staffEmails),
  }
}

export function paystackFromEnv() {
  const { paystackSecret } = serverEnv()
  return paystackSecret ? paystackClient(paystackSecret) : null
}

/** Wraps a handler so unexpected errors become a clean 500 instead of a crash. */
export function route(handler: (req: IncomingMessage, res: ServerResponse) => Promise<void>) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    try {
      await handler(req, res)
    } catch (error) {
      console.error(error)
      if (res.headersSent) return
      // Paystack refused (wrong key, currency or channel not enabled…): say what Paystack said.
      const paystack = /^Paystack: (.*)/.exec(error instanceof Error ? error.message : '')
      if (paystack) return send(res, 502, { ok: false, error: `Paystack couldn’t start the payment: ${paystack[1]}` })
      // The usual first-time problem: the SQL in supabase/migrations hasn't been run yet.
      const missingTables = /app_meta|records|apply_changes/.test(String(error)) && /does not exist|schema cache|not find/i.test(String(error))
      send(res, missingTables ? 503 : 500, {
        ok: false,
        error: missingTables ? 'The database tables aren’t set up yet. Run the SQL in supabase/migrations (see docs/go-live.md).' : 'Something went wrong on our side. Please try again.',
      })
    }
  }
}
