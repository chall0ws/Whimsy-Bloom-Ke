import { useEffect, useState } from 'react'

export type AccountTab = 'orders' | 'chat' | 'profile'

/** Pages customers see. The shop is the front door; nobody has to sign in to browse. */
export type ShopRoute =
  | { page: 'home' }
  | { page: 'shop' }
  | { page: 'product'; productId: string }
  | { page: 'cart' }
  | { page: 'checkout' }
  | { page: 'thanks'; orderId: string }
  | { page: 'account'; tab?: AccountTab }
  | { page: 'chat' }

/** The team dashboard, under #/admin. */
export type AdminRoute =
  | { page: 'overview' }
  | { page: 'orders' }
  | { page: 'inbox'; threadId?: string }
  | { page: 'customers'; customerId?: string }
  | { page: 'inventory' }
  | { page: 'fees' }
  | { page: 'settings' }

export type Route = ShopRoute | AdminRoute

const ADMIN_PAGES = ['overview', 'orders', 'inbox', 'customers', 'inventory', 'fees', 'settings'] as const

export function isAdminRoute(route: Route): route is AdminRoute {
  return (ADMIN_PAGES as readonly string[]).includes(route.page)
}

export function parseHash(hash: string): Route {
  const [first, second, third] = hash.replace(/^#\/?/, '').split('/')
  if (first === 'admin') {
    switch (second) {
      case 'orders':
      case 'inventory':
      case 'fees':
      case 'settings':
        return { page: second }
      case 'inbox':
        return { page: 'inbox', threadId: third || undefined }
      case 'customers':
        return { page: 'customers', customerId: third || undefined }
      default:
        return { page: 'overview' }
    }
  }
  switch (first) {
    case 'shop':
      return second ? { page: 'product', productId: second } : { page: 'shop' }
    case 'cart':
    case 'checkout':
    case 'chat':
      return { page: first }
    case 'thanks':
      return second ? { page: 'thanks', orderId: second } : { page: 'home' }
    // "portal" was the client portal's old address.
    case 'account':
    case 'portal':
      return { page: 'account', tab: (['orders', 'chat', 'profile'] as const).find((t) => t === second) }
    // The old stand-alone order form is now the shop.
    case 'order-form':
      return { page: 'shop' }
    default:
      return { page: 'home' }
  }
}

export function href(route: Route): string {
  switch (route.page) {
    case 'home':
      return '#/'
    case 'shop':
      return '#/shop'
    case 'product':
      return `#/shop/${route.productId}`
    case 'thanks':
      return `#/thanks/${route.orderId}`
    case 'account':
      return route.tab ? `#/account/${route.tab}` : '#/account'
    case 'cart':
    case 'checkout':
    case 'chat':
      return `#/${route.page}`
    case 'overview':
      return '#/admin'
    case 'inbox':
      return route.threadId ? `#/admin/inbox/${route.threadId}` : '#/admin/inbox'
    case 'customers':
      return route.customerId ? `#/admin/customers/${route.customerId}` : '#/admin/customers'
    default:
      return `#/admin/${route.page}`
  }
}

export function navigate(route: Route) {
  window.location.hash = href(route)
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash))
  useEffect(() => {
    const onChange = () => {
      setRoute(parseHash(window.location.hash))
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}
