import type { AppState } from './types'

export interface FeeSummary {
  /** Every service fee ever charged. */
  collected: number
  /** Payouts the super admin has confirmed receiving. */
  paidOut: number
  /** Payouts sent by the admin but not yet confirmed. */
  inTransit: number
  /** Owed to the partner: collected minus confirmed payouts. */
  payable: number
  /** What can still be sent: payable minus payouts already on the way. */
  availableToSend: number
  shippedCount: number
}

export function feeSummary(state: AppState): FeeSummary {
  const collected = state.fees.reduce((sum, f) => sum + f.amount, 0)
  const paidOut = state.payouts.filter((p) => p.status === 'CONFIRMED').reduce((sum, p) => sum + p.amount, 0)
  const inTransit = state.payouts.filter((p) => p.status === 'SENT').reduce((sum, p) => sum + p.amount, 0)
  const payable = collected - paidOut
  return {
    collected,
    paidOut,
    inTransit,
    payable,
    availableToSend: payable - inTransit,
    shippedCount: state.fees.length,
  }
}
