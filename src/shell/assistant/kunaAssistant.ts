import { chatKept } from '../../shared/ai/presentation/chatSession'
import type { AppAssistant } from '../../shared/app/appContribution'
import { answerKunaStart, forgetKunaStart, kunaStart } from '../../shared/app/kunaStart'
import { autoSyncOn, switchAutoSync } from '../../shared/sync/infrastructure/autoSyncSwitch'
import { usePageSync } from '../../shared/sync/presentation/pageSync'
import { chooseLanguage, languageChoice } from '../../shared/text/language'
import { chooseTheme, themeChoice } from '../../shared/theme/theme'
import { foldedCards, rememberCollapse } from '../../shared/ui/cardCollapse'
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
  syncs: () => usePageSync().someOnDrive.value,
  async syncNow(asking) {
    const page = usePageSync()
    await page.sync(asking)
    const needing = (page.run.value?.groups ?? []).flatMap((group) =>
      group.steps.flatMap(({ label, state }) =>
        state.kind === 'failed' || state.kind === 'waits' || state.kind === 'needs-access'
          ? [{ text: `${group.name}, ${label}: ${/[.!?]$/.test(state.line) ? state.line : `${state.line}.`}`, link: 'link' in state ? state.link : null }]
          : [],
      ),
    )
    return needing.length === 0 ? null : { text: needing.map((step) => step.text).join(' '), link: needing.find((step) => step.link !== null)?.link ?? null }
  },
  foldedCards,
  foldCard: rememberCollapse,
}

/** What Kuna itself tells the chat: the settings of this device it may change, the page's sync, and the settings only the person changes on Kuna settings. */
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
      { key: 'sync_now', note: words.settings.syncNow },
      { key: 'folded_cards', note: words.settings.foldedCards },
      { key: 'ai_provider', note: words.settings.neverProvider, neverPropose: true },
      { key: 'anonymise', note: words.settings.neverAnonymise, neverPropose: true },
      { key: 'chat_history', note: words.settings.neverHistory, neverPropose: true },
      { key: 'google_sign_in', note: words.settings.neverGoogle, neverPropose: true },
    ],
    guides: [],
    automations: [],
    reader: null,
    proposer: kunaProposer(DEVICE),
    acceptance: kunaAcceptance(DEVICE),
    quickActions: [],
    persons: () => [],
    fileFormats: [],
  }
}
