import type { AppAssist } from '../../../../shared/app/appContribution'
import { ASSISTANT_SETTINGS_LINK } from './settingsTabs'

/** Where Company's assistant switch is. Company asks the chat from its pages and runs no task of its own. */
export const COMPANY_ASSIST: AppAssist = { settings: ASSISTANT_SETTINGS_LINK, tasks: () => [] }
