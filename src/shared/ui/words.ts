import { language } from '../text/language'
import type { Translation } from '../text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.

export const en = {
  back: 'Back',
  about: (subject: string) => `About ${subject}`,
  sortBy: (column: string) => `Sort by ${column.toLowerCase()}`,
  showFewer: 'Show fewer',
  showAll: (total: number) => `Show all ${total}`,
  shownOf: (shown: number, total: number) => `${shown} of ${total} shown`,
  verdict: { unchanged: 'unchanged', better: 'better', worse: 'worse' },
  chart: {
    emptyTitle: 'Nothing to show for this period',
    emptyDescription: 'Pick a longer period or clear a filter.',
    loading: 'Loading',
    chart: 'Chart',
    table: 'Table',
    asTable: (title: string) => `Show ${title} as a table`,
    category: 'Category',
    openRows: (row: string, column: string) => `${row}, ${column}, open the rows`,
  },
  donut: {
    rows: 'the rows',
    open: (part: string, value: string, opens: string) => `${part}, ${value}, open ${opens}`,
  },
}

export const hr: Translation<typeof en> = {
  back: 'Natrag',
  about: (subject) => `Objašnjenje: ${subject}`,
  sortBy: (column) => `Poredaj po stupcu ${column}`,
  showFewer: 'Prikaži manje',
  showAll: (total) => `Prikaži sve (${total})`,
  shownOf: (shown, total) => `Prikazano ${shown} od ${total}`,
  verdict: { unchanged: 'bez promjene', better: 'bolje', worse: 'lošije' },
  chart: {
    emptyTitle: 'Za ovo razdoblje nema ništa za prikaz',
    emptyDescription: 'Odaberite dulje razdoblje ili uklonite filtar.',
    loading: 'Učitavanje',
    chart: 'Grafikon',
    table: 'Tablica',
    asTable: (title) => `${title}: prikaži kao tablicu`,
    category: 'Kategorija',
    openRows: (row, column) => `${row}, ${column}, otvori stavke`,
  },
  donut: {
    rows: 'stavke',
    open: (part, value, opens) => `${part}, ${value}, otvori ${opens}`,
  },
}

export const words = language === 'hr' ? hr : en
