import { CircleCheck, PackagePlus, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { PageHeader } from '../components/Layout'
import { Button, Card, cx, Field, inputClass, Modal, useDialog } from '../components/ui'
import { formatDateTime, formatNumber } from '../domain/format'
import { buildableUnits, stockLevel, type StockLevel } from '../domain/metrics'
import { productName } from '../domain/orders'
import type { Material } from '../domain/types'
import { userName, useStore } from '../state/store'
import { forSale } from '../domain/catalog'

const LEVEL_STYLE: Record<StockLevel, string> = {
  OK: 'bg-green-wash text-green-ink',
  LOW: 'bg-amber-wash text-amber-ink',
  OUT: 'bg-red-wash text-red-ink',
}
const LEVEL_LABEL: Record<StockLevel, string> = { OK: 'In stock', LOW: 'Low', OUT: 'Out' }

export function Inventory() {
  const { state } = useStore()
  const [buying, setBuying] = useState<Material | null>(null)
  const purchase = useDialog()
  const low = state.materials.filter((m) => stockLevel(m.onHand, m.reorderLevel) !== 'OK')

  return (
    <>
      <PageHeader
        title="Material inventory"
        subtitle="Materials come off automatically when an order moves to Processing."
        actions={
          <Button
            variant="primary"
            onClick={() => {
              setBuying(state.materials[0])
              purchase.show()
            }}
          >
            <PackagePlus size={16} aria-hidden /> Record purchase
          </Button>
        }
      />

      {low.length > 0 && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl bg-amber-wash px-5 py-4 text-amber-ink">
          <TriangleAlert size={18} className="mt-0.5 shrink-0" aria-hidden />
          <div className="text-sm">
            <strong>Time to restock:</strong> {low.map((m) => `${m.name} (${formatNumber(m.onHand)} ${m.unit} left)`).join(', ')}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card title="Materials on hand" className="xl:col-span-2">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="text-left">
                  <th className="eyebrow pb-2 pr-3">Material</th>
                  <th className="eyebrow pb-2 pr-3 text-right">On hand</th>
                  <th className="eyebrow pb-2 pr-3 text-right">Reorder at</th>
                  <th className="eyebrow pb-2 pr-3">Status</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {state.materials.map((m) => {
                  const level = stockLevel(m.onHand, m.reorderLevel)
                  return (
                    <tr key={m.id} className="border-t border-line">
                      <td className="py-2.5 pr-3 font-medium">{m.name}</td>
                      <td className="tabular py-2.5 pr-3 text-right">
                        {formatNumber(m.onHand)} <span className="text-muted">{m.unit}</span>
                      </td>
                      <td className="tabular py-2.5 pr-3 text-right text-muted">{formatNumber(m.reorderLevel)}</td>
                      <td className="py-2.5 pr-3">
                        <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide', LEVEL_STYLE[level])}>
                          {level === 'OK' ? <CircleCheck size={11} aria-hidden /> : <TriangleAlert size={11} aria-hidden />}
                          {LEVEL_LABEL[level]}
                        </span>
                      </td>
                      <td className="py-2.5 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setBuying(m)
                            purchase.show()
                          }}
                        >
                          + Add stock
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="You can still make" subtitle="With the materials on hand right now">
          <ul className="space-y-2">
            {forSale(state.products).map((p) => {
              const n = buildableUnits(state, p.id)
              return (
                <li key={p.id} className="flex items-center justify-between gap-2 border-b border-line pb-2 text-sm last:border-0">
                  <span>{p.name}</span>
                  <span className={cx('tabular font-semibold', n <= 2 && 'text-red-ink')}>{n}</span>
                </li>
              )
            })}
          </ul>
        </Card>

        <Card title="Materials per bouquet" className="xl:col-span-2">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {forSale(state.products).map((p) => (
              <div key={p.id} className="rounded-xl border border-line p-3">
                <div className="mb-1.5 text-sm font-semibold">{productName(state, p.id)}</div>
                <ul className="space-y-0.5 text-xs text-ink-2">
                  {(state.recipes[p.id] ?? []).map((line) => {
                    const m = state.materials.find((x) => x.id === line.materialId)
                    return (
                      <li key={line.materialId} className="flex justify-between gap-2">
                        <span>{m?.name}</span>
                        <span className="tabular">
                          {formatNumber(line.qty)} {m?.unit}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Recent stock movements">
          <ul className="space-y-2.5">
            {state.movements.slice(0, 14).map((mv) => {
              const m = state.materials.find((x) => x.id === mv.materialId)
              return (
                <li key={mv.id} className="flex items-start justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <div className="truncate">{m?.name}</div>
                    <div className="text-xs text-muted">
                      {mv.reason === 'PURCHASE' ? `Purchase${mv.note ? ` · ${mv.note}` : ''}` : mv.reason === 'ORDER' ? `Used for ${mv.orderNumber}` : `Returned from ${mv.orderNumber}`} ·{' '}
                      {formatDateTime(mv.at)} · {userName(state, mv.by)}
                    </div>
                  </div>
                  <span className={cx('tabular shrink-0 font-semibold', mv.delta > 0 ? 'text-green-ink' : 'text-ink-2')}>
                    {mv.delta > 0 ? '+' : '−'}
                    {formatNumber(Math.abs(mv.delta))} {m?.unit}
                  </span>
                </li>
              )
            })}
          </ul>
        </Card>
      </div>

      {buying && <PurchaseDialog key={`${buying.id}-${purchase.key}`} open={purchase.open} initial={buying} onClose={purchase.hide} />}
    </>
  )
}

function PurchaseDialog({ open, initial, onClose }: { open: boolean; initial: Material; onClose: () => void }) {
  const { state, dispatch } = useStore()
  const [materialId, setMaterialId] = useState(initial.id)
  const [qty, setQty] = useState('')
  const [note, setNote] = useState('')
  const material = state.materials.find((m) => m.id === materialId)!
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record a purchase"
      subtitle={`${material.name}: ${formatNumber(material.onHand)} ${material.unit} on hand`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={async () => {
              const r = await dispatch({ type: 'RECORD_PURCHASE', materialId, qty: Number(qty), note })
              if (r.ok) onClose()
            }}
          >
            Add to stock
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Material">
          <select className={inputClass} value={materialId} onChange={(e) => setMaterialId(e.target.value)}>
            {state.materials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={`Quantity bought (${material.unit})`}>
          <input type="number" min={0} step="any" className={inputClass} value={qty} onChange={(e) => setQty(e.target.value)} autoFocus />
        </Field>
        <Field label="Note" hint="Optional — supplier, price, colour">
          <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}
