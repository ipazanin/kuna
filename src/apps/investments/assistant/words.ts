import { language } from '../../../shared/text/language'
import type { Translation } from '../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. IBKR's report is izvješće, and the Investments app is Ulaganja.

/** The words on the screens an automation names, passed in so it calls each thing what the screen calls it. */
export interface AutomationLabels {
  readonly settings: string
  readonly general: string
  readonly mail: string
}

export const en = {
  automations: {
    ibkrMail: {
      title: 'IBKR report from mail',
      what: (labels: AutomationLabels) =>
        `Each sync reads IBKR's daily Activity Flex report from Gmail, so trades, dividends, tax withheld, conversions and fees reach Investments with no upload. New records wait for a review with one tap to accept. It is set up on ${labels.settings}, ${labels.general}, on the ${labels.mail} card.`,
    },
  },
}

export const hr: Translation<typeof en> = {
  automations: {
    ibkrMail: {
      title: 'Izvješće IBKR-a iz pošte',
      what: (labels) =>
        `Svaka sinkronizacija iz Gmaila čita IBKR-ovo dnevno izvješće Activity Flex, pa transakcije, dividende, obustavljeni porez, konverzije i naknade stižu u Ulaganja bez učitavanja. Novi zapisi čekaju pregled s prihvaćanjem jednim dodirom. Postavlja se na zaslonu ${labels.settings}, na kartici ${labels.general}, u kartici ${labels.mail}.`,
    },
  },
}

export const words = language === 'hr' ? hr : en
