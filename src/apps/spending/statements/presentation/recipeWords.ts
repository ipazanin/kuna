import type { StatementKind } from '../domain/recipeStatement'
import type { StatementRecipeField, StatementRecipeProblem } from '../domain/statementRecipeDraft'
import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. A recipe is recept, a column stupac and a row redak.

export const en = {
  fields: { started: 'Day', amount: 'Amount', debit: 'Money out', credit: 'Money in', description: 'Payee', fee: 'Fee', currency: 'Row currency' } satisfies Record<StatementRecipeField, string>,
  kinds: {
    payment: 'Booked rows',
    pending: 'Rows the bank has not booked',
    exchange: 'Exchanges',
    'cash-withdrawal': 'Cash taken out',
    'other-product': 'Rows of another product, counted',
    'not-completed': 'Declined or reverted rows, counted',
  } satisfies Record<StatementKind, string>,
  dialog: {
    addTitle: 'New statement recipe',
    changeTitle: 'Statement recipe',
    description: "How Import reads a bank's statement file, column by column.",
    save: 'Save recipe',
    cancel: 'Cancel',
    delete: 'Delete',
    saved: 'Recipe saved',
    notSaved: 'Not saved',
    deleted: 'Recipe deleted',
    notDeleted: 'Not deleted',
  },
  import: {
    write: 'Write a recipe',
    edit: (recipe: string) => `Edit ${recipe}`,
    askWrite: 'Ask the chat to write one',
    askFix: 'Ask the chat to fix it',
    writeTask: (said: string) => `Write a recipe for the attached file, so Import reads it. Import says: ${said}`,
    fixTask: (recipe: string, said: string) => `Fix the recipe ${recipe} so it reads the attached file. Import says: ${said}`,
  },
  problems: {
    'no-name': 'Give the recipe a name.',
    'no-date': 'Pick the column of the day.',
    'no-format': 'Pick how the day is written.',
    'no-amount': 'Pick the amount column, or both the money out and money in columns.',
    'no-kind': 'Add a kind of row.',
    'nothing-comes-in': 'At least one kind brings rows in, such as booked rows.',
    'unknown-kind': 'Pick a kind of row from the list.',
    'test-no-column': 'Pick the column this kind tests.',
    'test-no-value': 'Type a value this kind looks for.',
    'doubled-column': 'Two fields read the same column. Pick a column of its own for each.',
    'no-bank': 'Give the bank whose accounts take the rows.',
    'no-currency': "Pick the currency, or the column that holds each row's currency.",
    unreadable: 'Kuna cannot keep the recipe as written. Check its columns and kinds.',
  } satisfies Record<StatementRecipeProblem['kind'], string>,
}

export const hr: Translation<typeof en> = {
  fields: { started: 'Dan', amount: 'Iznos', debit: 'Isplata', credit: 'Uplata', description: 'Primatelj', fee: 'Naknada', currency: 'Valuta retka' },
  kinds: {
    payment: 'Knjiženi retci',
    pending: 'Retci koje banka još nije knjižila',
    exchange: 'Mjenjačnice',
    'cash-withdrawal': 'Podignuta gotovina',
    'other-product': 'Retci drugog proizvoda, prebrojeni',
    'not-completed': 'Odbijeni ili stornirani retci, prebrojeni',
  },
  dialog: {
    addTitle: 'Novi recept za izvode',
    changeTitle: 'Recept za izvode',
    description: 'Kako Uvoz čita datoteku izvoda banke, stupac po stupac.',
    save: 'Spremi recept',
    cancel: 'Odustani',
    delete: 'Obriši',
    saved: 'Recept je spremljen',
    notSaved: 'Nije spremljeno',
    deleted: 'Recept je obrisan',
    notDeleted: 'Nije obrisano',
  },
  import: {
    write: 'Napiši recept',
    edit: (recipe) => `Uredi ${recipe}`,
    askWrite: 'Zamoli chat da ga napiše',
    askFix: 'Zamoli chat da ga popravi',
    writeTask: (said) => `Napiši recept za priloženu datoteku, da je Uvoz pročita. Uvoz kaže: ${said}`,
    fixTask: (recipe, said) => `Popravi recept ${recipe} da pročita priloženu datoteku. Uvoz kaže: ${said}`,
  },
  problems: {
    'no-name': 'Dajte receptu naziv.',
    'no-date': 'Odaberite stupac dana.',
    'no-format': 'Odaberite kako je dan zapisan.',
    'no-amount': 'Odaberite stupac iznosa ili oba stupca, isplate i uplate.',
    'no-kind': 'Dodajte vrstu retka.',
    'nothing-comes-in': 'Barem jedna vrsta donosi retke, primjerice knjiženi retci.',
    'unknown-kind': 'Odaberite vrstu retka s popisa.',
    'test-no-column': 'Odaberite stupac koji ova vrsta provjerava.',
    'test-no-value': 'Upišite vrijednost koju ova vrsta traži.',
    'doubled-column': 'Dva polja čitaju isti stupac. Za svako odaberite vlastiti stupac.',
    'no-bank': 'Upišite banku čiji računi primaju retke.',
    'no-currency': 'Odaberite valutu ili stupac s valutom svakog retka.',
    unreadable: 'Kuna ne može spremiti recept ovako zapisan. Provjerite stupce i vrste.',
  },
}

export const words = language === 'hr' ? hr : en
