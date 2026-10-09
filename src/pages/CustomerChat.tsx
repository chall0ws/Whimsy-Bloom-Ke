import { ChatWidget } from '../components/chat/ChatWidget'
import { TeamPreviewBar } from '../components/TeamPreviewBar'

/** The page customers open from the "Chat with us" link in her bios. */
export function CustomerChat() {
  return (
    <div className="mx-auto flex h-[100dvh] max-w-md flex-col gap-3 px-4 py-4">
      <TeamPreviewBar back="#/inbox">Open the dashboard in another tab to answer.</TeamPreviewBar>
      <ChatWidget startedFrom="CHAT_LINK" className="min-h-0 flex-1" />
      <a href="#/portal" className="text-center text-xs font-medium text-ink-2 hover:text-ink">
        Have an account? Sign in to see your orders
      </a>
    </div>
  )
}
