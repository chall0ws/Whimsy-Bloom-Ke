import { useEffect } from 'react'
import { AuthProvider } from './auth/AuthProvider'
import { StaffGate } from './auth/StaffGate'
import { LIVE } from './config'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Layout } from './components/Layout'
import { OrderDrawer } from './components/orders'
import { Toasts } from './components/ui'
import { CustomerChat } from './pages/CustomerChat'
import { Customers } from './pages/Customers'
import { Fees } from './pages/Fees'
import { Inbox } from './pages/Inbox'
import { Inventory } from './pages/Inventory'
import { Orders } from './pages/Orders'
import { Overview } from './pages/Overview'
import { Settings } from './pages/Settings'
import { isAdminRoute, useRoute, type Route } from './router'
import { AccountPage } from './shop/Account'
import { Catalog, Home, ProductPage } from './shop/Browse'
import { CartProvider } from './shop/cart'
import { confirm, outcomeMessage, takeReturnFromPaystack } from './shop/paystack'
import { CartPage, Checkout, Thanks } from './shop/Checkout'
import { Privacy, Terms } from './shop/Legal'
import { ShopLayout } from './shop/ShopLayout'
import { StoreProvider, useStore } from './state/store'
import { applyTheme, readTheme } from './theme'

/** Pages glide in when you move between them; tabs and chats inside a page don't replay it. */
function pageKey(route: Route): string {
  if (route.page === 'product') return `product:${route.productId}`
  if (route.page === 'thanks') return `thanks:${route.orderId}`
  return route.page
}

function Page() {
  const route = useRoute()
  const admin = isAdminRoute(route)

  // The shop always wears the brand look; the dashboard follows the team member's choice.
  useEffect(() => applyTheme(admin ? readTheme() : 'light'), [admin])

  if (!isAdminRoute(route)) {
    // The shop is the front door: open to everyone, no sign-in needed to browse or buy.
    return (
      <>
        <ShopLayout route={route}>
          <div key={pageKey(route)} className="anim-page">
            <ErrorBoundary>
              {route.page === 'home' && <Home />}
              {route.page === 'shop' && <Catalog />}
              {route.page === 'product' && <ProductPage productId={route.productId} />}
              {route.page === 'cart' && <CartPage />}
              {route.page === 'checkout' && <Checkout />}
              {route.page === 'thanks' && <Thanks orderId={route.orderId} />}
              {route.page === 'account' && <AccountPage tab={route.tab} />}
              {route.page === 'chat' && <CustomerChat />}
              {route.page === 'privacy' && <Privacy />}
              {route.page === 'terms' && <Terms />}
            </ErrorBoundary>
          </div>
        </ShopLayout>
        <Toasts />
      </>
    )
  }

  // The dashboard, under #/admin, for signed-in team members only.
  return (
    <StaffGate>
      <Layout route={route}>
        <div key={pageKey(route)} className="anim-page">
          <ErrorBoundary>
            {route.page === 'overview' && <Overview />}
            {route.page === 'orders' && <Orders />}
            {route.page === 'inbox' && <Inbox threadId={route.threadId} />}
            {route.page === 'customers' && <Customers customerId={route.customerId} />}
            {route.page === 'inventory' && <Inventory />}
            {route.page === 'fees' && <Fees />}
            {route.page === 'settings' && <Settings />}
          </ErrorBoundary>
        </div>
        <OrderDrawer />
      </Layout>
      <Toasts />
    </StaffGate>
  )
}

// Read before the first render, so the page opens straight on the thank-you page.
const paystackReturn = LIVE ? takeReturnFromPaystack() : null

/** Finishes a payment made on Paystack's page: checks it and shows the result. */
function PaystackReturn() {
  const { toast, refresh } = useStore()
  useEffect(() => {
    const back = paystackReturn
    if (!back) return
    confirm(back.reference).then(async (outcome) => {
      const message = outcomeMessage(outcome)
      if (message) toast(message.text, message.tone)
      await refresh()
    })
  }, [toast, refresh])
  return null
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <StoreProvider>
          <CartProvider>
            <PaystackReturn />
            <Page />
          </CartProvider>
        </StoreProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}
