import { ASSET_ROUTE, ASSETS_ASSISTANT_LINK, ASSETS_OVERVIEW_ROUTE, ASSETS_SETTINGS_ROUTE } from '../overview/presentation/assetLinks'
import { words as overviewWords } from '../overview/presentation/words'
import { words as settingsWords } from '../settings/presentation/words'
import { words as assetWords } from '../asset/presentation/words'
import * as assetKinds from '../workbook/domain/assetKinds'
import { ASSET_RECORDS } from '../workbook/domain/assetKinds'
import type { AppAssistant, AssistantPlace } from '../../../shared/app/appContribution'
import type { AppAcceptance, AppProposer } from '../../../shared/app/assistantOperations'
import { assetsReader } from './assetsReader'
import type { AssetsReading } from './assetsReader'
import { words } from './words'

/** Every Assets screen and tab, the tab first, since a person on a tab is on that tab and not on its screen. */
const PLACES: readonly AssistantPlace[] = [
  { route: ASSETS_ASSISTANT_LINK, title: settingsWords.tabs.assistant },
  { route: ASSETS_OVERVIEW_ROUTE, title: overviewWords.title },
  { route: ASSET_ROUTE, title: assetWords.asset, params: { asset: { kind: ASSET_RECORDS.name } } },
  { route: ASSETS_SETTINGS_ROUTE, title: settingsWords.title },
]

/**
 * What Assets tells the chat: what it keeps and where, what it can read, and the changes it takes, over the book and store
 * `app.ts` hands in. It has no settings table of its own, and no record of it names a person.
 */
export function assetsAssistant(reading: AssetsReading, changes: { readonly proposer: AppProposer; readonly acceptance: AppAcceptance } | null = null): AppAssistant {
  return {
    kinds: Object.values(assetKinds),
    places: PLACES,
    settings: [],
    guides: [{ id: 'set-up', title: words.guides.setUp.title, body: words.guides.setUp.body, places: [ASSETS_OVERVIEW_ROUTE] }],
    automations: [],
    setUp: [{ key: 'first-asset', about: 'The file has no asset yet.', operations: ['add-asset'] }],
    reader: assetsReader(reading),
    proposer: changes?.proposer ?? null,
    acceptance: changes?.acceptance ?? null,
    quickActions: [words.quickActions.worth, words.quickActions.valuation],
    persons: () => [],
  }
}
