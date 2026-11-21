import { language } from '../../../../shared/text/language'
import type { CroatianForms, EnglishForms, Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. A statement is izvod and an export izvoz. A column's name stays as the file writes it.
// These word what a reader made of a statement file or of the bank sync's answer: why it read nothing, and what it left out or noticed.

export const en = {
  refused: {
    noColumn: (column: string) => `The file has no ${column} column`,
    notADay: (line: number, text: string) => `Row ${line} of the file starts on "${text}", which is not a date`,
    notAnAmount: (line: number, text: string) => `Row ${line} of the file holds "${text}", which is not an amount`,
    notReadable: (line: number, column: string, text: string) => `Row ${line} of the file holds "${text}" in its ${column} column, which cannot be read`,
    noKind: (line: number) => `Row ${line} of the file is no kind of row the recipe knows`,
    notACurrency: (line: number, text: string) => `Row ${line} of the file is in "${text}", which is not a currency code such as EUR or USD`,
    manyAccounts: (bank: string, names: string, currency: string) => `More than one open ${bank} account keeps ${currency}: ${names}. Close the one the file is not for`,
    noRecipe: (misses: string) => `No recipe reads this file: ${misses}`,
    recipeMiss: (recipe: string, column: string) => `${recipe} needs a ${column} column`,
    addToBringIn: (accounts: string) => `Add ${accounts} to bring in this file`,
    addToBringInSavings: (accounts: string) => `Add ${accounts} to bring in the savings rows left out`,
    bankAccounts: (_count: number, bank: string, currencies: string): EnglishForms => ({ one: `a ${bank} bank account in ${currencies}`, other: `${bank} bank accounts in ${currencies}` }),
    savingsAccounts: (_count: number, bank: string, currencies: string): EnglishForms => ({ one: `a ${bank} savings account in ${currencies}`, other: `${bank} savings accounts in ${currencies}` }),
  },
  notes: {
    notCompleted: (count: number): EnglishForms => ({ one: '1 reverted or declined row left out.', other: `${count} reverted or declined rows left out.` }),
    savingsLeftOut: (count: number, currencies: string): EnglishForms => ({
      one: `1 savings row left out, since no Revolut savings account keeps ${currencies}.`,
      other: `${count} savings rows left out, since no Revolut savings account keeps ${currencies}.`,
    }),
    otherProduct: (count: number, product: string): EnglishForms => ({ one: `1 row of the product "${product}" left out.`, other: `${count} rows of the product "${product}" left out.` }),
    products: { current: 'Current', savings: 'Savings' },
    balanceDiffers: (product: string, balance: string, worked: string) => `The export's last ${product} balance is ${balance}, but its rows add up to ${worked}, so a row may be missing.`,
    zeroLeftOut: (count: number, account: string): EnglishForms => ({ one: `1 row of ${account} without an amount left out.`, other: `${count} rows of ${account} without an amount left out.` }),
    otherCurrencyLeftOut: (count: number, currency: string): EnglishForms => ({
      one: `1 row in ${currency} left out, since no account keeps ${currency}.`,
      other: `${count} rows in ${currency} left out, since no account keeps ${currency}.`,
    }),
    unreadableLeftOut: (count: number, account: string): EnglishForms => ({
      one: `1 row of ${account} left out, since its day or amount cannot be read.`,
      other: `${count} rows of ${account} left out, since their day or amount cannot be read.`,
    }),
    balanceNotRead: (accounts: string, reason: string) => `The balance of ${accounts} was not checked, since the bank did not give it: ${reason}`,
  },
  leftOut: {
    beforeOpening: (count: number, account: string, day: string): EnglishForms => ({
      one: `1 row of ${account} left out, since it is dated before the account opened on ${day}.`,
      other: `${count} rows of ${account} left out, since they are dated before the account opened on ${day}.`,
    }),
    notTaken: (count: number, account: string): EnglishForms => ({
      one: `1 row of ${account} left out, since it takes its rows from the bank link.`,
      other: `${count} rows of ${account} left out, since it takes its rows from the bank link.`,
    }),
    outsideDays: (count: number, from: string, to: string): EnglishForms => ({
      one: `1 row left out, since the file brings only the days from ${from} to ${to}.`,
      other: `${count} rows left out, since the file brings only the days from ${from} to ${to}.`,
    }),
    coveredByFile: (count: number, account: string, day: string): EnglishForms => ({
      one: `1 row of ${account} left out, since a file covers the days up to ${day}.`,
      other: `${count} rows of ${account} left out, since a file covers the days up to ${day}.`,
    }),
    coveredBySync: (count: number, account: string, day: string): EnglishForms => ({
      one: `1 row of ${account} left out, since the bank sync covers the days from ${day}.`,
      other: `${count} rows of ${account} left out, since the bank sync covers the days from ${day}.`,
    }),
  },
}

export const hr: Translation<typeof en> = {
  refused: {
    noColumn: (column) => `Datoteka nema stupac „${column}”`,
    notADay: (line, text) => `Redak ${line} datoteke počinje s „${text}”, što nije datum`,
    notAnAmount: (line, text) => `Redak ${line} datoteke sadrži „${text}”, što nije iznos`,
    notReadable: (line, column, text) => `Redak ${line} datoteke u stupcu ${column} sadrži „${text}”, što se ne može pročitati`,
    noKind: (line) => `Redak ${line} datoteke nije nijedna vrsta retka koju recept poznaje`,
    notACurrency: (line, text) => `Redak ${line} datoteke je u „${text}”, što nije oznaka valute kao EUR ili USD`,
    manyAccounts: (bank, names, currency) => `Valutu ${currency} vodi više otvorenih računa banke ${bank}: ${names}. Zatvorite onaj za koji datoteka nije`,
    noRecipe: (misses) => `Nijedan recept ne čita ovu datoteku: ${misses}`,
    recipeMiss: (recipe, column) => `${recipe} traži stupac „${column}”`,
    addToBringIn: (accounts) => `Dodaj ${accounts} za uvoz ove datoteke`,
    addToBringInSavings: (accounts) => `Dodaj ${accounts} za uvoz izostavljenih redaka štednje`,
    bankAccounts: (_count, bank, currencies): CroatianForms => ({
      one: `bankovni račun banke ${bank} u valuti ${currencies}`,
      few: `bankovne račune banke ${bank} u valutama ${currencies}`,
      other: `bankovne račune banke ${bank} u valutama ${currencies}`,
    }),
    savingsAccounts: (_count, bank, currencies): CroatianForms => ({
      one: `štedni račun banke ${bank} u valuti ${currencies}`,
      few: `štedne račune banke ${bank} u valutama ${currencies}`,
      other: `štedne račune banke ${bank} u valutama ${currencies}`,
    }),
  },
  notes: {
    notCompleted: (count): CroatianForms => ({
      one: `Izostavljeno poništenih ili odbijenih transakcija: ${count}.`,
      few: `Izostavljeno poništenih ili odbijenih transakcija: ${count}.`,
      other: `Izostavljeno poništenih ili odbijenih transakcija: ${count}.`,
    }),
    savingsLeftOut: (count, currencies): CroatianForms => ({
      one: `Izostavljeno redaka štednje: ${count}, jer nijedan Revolutov štedni račun ne vodi valutu ${currencies}.`,
      few: `Izostavljeno redaka štednje: ${count}, jer nijedan Revolutov štedni račun ne vodi valutu ${currencies}.`,
      other: `Izostavljeno redaka štednje: ${count}, jer nijedan Revolutov štedni račun ne vodi valutu ${currencies}.`,
    }),
    otherProduct: (count, product): CroatianForms => ({
      one: `Izostavljeno redaka proizvoda „${product}”: ${count}.`,
      few: `Izostavljeno redaka proizvoda „${product}”: ${count}.`,
      other: `Izostavljeno redaka proizvoda „${product}”: ${count}.`,
    }),
    products: { current: 'Current', savings: 'Savings' },
    balanceDiffers: (product, balance, worked) => `Zadnje stanje izvoza za ${product} je ${balance}, a njegovi retci daju ${worked}, pa možda neki redak nedostaje.`,
    zeroLeftOut: (count, account): CroatianForms => ({
      one: `Izostavljeno redaka računa ${account} bez iznosa: ${count}.`,
      few: `Izostavljeno redaka računa ${account} bez iznosa: ${count}.`,
      other: `Izostavljeno redaka računa ${account} bez iznosa: ${count}.`,
    }),
    otherCurrencyLeftOut: (count, currency): CroatianForms => ({
      one: `Izostavljeno redaka u valuti ${currency}: ${count}. Nijedan račun ne vodi tu valutu.`,
      few: `Izostavljeno redaka u valuti ${currency}: ${count}. Nijedan račun ne vodi tu valutu.`,
      other: `Izostavljeno redaka u valuti ${currency}: ${count}. Nijedan račun ne vodi tu valutu.`,
    }),
    unreadableLeftOut: (count, account): CroatianForms => ({
      one: `Izostavljeno redaka računa ${account} kojima se ne mogu pročitati dan ili iznos: ${count}.`,
      few: `Izostavljeno redaka računa ${account} kojima se ne mogu pročitati dan ili iznos: ${count}.`,
      other: `Izostavljeno redaka računa ${account} kojima se ne mogu pročitati dan ili iznos: ${count}.`,
    }),
    balanceNotRead: (accounts, reason) => `Stanje računa ${accounts} nije provjereno jer ga banka nije dala: ${reason}`,
  },
  // A Croatian day label ends with its own full stop, so a sentence that ends on a day takes no other.
  leftOut: {
    beforeOpening: (count, account, day): CroatianForms => ({
      one: `Izostavljeno redaka računa ${account}: ${count}, jer je prije otvaranja računa ${day}`,
      few: `Izostavljeno redaka računa ${account}: ${count}, jer su prije otvaranja računa ${day}`,
      other: `Izostavljeno redaka računa ${account}: ${count}, jer su prije otvaranja računa ${day}`,
    }),
    notTaken: (count, account): CroatianForms => ({
      one: `Izostavljeno redaka računa ${account}: ${count}, jer retke dobiva iz veze s bankom.`,
      few: `Izostavljeno redaka računa ${account}: ${count}, jer retke dobiva iz veze s bankom.`,
      other: `Izostavljeno redaka računa ${account}: ${count}, jer retke dobiva iz veze s bankom.`,
    }),
    outsideDays: (count, from, to): CroatianForms => ({
      one: `Izostavljeno redaka: ${count}, jer datoteka donosi samo dane od ${from} do ${to}`,
      few: `Izostavljeno redaka: ${count}, jer datoteka donosi samo dane od ${from} do ${to}`,
      other: `Izostavljeno redaka: ${count}, jer datoteka donosi samo dane od ${from} do ${to}`,
    }),
    coveredByFile: (count, account, day): CroatianForms => ({
      one: `Izostavljeno redaka računa ${account}: ${count}, jer datoteka pokriva dane do ${day}`,
      few: `Izostavljeno redaka računa ${account}: ${count}, jer datoteka pokriva dane do ${day}`,
      other: `Izostavljeno redaka računa ${account}: ${count}, jer datoteka pokriva dane do ${day}`,
    }),
    coveredBySync: (count, account, day): CroatianForms => ({
      one: `Izostavljeno redaka računa ${account}: ${count}, jer sinkronizacija s bankom pokriva dane od ${day}`,
      few: `Izostavljeno redaka računa ${account}: ${count}, jer sinkronizacija s bankom pokriva dane od ${day}`,
      other: `Izostavljeno redaka računa ${account}: ${count}, jer sinkronizacija s bankom pokriva dane od ${day}`,
    }),
  },
}

export const words = language === 'hr' ? hr : en
