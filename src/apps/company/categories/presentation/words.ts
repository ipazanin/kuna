import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Dodaj, Odbaci, Vrati.

export const en = {
  /**
   * The card of the categories the pack cannot count one way yet, or not as new books count them, and of the starting categories
   * the books lack, on Settings, General and in an import's summary, with the suggestions dismissed.
   */
  categoriesToSort: {
    title: 'Categories to sort',
    help: 'Each line names a category that may not count the way you mean, or one that new books start with and yours lack, and what to do about it.',
    toSort: 'To sort',
    missingTag: 'Missing',
    dismissedTag: 'Dismissed',
    add: 'Add',
    addNamed: (name: string) => `Add ${name} and its rules`,
    added: (name: string) => `Added ${name}`,
    notAdded: 'Not added',
    dismiss: 'Dismiss',
    dismissNamed: (name: string) => `Dismiss the suggestion for ${name}`,
    dismissedToast: (name: string) => `Suggestion for ${name} dismissed`,
    notDismissed: 'Not dismissed',
    dismissed: 'You dismissed the suggestion.',
    dismissedOn: (day: string) => `You dismissed the suggestion on ${day}.`,
    restore: 'Restore',
    restoreNamed: (name: string) => `Restore the suggestion for ${name}`,
    restored: 'Suggestion restored',
    notRestored: 'Not restored',
  },
}

export const hr: Translation<typeof en> = {
  categoriesToSort: {
    title: 'Kategorije za razvrstavanje',
    help: 'Svaki redak navodi kategoriju koja se možda ne broji kako želite ili kategoriju s kojom nove datoteke počinju, a vašima nedostaje, te što s njom učiniti.',
    toSort: 'Za razvrstavanje',
    missingTag: 'Nedostaje',
    dismissedTag: 'Odbačeno',
    add: 'Dodaj',
    addNamed: (name) => `Dodaj ${name} i njezina pravila`,
    added: (name) => `Dodano: ${name}`,
    notAdded: 'Nije dodano',
    dismiss: 'Odbaci',
    dismissNamed: (name) => `Odbaci prijedlog za ${name}`,
    dismissedToast: (name) => `Prijedlog za ${name} je odbačen`,
    notDismissed: 'Nije odbačeno',
    dismissed: 'Odbacili ste prijedlog.',
    dismissedOn: (day) => `Dana ${day} odbacili ste prijedlog.`,
    restore: 'Vrati',
    restoreNamed: (name) => `Vrati prijedlog za ${name}`,
    restored: 'Prijedlog je vraćen',
    notRestored: 'Nije vraćeno',
  },
}

export const words = language === 'hr' ? hr : en
