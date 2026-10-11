import type { Material, Product, Recipes, Settings, User } from './types'

export const USERS: User[] = [
  { id: 'u-partner', name: 'Partner', email: 'partner@example.com', role: 'SUPER_ADMIN', title: 'Super admin · Platform partner' },
  { id: 'u-owner', name: 'Owner', email: 'owner@example.com', role: 'ADMIN', title: 'Admin · Whimsy & Bloom' },
]

export const PRODUCTS: Product[] = [
  // Bouquets for sale, in the order the shop shows them. The first one is the home page's feature.
  { id: 'p-peach-blossom-crown', name: 'Peach Blossom Crown', price: 4550, image: 'products/peach-blossom-crown.jpg', blurb: 'A ring of peach lilies around a speckled pink stargazer, in rose-print wrap.' },
  { id: 'p-golden-hour', name: 'Golden Hour', price: 4200, image: 'products/golden-hour.jpg', blurb: 'Seven sunflowers with dried baby’s breath, tied with a black satin bow.' },
  { id: 'p-lavender-dream', name: 'Lavender Dream', price: 4700, image: 'products/lavender-dream.jpg', blurb: 'Violet bellflowers circling a speckled lavender lily.' },
  { id: 'p-velvet-valentine', name: 'Velvet Valentine', price: 4950, image: 'products/velvet-valentine.jpg', blurb: 'Burgundy and blush lilies around a stargazer, on black floral wrap.' },
  { id: 'p-peach-sunrise', name: 'Peach Sunrise', price: 4300, image: 'products/peach-sunrise.jpg', blurb: 'Coral carnations and sunflowers with little white daisies, in gold-edged wrap.' },
  { id: 'p-blue-lagoon', name: 'Blue Lagoon', price: 4600, image: 'products/blue-lagoon.jpg', blurb: 'Lilies in every shade of blue, from deep cobalt to cloud white.' },
  { id: 'p-autumn-cocoa', name: 'Autumn Cocoa', price: 4750, image: 'products/autumn-cocoa.jpg', blurb: 'Cocoa, cream and caramel blooms with daisies, tied with a brown satin ribbon.' },
  { id: 'p-mint-whisper', name: 'Mint Whisper', price: 4500, image: 'products/mint-whisper.jpg', blurb: 'Snow-white lilies and mint carnations in a crystal-clear wrap.' },
  { id: 'p-scarlet-night', name: 'Scarlet Night', price: 4850, image: 'products/scarlet-night.jpg', blurb: 'A dozen scarlet lilies on black wrap with hand-drawn florals.' },
  { id: 'p-raspberry-garden', name: 'Raspberry Garden', price: 4900, image: 'products/raspberry-garden.jpg', blurb: 'Raspberry carnations and speckled stargazer lilies, wrapped in white and gold.' },
  { id: 'p-spring-meadow', name: 'Spring Meadow', price: 4250, image: 'products/spring-meadow.jpg', blurb: 'Red tulips, blush daffodils and leafy sprigs, tied with a chocolate ribbon.' },
  { id: 'p-violet-starlight', name: 'Violet Starlight', price: 4350, image: 'products/violet-starlight.jpg', blurb: 'Shimmering violet lilies in layered lavender wrap.' },
  { id: 'p-pink-picnic', name: 'Pink Picnic', price: 4000, image: 'products/pink-picnic.jpg', blurb: 'A playful posy of pink and white blooms in gingham wrap with a pearl trim.' },
  { id: 'p-mocha-lily', name: 'Mocha Lily', price: 4400, image: 'products/mocha-lily.jpg', blurb: 'Lilies in cream, caramel and chocolate, wrapped in warm kraft tones.' },
  { id: 'p-rosy-stargazer', name: 'Rosy Stargazer', price: 4650, image: 'products/rosy-stargazer.jpg', blurb: 'Rose-pink lilies around a speckled stargazer, in soft pink wrap.' },
  { id: 'p-midnight-romance', name: 'Midnight Romance', price: 4800, image: 'products/midnight-romance.jpg', blurb: 'Crimson carnations and blush lilies around a frilled white bloom, in smoky black wrap.' },
  { id: 'p-lilac-twilight', name: 'Lilac Twilight', price: 4100, image: 'products/lilac-twilight.jpg', blurb: 'Violet lilies with lilac sprigs, in a lavender wrap.' },

  // Earlier sample bouquets: no longer sold, kept so past orders still show their names.
  { id: 'p-pink-lily', name: 'Bespoke Pink Lily', price: 3500, blurb: 'Hand-shaped pink lilies with eucalyptus leaves.', hidden: true },
  { id: 'p-giant-rose', name: 'Giant Rose', price: 4800, blurb: 'A single statement rose, 60 cm across.', hidden: true },
  { id: 'p-tulip', name: 'Soft Pink Tulips', price: 2800, blurb: 'Ten tulips in blush and soft pink.', hidden: true },
  { id: 'p-peony', name: 'Peony Posy', price: 3200, blurb: 'Full peonies with baby’s breath.', hidden: true },
  { id: 'p-sunflower', name: 'Sunflower Bunch', price: 2500, blurb: 'Bright sunflowers wrapped in kraft paper.', hidden: true },
  { id: 'p-rosebud-box', name: 'Rosebud Box', price: 1800, blurb: 'Nine rosebuds in a keepsake box.', hidden: true },
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
  serviceFee: 75,
  transactionFeePercent: 1.5,
  feeOnHandDelivery: true,
  defaultShippingFee: 300,
  payoutSchedule: 'WEEKLY',
}

/** Suggestions when shipping: buses and couriers outside Nairobi, couriers abroad. Any name can be typed. */
export const COURIERS = ['Easy Coach', '2NK Sacco', 'Guardian Angel', 'Mash Poa', 'G4S', 'Fargo Courier', 'Wells Fargo', 'DHL']
