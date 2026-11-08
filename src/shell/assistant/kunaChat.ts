import type { KunaChat } from '../../shared/ai/presentation/chatApps'
import { KUNA_SETTINGS_SCREEN, NET_WORTH_SCREEN } from '../routing/screens'
import { words } from './words'

/** Kuna itself in the chat: Net worth and Kuna settings, and the settings of this device. Its assistant loads only once a chat starts. */
export const KUNA_CHAT: KunaChat = {
  id: 'kuna',
  name: 'Kuna',
  purpose: words.purpose,
  screens: [NET_WORTH_SCREEN, KUNA_SETTINGS_SCREEN].map(({ path, title }) => ({ path, title })),
  assistant: () => import('./kunaAssistant').then(({ kunaAssistant }) => kunaAssistant()),
}
