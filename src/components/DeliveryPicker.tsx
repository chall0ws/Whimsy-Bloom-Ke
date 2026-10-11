import type { DeliveryOption, FulfilmentMethod } from '../domain/types'
import { COURIERS } from '../domain/catalog'
import { cx, Field, inputClass } from './ui'

export interface DeliveryChoice {
  method: FulfilmentMethod | null
  option: DeliveryOption | null
  busService: string
  address: string
}

export const NO_DELIVERY: DeliveryChoice = { method: null, option: null, busService: '', address: '' }

/** What's still missing, in the customer's words, or '' when it's complete. */
export function deliveryProblem(d: DeliveryChoice): string {
  if (!d.method) return 'Please choose Within Nairobi, Outside Nairobi or Outside Kenya.'
  if (d.method === 'HAND_DELIVERY' && !d.option) return 'Please choose Pickup Mtaani or Rider.'
  if (d.method === 'SHIPPING' && !d.busService.trim()) return 'Please tell us which bus service to send it with.'
  if (!d.address.trim()) return d.option === 'PICKUP_MTAANI' && d.method === 'HAND_DELIVERY' ? 'Please add your Pickup Mtaani agent.' : 'Please add where we should deliver.'
  return ''
}

const BUSES = COURIERS.slice(0, 4)

function Radio({ checked, onSelect, title, detail, invalid }: { checked: boolean; onSelect: () => void; title: string; detail?: string; invalid?: boolean }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      className={cx(
        'flex items-start gap-2.5 rounded-2xl border p-3 text-left transition-colors',
        checked ? 'border-green bg-green-wash' : invalid ? 'border-red-ink/60' : 'border-line-strong hover:bg-surface-2',
      )}
    >
      <span className={cx('mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2', checked ? 'border-green' : 'border-line-strong')} aria-hidden>
        {checked && <span className="h-2 w-2 rounded-full bg-green" />}
      </span>
      <span>
        <span className="block text-sm font-semibold">{title}</span>
        {detail && <span className="block text-xs text-muted">{detail}</span>}
      </span>
    </button>
  )
}

/**
 * Where an order is going: within Nairobi (Pickup Mtaani or a rider), outside Nairobi (by a bus
 * service the customer names) or outside Kenya. Used at checkout and in the dashboard.
 */
export function DeliveryPicker({ value, onChange, showErrors, idPrefix }: { value: DeliveryChoice; onChange: (d: DeliveryChoice) => void; showErrors?: boolean; idPrefix: string }) {
  const set = (patch: Partial<DeliveryChoice>) => onChange({ ...value, ...patch })
  const { method, option } = value
  const addressLabel =
    method === 'HAND_DELIVERY' && option === 'PICKUP_MTAANI'
      ? 'Your Pickup Mtaani agent'
      : method === 'SHIPPING'
        ? 'Town and pick-up stage'
        : method === 'INTERNATIONAL'
          ? 'Full delivery address, including the country'
          : 'Deliver to'
  const placeholder =
    method === 'HAND_DELIVERY' && option === 'PICKUP_MTAANI'
      ? 'e.g. Westlands, Sarit Centre agent'
      : method === 'SHIPPING'
        ? 'e.g. Nakuru, Easy Coach office'
        : method === 'INTERNATIONAL'
          ? 'Street, city, postcode, country'
          : 'Estate / building, area'

  return (
    <div className="space-y-3">
      <div role="radiogroup" aria-label="Where should we deliver?" aria-required="true" className="grid gap-2 sm:grid-cols-3">
        <Radio checked={method === 'HAND_DELIVERY'} onSelect={() => set({ method: 'HAND_DELIVERY' })} title="Within Nairobi" invalid={showErrors && !method} />
        <Radio checked={method === 'SHIPPING'} onSelect={() => set({ method: 'SHIPPING' })} title="Outside Nairobi" invalid={showErrors && !method} />
        <Radio checked={method === 'INTERNATIONAL'} onSelect={() => set({ method: 'INTERNATIONAL' })} title="Outside Kenya" invalid={showErrors && !method} />
      </div>

      {method === 'HAND_DELIVERY' && (
        <div role="radiogroup" aria-label="How should it get to you?" aria-required="true" className="grid grid-cols-2 gap-2">
          <Radio checked={option === 'PICKUP_MTAANI'} onSelect={() => set({ option: 'PICKUP_MTAANI' })} title="Pickup Mtaani" detail="Collect from an agent near you" invalid={showErrors && !option} />
          <Radio checked={option === 'RIDER'} onSelect={() => set({ option: 'RIDER' })} title="Rider" detail="Delivered to your door" invalid={showErrors && !option} />
        </div>
      )}

      {method === 'SHIPPING' && (
        <Field label="Which bus service would you like us to use?">
          <input
            id={`${idPrefix}-bus`}
            list={`${idPrefix}-buses`}
            className={cx(inputClass, showErrors && !value.busService.trim() && 'border-red-ink/60')}
            value={value.busService}
            onChange={(e) => set({ busService: e.target.value })}
            placeholder="e.g. Easy Coach, 2NK, Guardian"
          />
          <datalist id={`${idPrefix}-buses`}>
            {BUSES.map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>
        </Field>
      )}

      {method === 'INTERNATIONAL' && <p className="text-xs text-muted">We’ll confirm the courier and cost with you before sending. Pay by card.</p>}

      {(method !== 'HAND_DELIVERY' || option) && method && (
        <Field label={addressLabel}>
          <input
            id={`${idPrefix}-address`}
            className={cx(inputClass, showErrors && !value.address.trim() && 'border-red-ink/60')}
            value={value.address}
            onChange={(e) => set({ address: e.target.value })}
            placeholder={placeholder}
            autoComplete={option === 'PICKUP_MTAANI' ? 'off' : 'street-address'}
          />
        </Field>
      )}
    </div>
  )
}
