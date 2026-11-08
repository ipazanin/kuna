import { COMPANY_FACT_SETTINGS } from '../domain/companyFacts'
import * as hrDooKinds from '../domain/hrDooKinds'
import type { AppAssistant } from '../../../../../shared/app/appContribution'

/** What the Croatian d.o.o. pack adds to what Company tells the chat. */
export const HR_DOO_ASSISTANT: Pick<AppAssistant, 'kinds' | 'settings'> = {
  kinds: Object.values(hrDooKinds),
  settings: COMPANY_FACT_SETTINGS.definitions.map(({ key, note }) => ({ key, note })),
}
