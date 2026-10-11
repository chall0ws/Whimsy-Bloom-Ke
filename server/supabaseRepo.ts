import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { DEFAULT_SETTINGS } from '../src/domain/catalog'
import type { AppState } from '../src/domain/types'
import type { Caller } from './core'
import { diff, fromRecords, type Meta, type RecordRow } from './records'
import { hasChanges, type Repo } from './repo'

/** The channel open dashboards and shops listen on to know when to refresh. */
export const CHANGES_TOPIC = 'whimsy-changes'

const DEFAULT_META: Meta = { settings: DEFAULT_SETTINGS, chatStatus: 'ONLINE', nextOrderNumber: 1001, nextId: 1000 }

export function adminClient(url: string, serviceKey: string): SupabaseClient {
  return createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
}

/** Stores the shop in the `records` and `app_meta` tables (see supabase/migrations). */
export class SupabaseRepo implements Repo {
  constructor(
    private db: SupabaseClient,
    private url: string,
    private serviceKey: string,
  ) {}

  async load(): Promise<{ state: AppState; version: number }> {
    const { data: metaRow, error: metaError } = await this.db.from('app_meta').select('version, data').eq('id', 1).maybeSingle()
    if (metaError) throw new Error(`Couldn’t read app_meta: ${metaError.message}`)
    const rows: RecordRow[] = []
    // PostgREST returns at most 1,000 rows at a time.
    for (let from = 0; ; from += 1000) {
      const { data, error } = await this.db.from('records').select('kind, id, data').order('kind').order('id').range(from, from + 999)
      if (error) throw new Error(`Couldn’t read records: ${error.message}`)
      rows.push(...(data as RecordRow[]))
      if (data.length < 1000) break
    }
    const stored = (metaRow?.data ?? {}) as Partial<Meta>
    const meta: Meta = { ...DEFAULT_META, ...stored, settings: { ...DEFAULT_SETTINGS, ...stored.settings } }
    return { state: fromRecords(rows, meta), version: Number(metaRow?.version ?? 0) }
  }

  async save(prev: AppState, next: AppState, version: number): Promise<number | null> {
    const changes = diff(prev, next)
    if (!hasChanges(changes, prev)) return version
    const { data, error } = await this.db.rpc('apply_changes', {
      expected_version: version,
      upserts: changes.upserts,
      deletes: changes.deletes,
      meta: changes.meta,
    })
    if (error) throw new Error(`Couldn’t save: ${error.message}`)
    const saved = Number(data)
    return saved < 0 ? null : saved
  }

  async notify(version: number): Promise<void> {
    // Realtime broadcast over REST; the message only says "something changed", no data.
    await fetch(`${this.url}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: { apikey: this.serviceKey, Authorization: `Bearer ${this.serviceKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ topic: CHANGES_TOPIC, event: 'changed', payload: { version } }] }),
    }).catch(() => undefined)
  }
}

/** Works out who is calling from the Supabase sign-in token they send. */
export async function callerFromToken(db: SupabaseClient, token: string | null): Promise<Caller | null> {
  if (!token) return null
  const { data, error } = await db.auth.getUser(token)
  const user = data?.user
  if (error || !user?.email) return null
  const meta = (user.user_metadata ?? {}) as Record<string, string | undefined>
  const google = user.app_metadata?.provider === 'google' || (user.identities ?? []).some((i) => i.provider === 'google')
  return {
    email: user.email,
    name: meta.full_name ?? meta.name ?? user.email.split('@')[0],
    verified: google || Boolean(user.email_confirmed_at),
  }
}
