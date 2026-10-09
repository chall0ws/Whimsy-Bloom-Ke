import { useEffect, useState } from 'react'

export type Route =
  | { page: 'overview' }
  | { page: 'orders' }
  | { page: 'inbox'; threadId?: string }
  | { page: 'customers'; customerId?: string }
  | { page: 'inventory' }
  | { page: 'fees' }
  | { page: 'settings' }
  | { page: 'order-form' }
  | { page: 'chat' }
  | { page: 'portal'; tab?: PortalTab }

export type PortalTab = 'orders' | 'new' | 'chat' | 'profile'

export function parseHash(hash: string): Route {
  const [page, id] = hash.replace(/^#\/?/, '').split('/')
  switch (page) {
    case 'orders':
    case 'inventory':
    case 'fees':
    case 'settings':
    case 'order-form':
    case 'chat':
      return { page }
    case 'inbox':
      return { page, threadId: id || undefined }
    case 'customers':
      return { page, customerId: id || undefined }
    case 'portal':
      return { page, tab: (['orders', 'new', 'chat', 'profile'] as const).find((t) => t === id) }
    default:
      return { page: 'overview' }
  }
}

export function href(route: Route): string {
  switch (route.page) {
    case 'overview':
      return '#/'
    case 'inbox':
      return route.threadId ? `#/inbox/${route.threadId}` : '#/inbox'
    case 'customers':
      return route.customerId ? `#/customers/${route.customerId}` : '#/customers'
    case 'portal':
      return route.tab ? `#/portal/${route.tab}` : '#/portal'
    default:
      return `#/${route.page}`
  }
}

export function navigate(route: Route) {
  window.location.hash = href(route)
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash))
  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}
