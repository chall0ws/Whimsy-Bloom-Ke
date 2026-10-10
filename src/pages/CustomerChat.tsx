import { ChatWidget } from '../components/chat/ChatWidget'
import { useCustomer } from '../shop/ShopLayout'

/** The page customers open from the "Chat with us" link in her bios and the shop menu. */
export function CustomerChat() {
  const customer = useCustomer()
  const identity = customer?.phone ? { customerId: customer.id, name: customer.name, phone: customer.phone } : undefined
  return (
    <div className="mx-auto flex h-[calc(100dvh-220px)] min-h-[480px] max-w-md flex-col">
      <ChatWidget startedFrom={identity ? 'PORTAL' : 'CHAT_LINK'} identity={identity} className="min-h-0 flex-1 !shadow-card" />
    </div>
  )
}
