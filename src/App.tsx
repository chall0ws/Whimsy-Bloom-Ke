import { useEffect } from 'react'
import { AuthProvider } from './auth/AuthProvider'
import { StaffGate } from './auth/StaffGate'
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
import { isAdminRoute, useRoute } from './router'
import { AccountPage } from './shop/Account'
import { Catalog, Home, ProductPage } from './shop/Browse'
import { CartProvider } from './shop/cart'
import { CartPage, Checkout, Thanks } from './shop/Checkout'
import { ShopLayout } from './shop/ShopLayout'
import { StoreProvider } from './state/store'
import { applyTheme, readTheme } from './theme'

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
          {route.page === 'home' && <Home />}
          {route.page === 'shop' && <Catalog />}
          {route.page === 'product' && <ProductPage productId={route.productId} />}
          {route.page === 'cart' && <CartPage />}
          {route.page === 'checkout' && <Checkout />}
          {route.page === 'thanks' && <Thanks orderId={route.orderId} />}
          {route.page === 'account' && <AccountPage tab={route.tab} />}
          {route.page === 'chat' && <CustomerChat />}
        </ShopLayout>
        <Toasts />
      </>
    )
  }

  // The dashboard, under #/admin, for signed-in team members only.
  return (
    <StaffGate>
      <Layout route={route}>
        {route.page === 'overview' && <Overview />}
        {route.page === 'orders' && <Orders />}
        {route.page === 'inbox' && <Inbox threadId={route.threadId} />}
        {route.page === 'customers' && <Customers customerId={route.customerId} />}
        {route.page === 'inventory' && <Inventory />}
        {route.page === 'fees' && <Fees />}
        {route.page === 'settings' && <Settings />}
        <OrderDrawer />
      </Layout>
      <Toasts />
    </StaffGate>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <StoreProvider>
        <CartProvider>
          <Page />
        </CartProvider>
      </StoreProvider>
    </AuthProvider>
  )
}
