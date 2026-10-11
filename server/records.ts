import { MATERIALS, withCatalogue } from '../src/domain/catalog'
import { STATE_VERSION } from '../src/domain/seed'
import type { AppState, ChatStatus, Settings } from '../src/domain/types'

/**
 * The shop is stored as one row per thing (order, customer, chat…) in a `records` table,
 * plus one `app_meta` row for settings and counters. These helpers convert between that
 * and the AppState the domain rules work on.
 */
export type Kind = 'user' | 'product' | 'material' | 'recipe' | 'customer' | 'order' | 'thread' | 'fee' | 'payout' | 'movement' | 'audit'

export interface RecordRow {
  kind: Kind
  id: string
  data: unknown
}

export interface Meta {
  settings: Settings
  chatStatus: ChatStatus
  nextOrderNumber: number
  nextId: number
}

export interface Changes {
  upserts: RecordRow[]
  deletes: { kind: Kind; id: string }[]
  meta: Meta
}

export function toRecords(state: AppState): RecordRow[] {
  const rows: RecordRow[] = []
  const add = (kind: Kind, items: { id: string }[]) => items.forEach((data) => rows.push({ kind, id: data.id, data }))
  add('user', state.users)
  add('product', state.products)
  add('material', state.materials)
  Object.entries(state.recipes).forEach(([productId, lines]) => rows.push({ kind: 'recipe', id: productId, data: lines }))
  add('customer', state.customers)
  add('order', state.orders)
  add('thread', state.threads)
  add('fee', state.fees)
  add('payout', state.payouts)
  add('movement', state.movements)
  add('audit', state.audit)
  return rows
}

export function toMeta(state: AppState): Meta {
  return { settings: state.settings, chatStatus: state.chatStatus, nextOrderNumber: state.nextOrderNumber, nextId: state.nextId }
}

const byIndex = (order: string[]) => (a: { id: string }, b: { id: string }) => {
  const ia = order.indexOf(a.id)
  const ib = order.indexOf(b.id)
  return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib) || a.id.localeCompare(b.id)
}
const newestFirst = <T>(key: (x: T) => string) => (a: T, b: T) => key(b).localeCompare(key(a))

export function fromRecords(rows: RecordRow[], meta: Meta): AppState {
  const of = <T>(kind: Kind) => rows.filter((r) => r.kind === kind).map((r) => r.data as T)
  const recipes: AppState['recipes'] = {}
  rows.filter((r) => r.kind === 'recipe').forEach((r) => (recipes[r.id] = r.data as AppState['recipes'][string]))
  return {
    version: STATE_VERSION,
    users: of<AppState['users'][number]>('user').sort((a, b) => a.id.localeCompare(b.id)),
    currentUserId: '',
    products: withCatalogue(of<AppState['products'][number]>('product')),
    materials: of<AppState['materials'][number]>('material').sort(byIndex(MATERIALS.map((m) => m.id))),
    recipes,
    customers: of<AppState['customers'][number]>('customer').sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    orders: of<AppState['orders'][number]>('order').sort(newestFirst((o) => o.createdAt)),
    threads: of<AppState['threads'][number]>('thread').sort((a, b) => a.startedAt.localeCompare(b.startedAt)),
    fees: of<AppState['fees'][number]>('fee').sort(newestFirst((f) => f.at)),
    payouts: of<AppState['payouts'][number]>('payout').sort(newestFirst((p) => p.sentAt)),
    movements: of<AppState['movements'][number]>('movement').sort(newestFirst((m) => m.at)),
    audit: of<AppState['audit'][number]>('audit').sort(newestFirst((a) => a.at)),
    settings: meta.settings,
    chatStatus: meta.chatStatus,
    nextOrderNumber: meta.nextOrderNumber,
    // Never hand out an id that's already taken, even if the counter fell behind
    // (an earlier bug lost some increments, so new log lines reused old ids).
    nextId: Math.max(meta.nextId, highestId(rows) + 1),
  }
}

/** The largest number used in any id ("o-1042", "a-1043", and messages inside chats). */
function highestId(rows: RecordRow[]): number {
  let max = 0
  const see = (id: unknown) => {
    const n = Number(/-(\d+)$/.exec(String(id))?.[1])
    if (n > max) max = n
  }
  for (const r of rows) {
    see(r.id)
    if (r.kind === 'thread') for (const m of (r.data as { messages?: { id: string }[] }).messages ?? []) see(m.id)
  }
  return max
}

/** Only the rows that actually changed, so concurrent edits to other things don't collide. */
export function diff(prev: AppState, next: AppState): Changes {
  const key = (r: { kind: Kind; id: string }) => `${r.kind}:${r.id}`
  const before = new Map(toRecords(prev).map((r) => [key(r), JSON.stringify(r.data)]))
  const afterRows = toRecords(next)
  const after = new Set(afterRows.map(key))
  return {
    upserts: afterRows.filter((r) => before.get(key(r)) !== JSON.stringify(r.data)),
    deletes: toRecords(prev)
      .filter((r) => !after.has(key(r)))
      .map(({ kind, id }) => ({ kind, id })),
    meta: toMeta(next),
  }
}
