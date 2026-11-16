import { chatKept } from '../../shared/ai/presentation/chatSession'
import { chooseLanguage } from '../../shared/text/language'
import type { LanguageChoice } from '../../shared/text/language'

/** Loads Kuna again in the language picked, once the chat is kept in this browser, so its last turn survives the reload. */
export async function switchLanguage(choice: LanguageChoice): Promise<void> {
  await chatKept()
  chooseLanguage(choice)
}
