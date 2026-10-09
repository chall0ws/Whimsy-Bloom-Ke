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
import { Settings } from './pages/Settings'
import { useRoute } from './router'
import { StoreProvider } from './state/store'

function Page() {
  const route = useRoute()
  // The customer chat is a customer-facing page, so it has no dashboard around it.
  if (route.page === 'chat') {
    return (
      <>
        <CustomerChat />
        <Toasts />
      </>
    )
  }
  return (
    <Layout route={route}>
      {route.page === 'overview' && <Overview />}
      {route.page === 'orders' && <Orders />}
      {route.page === 'inbox' && <Inbox threadId={route.threadId} />}
      {route.page === 'customers' && <Customers customerId={route.customerId} />}
      {route.page === 'inventory' && <Inventory />}
      {route.page === 'fees' && <Fees />}
      {route.page === 'settings' && <Settings />}
      {route.page === 'order-form' && <OrderForm />}
      <OrderDrawer />
      <Toasts />
    </Layout>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <Page />
    </StoreProvider>
  )
}
