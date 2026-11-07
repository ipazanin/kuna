import { language } from '../../../shared/text/language'
import type { Translation } from '../../../shared/text/translation'

/** The words on the screens a guide names, passed in so a guide calls each thing what the screen calls it. */
export interface GuideLabels {
  readonly transactions: string
  readonly review: string
  readonly suggest: string
  readonly recategorise: string
  readonly makeRule: string
  readonly settings: string
  readonly categoryRules: string
}

export const en = {
  guides: {
    review: {
      title: 'Sort the rows waiting for review',
      body: (labels: GuideLabels) =>
        [
          `Rows no rule decides wait on ${labels.transactions}, ${labels.review}. Open one to see its counterparty, description, amount and what the rules say about it.`,
          `1. To have the AI suggest categories, press ${labels.suggest} on that tab. It shows what goes before anything is sent. Each row then shows its suggestion with a button that applies it.`,
          `2. Or pick one yourself with ${labels.recategorise} on the row.`,
          `3. The toast after a recategorise offers ${labels.makeRule}, so the same kind of row is sorted on its own next time. Every rule is listed on ${labels.settings}, ${labels.categoryRules}.`,
        ].join('\n'),
    },
  },
}

export const hr: Translation<typeof en> = {
  guides: {
    review: {
      title: 'Razvrstajte retke koji čekaju provjeru',
      body: (labels) =>
        [
          `Retci koje nijedno pravilo ne razvrsta čekaju na zaslonu ${labels.transactions}, na kartici ${labels.review}. Otvorite redak da vidite partnera, opis, iznos i što pravila kažu o njemu.`,
          `1. Da vam AI predloži kategorije, pritisnite ${labels.suggest} na toj kartici. Prije slanja pokaže što se šalje. Svaki redak tada pokaže prijedlog s gumbom koji ga primijeni.`,
          `2. Ili sami odaberite kategoriju gumbom ${labels.recategorise} na retku.`,
          `3. Poruka nakon promjene kategorije nudi ${labels.makeRule}, pa se ista vrsta retka sljedeći put razvrsta sama. Sva pravila navedena su na zaslonu ${labels.settings}, na kartici ${labels.categoryRules}.`,
        ].join('\n'),
    },
  },
}

export const words = language === 'hr' ? hr : en
