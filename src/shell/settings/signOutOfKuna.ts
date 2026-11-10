import { clearChat } from '../../shared/ai/presentation/chatSession'
import { signOutOfGoogle } from '../../shared/google/googleAuth'

/** Signs out of Google and starts the chat over, as New chat does, so the next person at this browser finds no chat, alias list or saved copy of it. */
export async function signOutAndForgetChat(): Promise<void> {
  clearChat()
  await signOutOfGoogle()
}
