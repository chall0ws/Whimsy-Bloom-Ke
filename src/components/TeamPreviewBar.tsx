import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { useStaffRole } from '../auth/StaffGate'

/** Shown on customer pages only to team members, with a way back to the dashboard. */
export function TeamPreviewBar({ children, back = '#/admin' }: { children?: ReactNode; back?: string }) {
  const role = useStaffRole()
  if (!role) return null
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-surface-2 px-3 py-2 text-xs text-ink-2">
      <span>
        <strong>Customer view.</strong> {children ?? 'This is what customers see.'}
      </span>
      <a href={back} className="inline-flex shrink-0 items-center gap-1 font-medium text-ink hover:underline">
        <ArrowLeft size={13} aria-hidden /> Dashboard
      </a>
    </div>
  )
}
