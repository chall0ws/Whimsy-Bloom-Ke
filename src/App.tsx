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
import { OrderForm } from './pages/OrderForm'
import { Orders } from './pages/Orders'
import { Overview } from './pages/Overview'
import { Portal } from './pages/portal/Portal'
import { Settings } from './pages/Settings'
import { useRoute } from './router'
import { StoreProvider } from './state/store'
import { applyTheme, readTheme } from './theme'

function Page() {
  const route = useRoute()
  const customerPage = route.page === 'chat' || route.page === 'order-form' || route.page === 'portal'

  // Customer pages always wear the brand look; the dashboard follows the team member's choice.
  useEffect(() => applyTheme(customerPage ? 'light' : readTheme()), [customerPage])

  // Customer-facing pages: open to everyone, no dashboard around them.
  if (customerPage) {
    return (
      <>
        {route.page === 'chat' && <CustomerChat />}
        {route.page === 'order-form' && <OrderForm />}
        {route.page === 'portal' && <Portal tab={route.tab} />}
        <Toasts />
      </>
    )
  }

  // Everything else is the dashboard, for signed-in team members only.
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
        <Page />
      </StoreProvider>
    </AuthProvider>
  )
}
