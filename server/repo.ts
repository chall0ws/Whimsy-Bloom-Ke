import { DEFAULT_SETTINGS } from '../src/domain/catalog'
import type { AppState } from '../src/domain/types'
import { diff, fromRecords, toMeta, toRecords, type Changes, type Meta, type RecordRow } from './records'

/** Where the shop's data lives. Supabase in production; memory in tests. */
export interface Repo {
  /** The whole shop plus a version number that goes up with every save. */
  load(): Promise<{ state: AppState; version: number }>
  /** Saves `next` if nobody else saved since `version`. Returns the new version, or null on a clash. */
  save(prev: AppState, next: AppState, version: number): Promise<number | null>
  /** Tells open dashboards and shops that something changed. */
  notify(version: number): Promise<void>
}

export function hasChanges(changes: Changes, prev: AppState): boolean {
  return changes.upserts.length > 0 || changes.deletes.length > 0 || JSON.stringify(changes.meta) !== JSON.stringify(toMeta(prev))
}

/** In-memory Repo with the same version check as the database function. */
export class MemoryRepo implements Repo {
  rows = new Map<string, RecordRow>()
  meta: Meta | null = null
  version = 0
  notified: number[] = []

  async load() {
    const meta = this.meta ?? { settings: DEFAULT_SETTINGS, chatStatus: 'ONLINE', nextOrderNumber: 1001, nextId: 1000 }
    return { state: fromRecords([...this.rows.values()].map((r) => structuredClone(r)), structuredClone(meta) as Meta), version: this.version }
  }

  async save(prev: AppState, next: AppState, version: number) {
    if (version !== this.version) return null
    const changes = diff(prev, next)
    if (!hasChanges(changes, prev)) return this.version
    // Like Postgres: one save can't write the same row twice.
    const keys = changes.upserts.map((r) => `${r.kind}:${r.id}`)
    const twice = keys.filter((k, i) => keys.indexOf(k) !== i)
    if (twice.length) throw new Error(`Couldn’t save: ON CONFLICT DO UPDATE command cannot affect row a second time (${twice.join(', ')})`)
    changes.upserts.forEach((r) => this.rows.set(`${r.kind}:${r.id}`, structuredClone(r)))
    changes.deletes.forEach((r) => this.rows.delete(`${r.kind}:${r.id}`))
    this.meta = structuredClone(changes.meta)
    this.version += 1
    return this.version
  }

  async notify(version: number) {
    this.notified.push(version)
  }

  /** Test helper: start from a ready-made state. */
  static from(state: AppState): MemoryRepo {
    const repo = new MemoryRepo()
    toRecords(state).forEach((r) => repo.rows.set(`${r.kind}:${r.id}`, structuredClone(r)))
    repo.meta = toMeta(state)
    repo.version = 1
    return repo
  }
}
