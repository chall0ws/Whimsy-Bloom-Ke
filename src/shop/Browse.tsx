import { ArrowRight, Check, Flower, Flower2, Gift, Leaf, MessageCircle, Minus, Plus, ShoppingBag, Truck } from 'lucide-react'
import { useState } from 'react'
import { HeartDivider, Script, Sparkles } from '../components/Logo'
import { Button, cx, Field, inputClass } from '../components/ui'
import { formatKES } from '../domain/format'
import { productPerformance } from '../domain/metrics'
import type { Product } from '../domain/types'
import { navigate } from '../router'
import { useStore } from '../state/store'
import { useCart } from './cart'
import { ProductArt } from './ProductArt'
import { forSale } from '../domain/catalog'

const FEATURES = [
  { icon: Flower2, title: 'Handmade flowers', detail: 'Fuzzy wire flowers & more' },
  { icon: Gift, title: 'Bespoke bouquets', detail: 'Made for your special moments' },
  { icon: Flower, title: 'Giant flowers', detail: 'For events, decor & photoshoots' },
  { icon: Leaf, title: 'Details that bloom', detail: 'Fillers, greenery & finishing touches' },
]

export function Home() {
  const { state } = useStore()
  // Live, visitors can't see other people's orders, so the server sends the best sellers.
  const favourites = (state.popularProductIds ?? productPerformance(state).map((p) => p.productId))
    .map((id) => forSale(state.products).find((x) => x.id === id))
    .filter((p) => p !== undefined)
    .slice(0, 3)
  // The bouquet in the arch at the top: the first one in the catalogue.
  const hero = forSale(state.products)[0]

  return (
    <div className="space-y-14">
      <section className="grid items-center gap-8 md:grid-cols-[1.1fr_0.9fr]">
        <div className="relative text-center md:text-left">
          <Sparkles className="absolute -top-4 right-6 w-16 md:right-auto md:left-64" />
          <Script className="block text-5xl leading-none sm:text-6xl">Handmade flowers,</Script>
          <h1 className="font-display text-5xl font-semibold leading-[1.05] text-green-ink sm:text-6xl">made with love</h1>
          <HeartDivider className="mx-auto mt-5 w-56 md:mx-0" />
          <p className="mx-auto mt-5 max-w-md text-[15px] leading-relaxed text-ink-2 md:mx-0">
            Bouquets that never wilt, shaped by hand for birthdays, anniversaries, events and just because. Hand delivery in Nairobi, courier anywhere else.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3 md:justify-start">
            <a href="#/shop" className="inline-flex h-12 items-center gap-2 rounded-full bg-green px-6 text-[15px] font-medium text-on-green hover:opacity-90">
              Shop bouquets <ArrowRight size={16} aria-hidden />
            </a>
            <a href="#/chat" className="inline-flex h-12 items-center gap-2 rounded-full border border-line-strong bg-surface px-6 text-[15px] font-medium hover:bg-surface-2">
              <MessageCircle size={16} aria-hidden /> Ask us anything
            </a>
          </div>
          <p className="mt-4 text-xs text-muted">No account needed to browse. Create one at checkout if you’d like to track your order.</p>
        </div>
        {hero && (
          <a href={`#/shop/${hero.id}`} className="relative mx-auto block w-full max-w-sm">
            <ProductArt productId={hero.id} label={hero.name} className="aspect-[4/5] rounded-b-[32px] rounded-t-[999px] border border-line-strong shadow-card" />
            <span className="absolute bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-surface/90 px-4 py-1.5 text-sm font-medium shadow-sm">
              {hero.name} · {formatKES(hero.price)}
            </span>
          </a>
        )}
      </section>

      <ul className="grid grid-cols-2 gap-y-6 rounded-3xl border border-dashed border-line-strong bg-surface/60 px-4 py-6 text-center sm:grid-cols-4">
        {FEATURES.map(({ icon: Icon, title, detail }) => (
          <li key={title} className="flex flex-col items-center gap-1.5 px-2">
            <Icon size={28} strokeWidth={1.2} className="text-green-ink" aria-hidden />
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink">{title}</span>
            <span className="text-xs leading-snug text-muted">{detail}</span>
          </li>
        ))}
      </ul>

      <section>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <Script className="block text-4xl leading-none">Customer</Script>
            <h2 className="font-display text-3xl font-semibold text-green-ink">favourites</h2>
          </div>
          <a href="#/shop" className="inline-flex items-center gap-1 text-sm font-medium text-ink-2 hover:text-ink">
            See all bouquets <ArrowRight size={14} aria-hidden />
          </a>
        </div>
        <div className="anim-stagger grid grid-cols-1 gap-5 sm:grid-cols-3">
          {favourites.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      <section className="rounded-3xl bg-surface p-6 shadow-card sm:p-8">
        <h2 className="text-center font-display text-3xl font-semibold text-green-ink">How it works</h2>
        <ol className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {[
            ['Choose your bouquet', 'Pick from the shop, or chat with us about something custom.'],
            ['Make it yours', 'Tell us your colours, a card message or any wishes.'],
            ['We deliver', 'Pay with M-Pesa. We hand-deliver in Nairobi or send it by courier.'],
          ].map(([title, text], i) => (
            <li key={title} className="flex flex-col items-center gap-2 text-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-pink-wash font-display text-xl font-semibold text-pink-ink">{i + 1}</span>
              <span className="font-semibold">{title}</span>
              <span className="max-w-xs text-sm text-ink-2">{text}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}

export function ProductCard({ product }: { product: Product }) {
  const { add } = useCart()
  const { toast } = useStore()
  return (
    <article className="group flex flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-card transition duration-300 ease-out hover:-translate-y-1 hover:shadow-lg">
      <a href={`#/shop/${product.id}`} className="block">
        <ProductArt productId={product.id} label={product.name} className="aspect-[4/5] transition-transform duration-500 ease-out group-hover:scale-[1.04]" />
      </a>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <div className="flex items-baseline justify-between gap-3">
          <a href={`#/shop/${product.id}`} className="font-display text-xl font-semibold leading-tight hover:underline">
            {product.name}
          </a>
          <span className="shrink-0 font-semibold">{formatKES(product.price)}</span>
        </div>
        <p className="text-sm text-ink-2">{product.blurb}</p>
        <div className="mt-auto flex gap-2 pt-3">
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              add(product.id, 1)
              toast(`${product.name} added to your cart.`)
            }}
          >
            <ShoppingBag size={14} aria-hidden /> Add to cart
          </Button>
          <a href={`#/shop/${product.id}`} className="inline-flex h-8 items-center rounded-full px-3 text-xs font-medium text-ink-2 hover:bg-surface-2">
            Make it yours
          </a>
        </div>
      </div>
    </article>
  )
}

export function Catalog() {
  const { state } = useStore()
  return (
    <div>
      <div className="mb-6 text-center">
        <Script className="block text-5xl leading-none">Our</Script>
        <h1 className="font-display text-4xl font-semibold text-green-ink">bouquets</h1>
        <HeartDivider className="mx-auto mt-3 w-48" />
        <p className="mt-3 text-sm text-ink-2">Every bouquet is handmade to order. Add your colours and a card message on the next page.</p>
      </div>
      <div className="anim-stagger grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {forSale(state.products).map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </div>
  )
}

export function ProductPage({ productId }: { productId: string }) {
  const { state, toast } = useStore()
  const { add } = useCart()
  const [qty, setQty] = useState(1)
  const [note, setNote] = useState('')
  const product = state.products.find((p) => p.id === productId)

  if (!product) {
    return (
      <div className="py-16 text-center">
        <p className="font-display text-2xl">We couldn’t find that bouquet.</p>
        <a href="#/shop" className="mt-4 inline-block font-medium text-pink-ink hover:underline">
          See all bouquets
        </a>
      </div>
    )
  }

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <ProductArt productId={product.id} label={product.name} className="mx-auto aspect-[4/5] w-full max-w-md rounded-b-[32px] rounded-t-[999px] border border-line-strong shadow-card" />
      <div className="flex flex-col gap-4">
        <a href="#/shop" className="text-sm text-ink-2 hover:text-ink">
          ← All bouquets
        </a>
        <div>
          <h1 className="font-display text-4xl font-semibold leading-tight text-green-ink">{product.name}</h1>
          <p className="mt-1 text-2xl font-semibold">{formatKES(product.price)}</p>
        </div>
        <p className="text-ink-2">{product.blurb}</p>
        <ul className="space-y-1.5 text-sm text-ink-2">
          {['Handmade to order, never wilts', 'Your colours and card message included', 'Hand delivery in Nairobi is free'].map((t) => (
            <li key={t} className="flex items-center gap-2">
              <Check size={15} className="text-green-ink" aria-hidden /> {t}
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3">
          <span className="text-sm font-medium">How many</span>
          <span className="flex items-center gap-3">
            <button type="button" onClick={() => setQty(Math.max(1, qty - 1))} className="rounded-full border border-line-strong p-1.5" aria-label="One fewer">
              <Minus size={14} />
            </button>
            <span className="w-6 text-center font-semibold" aria-live="polite">
              {qty}
            </span>
            <button type="button" onClick={() => setQty(Math.min(20, qty + 1))} className="rounded-full border border-line-strong p-1.5" aria-label="One more">
              <Plus size={14} />
            </button>
          </span>
        </div>

        <Field label="Make it yours (optional)" hint="Colours, ribbon, wrapping or a card message.">
          <textarea id="product-note" className={inputClass} rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Blush ribbon, card: “Happy birthday Mum!”" />
        </Field>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant="primary"
            className="!h-12 flex-1 !text-base"
            onClick={() => {
              add(product.id, qty, note)
              toast(`${product.name} added to your cart.`)
              setQty(1)
              setNote('')
            }}
          >
            <ShoppingBag size={17} aria-hidden /> Add to cart · {formatKES(product.price * qty)}
          </Button>
          <Button
            variant="secondary"
            className="!h-12 !text-base"
            onClick={() => {
              add(product.id, qty, note)
              navigate({ page: 'checkout' })
            }}
          >
            Buy now
          </Button>
        </div>
        <p className={cx('flex items-center gap-2 text-xs text-muted')}>
          <Truck size={14} aria-hidden /> Courier delivery {formatKES(state.settings.defaultShippingFee)} · Hand delivery free in Nairobi
        </p>
      </div>
    </div>
  )
}
