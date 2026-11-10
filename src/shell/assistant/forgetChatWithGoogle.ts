import { forgetWithGoogleSignIn } from '../../shared/google/googleAuth'

/**
 * Starts the chat over, as New chat does, whenever Kuna forgets the Google sign-in, so the next person at this browser finds no chat,
 * alias list or saved copy of it. The chat loads only then, so it stays out of the first load.
 */
export function forgetChatWithGoogle(): void {
  forgetWithGoogleSignIn(() => {
    void import('../../shared/ai/presentation/chatSession').then(({ clearChat }) => clearChat())
  })
}
