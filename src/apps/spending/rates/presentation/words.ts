import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { language } from '../../../../shared/text/language'
import type { CroatianForms, EnglishForms, Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. The ECB is ESB in Croatian.

export const en = {
  atRate: (date: CivilDate) => `At the ECB rate of ${dayLabel(date)}`,
  loading: 'Waiting for the ECB rates',
  failed: 'The ECB rates did not load, so accounts in another currency show in their own currency',
  unrated: (count: number): EnglishForms => ({
    one: '1 entry in another currency is not counted: the ECB rates did not load',
    other: `${count} entries in another currency are not counted: the ECB rates did not load`,
  }),
}

export const hr: Translation<typeof en> = {
  atRate: (date) => `Po tečaju ESB-a od ${dayLabel(date)}`,
  loading: 'Čekaju se tečajevi ESB-a',
  failed: 'Tečajevi ESB-a nisu se učitali, pa se računi u drugoj valuti prikazuju u svojoj valuti',
  unrated: (count): CroatianForms => ({
    one: `${count} unos u drugoj valuti nije uračunat: tečajevi ESB-a nisu se učitali`,
    few: `${count} unosa u drugoj valuti nisu uračunata: tečajevi ESB-a nisu se učitali`,
    other: `${count} unosa u drugoj valuti nije uračunato: tečajevi ESB-a nisu se učitali`,
  }),
}

export const words = language === 'hr' ? hr : en
