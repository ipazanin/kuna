import { chatKept } from '../../shared/ai/presentation/chatSession'
import type { AppAssistant } from '../../shared/app/appContribution'
import { answerKunaStart, forgetKunaStart, kunaStart } from '../../shared/app/kunaStart'
import { autoSyncOn, switchAutoSync } from '../../shared/sync/infrastructure/autoSyncSwitch'
import { chooseLanguage, languageChoice } from '../../shared/text/language'
import { chooseTheme, themeChoice } from '../../shared/theme/theme'
import { installedApps } from '../routing/appRegistry'
import { kunaAcceptance, kunaProposer } from './kunaOperations'
import type { KunaDevice } from './kunaOperations'
import { words } from './words'

const DEVICE: KunaDevice = {
  theme: () => themeChoice.value,
  chooseTheme,
  language: () => languageChoice,
  // The card settles once Accept returns, so the reload waits a turn for that and then for the chat's save.
  chooseLanguage: (choice) => setTimeout(() => void chatKept().then(() => chooseLanguage(choice)), 0),
  autoSync: () => autoSyncOn.value,
  switchAutoSync,
  start: kunaStart,
  answerStart: answerKunaStart,
  forgetStart: forgetKunaStart,
  apps: () => installedApps().map(({ id, name }) => ({ id, name })),
}

/** What Kuna itself tells the chat: the settings of this device it may change, and those only the person changes on Kuna settings. */
export function kunaAssistant(): AppAssistant {
  return {
    kinds: [],
    places: [],
    settings: [
      { key: 'theme', note: words.settings.theme },
      { key: 'language', note: words.settings.language },
      { key: 'auto_sync', note: words.settings.autoSync },
      { key: 'apps_in_use', note: words.settings.apps },
      { key: 'files_home', note: words.settings.filesHome },
      { key: 'ai_provider', note: words.settings.neverProvider, neverPropose: true },
      { key: 'anonymise', note: words.settings.neverAnonymise, neverPropose: true },
      { key: 'chat_history', note: words.settings.neverHistory, neverPropose: true },
      { key: 'sync_now', note: words.settings.neverSync, neverPropose: true },
      { key: 'google_sign_in', note: words.settings.neverGoogle, neverPropose: true },
    ],
    guides: [],
    automations: [],
    reader: null,
    proposer: kunaProposer(DEVICE),
    acceptance: kunaAcceptance(DEVICE),
    quickActions: [],
    persons: () => [],
  }
}
