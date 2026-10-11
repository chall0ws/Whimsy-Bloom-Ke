import type { Material, Product, Recipes, Settings, User } from './types'

export const USERS: User[] = [
  { id: 'u-partner', name: 'Partner', email: 'partner@example.com', role: 'SUPER_ADMIN', title: 'Super admin · Platform partner' },
  { id: 'u-owner', name: 'Owner', email: 'owner@example.com', role: 'ADMIN', title: 'Admin · Whimsy & Bloom' },
]

export const PRODUCTS: Product[] = [
  { id: 'p-pink-lily', name: 'Bespoke Pink Lily', price: 3500, blurb: 'Hand-shaped pink lilies with eucalyptus leaves.' },
  { id: 'p-giant-rose', name: 'Giant Rose', price: 4800, blurb: 'A single statement rose, 60 cm across.' },
  { id: 'p-tulip', name: 'Soft Pink Tulips', price: 2800, blurb: 'Ten tulips in blush and soft pink.' },
  { id: 'p-peony', name: 'Peony Posy', price: 3200, blurb: 'Full peonies with baby’s breath.' },
  { id: 'p-sunflower', name: 'Sunflower Bunch', price: 2500, blurb: 'Bright sunflowers wrapped in kraft paper.' },
  { id: 'p-rosebud-box', name: 'Rosebud Box', price: 1800, blurb: 'Nine rosebuds in a keepsake box.' },
]

/** Bouquets customers can order now. */
export const forSale = (products: Product[]) => products.filter((p) => !p.hidden)

/**
 * The catalogue in this file is the source of truth. Products saved earlier that are no longer
 * listed stay (hidden) so old orders keep their names.
 */
export function withCatalogue(saved: Product[]): Product[] {
  const listed = new Set(PRODUCTS.map((p) => p.id))
  return [...PRODUCTS, ...saved.filter((p) => !listed.has(p.id)).map((p) => ({ ...p, hidden: true }))]
}

export const MATERIALS: Material[] = [
  { id: 'm-crepe-pink', name: 'Crepe paper — pink', unit: 'roll', onHand: 14, reorderLevel: 6 },
  { id: 'm-crepe-green', name: 'Crepe paper — green', unit: 'roll', onHand: 9, reorderLevel: 4 },
  { id: 'm-crepe-red', name: 'Crepe paper — red', unit: 'roll', onHand: 3, reorderLevel: 4 },
  { id: 'm-crepe-yellow', name: 'Crepe paper — yellow', unit: 'roll', onHand: 6, reorderLevel: 3 },
  { id: 'm-wire', name: 'Floral wire', unit: 'pcs', onHand: 320, reorderLevel: 120 },
  { id: 'm-tape', name: 'Floral tape', unit: 'roll', onHand: 11, reorderLevel: 5 },
  { id: 'm-pigment', name: 'Petal pigment', unit: 'ml', onHand: 180, reorderLevel: 100 },
  { id: 'm-wrap', name: 'Wrapping paper', unit: 'sheet', onHand: 42, reorderLevel: 20 },
  { id: 'm-ribbon', name: 'Satin ribbon', unit: 'm', onHand: 28, reorderLevel: 15 },
  { id: 'm-box', name: 'Keepsake box', unit: 'pcs', onHand: 7, reorderLevel: 5 },
]

export const RECIPES: Recipes = {
  'p-pink-lily': [
    { materialId: 'm-crepe-pink', qty: 0.5 },
    { materialId: 'm-crepe-green', qty: 0.25 },
    { materialId: 'm-wire', qty: 12 },
    { materialId: 'm-tape', qty: 0.25 },
    { materialId: 'm-pigment', qty: 10 },
    { materialId: 'm-wrap', qty: 2 },
    { materialId: 'm-ribbon', qty: 1 },
  ],
  'p-giant-rose': [
    { materialId: 'm-crepe-red', qty: 1 },
    { materialId: 'm-crepe-green', qty: 0.5 },
    { materialId: 'm-wire', qty: 20 },
    { materialId: 'm-tape', qty: 0.5 },
    { materialId: 'm-pigment', qty: 15 },
    { materialId: 'm-ribbon', qty: 1.5 },
  ],
  'p-tulip': [
    { materialId: 'm-crepe-pink', qty: 0.5 },
    { materialId: 'm-crepe-green', qty: 0.25 },
    { materialId: 'm-wire', qty: 10 },
    { materialId: 'm-tape', qty: 0.25 },
    { materialId: 'm-wrap', qty: 2 },
    { materialId: 'm-ribbon', qty: 1 },
  ],
  'p-peony': [
    { materialId: 'm-crepe-pink', qty: 0.75 },
    { materialId: 'm-crepe-green', qty: 0.25 },
    { materialId: 'm-wire', qty: 8 },
    { materialId: 'm-tape', qty: 0.25 },
    { materialId: 'm-pigment', qty: 8 },
    { materialId: 'm-wrap', qty: 1 },
    { materialId: 'm-ribbon', qty: 1 },
  ],
  'p-sunflower': [
    { materialId: 'm-crepe-yellow', qty: 0.5 },
    { materialId: 'm-crepe-green', qty: 0.25 },
    { materialId: 'm-wire', qty: 8 },
    { materialId: 'm-tape', qty: 0.25 },
    { materialId: 'm-wrap', qty: 2 },
    { materialId: 'm-ribbon', qty: 1 },
  ],
  'p-rosebud-box': [
    { materialId: 'm-crepe-red', qty: 0.25 },
    { materialId: 'm-crepe-pink', qty: 0.25 },
    { materialId: 'm-wire', qty: 9 },
    { materialId: 'm-box', qty: 1 },
  ],
}

export const DEFAULT_SETTINGS: Settings = {
  serviceFee: 100,
  feeOnHandDelivery: true,
  defaultShippingFee: 300,
  payoutSchedule: 'WEEKLY',
}

export const COURIERS = ['G4S', 'Fargo Courier', 'Wells Fargo', 'Sendy rider']
