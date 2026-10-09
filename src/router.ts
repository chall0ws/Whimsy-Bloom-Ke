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

export function parseHash(hash: string): Route {
  const [page, id] = hash.replace(/^#\/?/, '').split('/')
  switch (page) {
    case 'orders':
    case 'inventory':
    case 'fees':
    case 'settings':
    case 'order-form':
      return { page }
    case 'inbox':
      return { page, threadId: id || undefined }
    case 'customers':
      return { page, customerId: id || undefined }
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
