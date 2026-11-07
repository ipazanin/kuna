import type { AppAssist, AssistTaskSummary } from '../../../../shared/app/appContribution'
import { shownPack } from '../../packs/packContribution'
import { useSettings } from '../../settings/application/useSettings'
import { ASSISTANT_SETTINGS_LINK } from '../../settings/presentation/settingsTabs'
import { SUGGEST_CATEGORIES } from '../application/suggestCategories'
import { words } from './words'

/** What suggesting categories sends, for the Assistant tab and the dialog that asks first. */
export const SUGGEST_CATEGORIES_SUMMARY: AssistTaskSummary = {
  id: SUGGEST_CATEGORIES,
  title: words.suggest.title,
  sends: words.suggest.sends,
}

const settings = useSettings()

/** What Company's assistant may do, with a task of the pack while the pack shows. */
export const COMPANY_ASSIST: AppAssist = {
  settings: ASSISTANT_SETTINGS_LINK,
  tasks: () => [SUGGEST_CATEGORIES_SUMMARY, ...shownPack(settings.value).assist],
}
