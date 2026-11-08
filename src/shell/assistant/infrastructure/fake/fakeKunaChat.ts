import { KUNA_CHAT } from '../../kunaChat'
import { answered, lookup, registerFakeChat } from '../../../../shared/ai/infrastructure/fake/fakeChatReply'
import type { FakeChatTurn } from '../../../../shared/ai/infrastructure/fake/fakeChatReply'
import type { ModelReply } from '../../../../shared/ai/application/modelPort'
import { language } from '../../../../shared/text/language'

const ANSWERS = {
  en: {
    themeTitle: 'Dark look',
    theme: 'The card turns Kuna dark on this device. Undo brings the look back.',
  },
  hr: {
    themeTitle: 'Tamni izgled',
    theme: 'Kartica na ovom uređaju prebacuje Kunu na tamni izgled. Poništi vraća prijašnji izgled.',
  },
}

/** Asked for a dark look, the fake chat proposes Kuna's theme on a card. */
function themeReply({ request, tokens, typed, lookups }: FakeChatTurn): ModelReply | null {
  if (!/dark|tamn/i.test(typed)) return null
  const says = ANSWERS[language === 'hr' ? 'hr' : 'en']
  if (lookups === 0) return lookup(lookups, 'propose_changes', { app: KUNA_CHAT.id, title: says.themeTitle, steps: [{ op: 'set-theme', input: JSON.stringify({ theme: 'dark' }), as: null }] }, tokens)
  return answered(request, says.theme, tokens)
}

/** Lets the fake chat change Kuna's own settings of this device. */
export function registerFakeKunaChat(): void {
  registerFakeChat(themeReply)
}
