import { ArrowLeft } from 'lucide-react'
import { ChatWidget } from '../components/chat/ChatWidget'

/** The page customers open from the "Chat with us" link in her bios. */
export function CustomerChat() {
  return (
    <div className="mx-auto flex h-[100dvh] max-w-md flex-col gap-3 px-4 py-4">
      <div className="flex items-center justify-between gap-3 rounded-xl bg-surface-2 px-3 py-2 text-xs text-ink-2">
        <span>
          <strong>Customer preview.</strong> Open the dashboard in another tab to answer.
        </span>
        <a href="#/inbox" className="inline-flex shrink-0 items-center gap-1 font-medium text-ink hover:underline">
          <ArrowLeft size={13} aria-hidden /> Dashboard
        </a>
      </div>
      <ChatWidget startedFrom="CHAT_LINK" className="flex-1" />
    </div>
  )
}
