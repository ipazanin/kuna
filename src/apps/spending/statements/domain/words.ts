import { language } from '../../../../shared/text/language'
import type { CroatianForms, EnglishForms, Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. A statement is izvod and an export izvoz. A column's name stays as the file writes it.

export const en = {
  noColumn: (column: string) => `The file has no ${column} column`,
  addToBringIn: (accounts: string) => `Add ${accounts} to bring in this file`,
  addToBringInSavings: (accounts: string) => `Add ${accounts} to bring in the savings rows left out`,
  revolutBankAccounts: (_count: number, currencies: string): EnglishForms => ({ one: `a Revolut bank account in ${currencies}`, other: `Revolut bank accounts in ${currencies}` }),
  revolutSavingsAccounts: (_count: number, currencies: string): EnglishForms => ({ one: `a Revolut savings account in ${currencies}`, other: `Revolut savings accounts in ${currencies}` }),
  notACurrency: (text: string) => `The file has rows in "${text}", which is not a currency code such as EUR or USD`,
  manyRevolutAccounts: (names: string, currency: string) => `More than one open Revolut account keeps ${currency}: ${names}. Close the one the file is not for`,
  notADay: (fileRow: number, text: string) => `Row ${fileRow} of the file starts on "${text}", which is not a date`,
  notAnAmount: (fileRow: number, text: string) => `Row ${fileRow} of the file holds "${text}", which is not an amount`,
  revolut: 'Revolut',
  feeOn: (description: string) => `Fee on ${description}`,
  otherStatesLeftOut: (count: number): EnglishForms => ({ one: '1 reverted or declined row left out.', other: `${count} reverted or declined rows left out.` }),
  savingsLeftOut: (count: number, currencies: string): EnglishForms => ({
    one: `1 savings row left out, since no Revolut savings account keeps ${currencies}.`,
    other: `${count} savings rows left out, since no Revolut savings account keeps ${currencies}.`,
  }),
  otherProductLeftOut: (count: number, product: string): EnglishForms => ({ one: `1 row of the product "${product}" left out.`, other: `${count} rows of the product "${product}" left out.` }),
  pocketsWaiting: (count: number): EnglishForms => ({
    one: '1 pocket move counts as a transfer and waits for a Revolut savings account.',
    other: `${count} pocket moves count as transfers and wait for a Revolut savings account.`,
  }),
  withdrawalsWaiting: (count: number): EnglishForms => ({
    one: '1 cash withdrawal counts as a transfer and waits on To review for its cash account.',
    other: `${count} cash withdrawals count as transfers and wait on To review for their cash account.`,
  }),
  balanceDiffers: (product: string, balance: string, worked: string) => `The export's last ${product} balance is ${balance}, but its rows add up to ${worked}, so a row may be missing.`,
  beforeOpeningLeftOut: (count: number): EnglishForms => ({ one: '1 row before its account opened left out.', other: `${count} rows before their accounts opened left out.` }),
  notTakenLeftOut: (count: number, account: string): EnglishForms => ({
    one: `1 row of ${account} left out, since it takes its rows from the bank link. Its settings can allow the bank's statement file.`,
    other: `${count} rows of ${account} left out, since it takes its rows from the bank link. Its settings can allow the bank's statement file.`,
  }),
  outsideDaysLeftOut: (count: number, from: string, to: string): EnglishForms => ({
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
  pendingBooked: (count: number): EnglishForms => ({
    one: '1 payment the bank had not booked is booked now and keeps how you filed it.',
    other: `${count} payments the bank had not booked are booked now and keep how you filed them.`,
  }),
  pendingGone: (count: number): EnglishForms => ({
    one: '1 payment the bank had not booked is gone, since the bank no longer lists it.',
    other: `${count} payments the bank had not booked are gone, since the bank no longer lists them.`,
  }),
  pendingLookAlikesWait: (count: number): EnglishForms => ({
    one: '1 payment the bank has not booked yet looks like a row Kuna has, so it is left out until it books.',
    other: `${count} payments the bank has not booked yet look like rows Kuna has, so they are left out until they book.`,
  }),
  doesNotTie: (opening: string, rows: string, reached: string, closing: string, gap: string) =>
    `The statement does not add up: the opening balance ${opening} and its rows ${rows} reach ${reached}, but the printed closing balance is ${closing}, ${gap} apart.`,
}

export const hr: Translation<typeof en> = {
  noColumn: (column) => `Datoteka nema stupac ${column}`,
  addToBringIn: (accounts) => `Dodaj ${accounts} za uvoz ove datoteke`,
  addToBringInSavings: (accounts) => `Dodaj ${accounts} za uvoz izostavljenih redaka štednje`,
  revolutBankAccounts: (_count, currencies): CroatianForms => ({
    one: `Revolutov bankovni račun u valuti ${currencies}`,
    few: `Revolutove bankovne račune u valutama ${currencies}`,
    other: `Revolutove bankovne račune u valutama ${currencies}`,
  }),
  revolutSavingsAccounts: (_count, currencies): CroatianForms => ({
    one: `Revolutov štedni račun u valuti ${currencies}`,
    few: `Revolutove štedne račune u valutama ${currencies}`,
    other: `Revolutove štedne račune u valutama ${currencies}`,
  }),
  notACurrency: (text) => `Datoteka ima retke u „${text}”, što nije oznaka valute kao EUR ili USD`,
  manyRevolutAccounts: (names, currency) => `Valutu ${currency} vodi više otvorenih Revolutovih računa: ${names}. Zatvorite onaj za koji datoteka nije`,
  notADay: (fileRow, text) => `Redak ${fileRow} datoteke počinje s „${text}”, što nije datum`,
  notAnAmount: (fileRow, text) => `Redak ${fileRow} datoteke sadrži „${text}”, što nije iznos`,
  revolut: 'Revolut',
  feeOn: (description) => `Naknada za ${description}`,
  otherStatesLeftOut: (count): CroatianForms => ({
    one: `Izostavljeno poništenih ili odbijenih transakcija: ${count}.`,
    few: `Izostavljeno poništenih ili odbijenih transakcija: ${count}.`,
    other: `Izostavljeno poništenih ili odbijenih transakcija: ${count}.`,
  }),
  savingsLeftOut: (count, currencies): CroatianForms => ({
    one: `Izostavljeno redaka štednje: ${count}, jer nijedan Revolutov štedni račun ne vodi valutu ${currencies}.`,
    few: `Izostavljeno redaka štednje: ${count}, jer nijedan Revolutov štedni račun ne vodi valutu ${currencies}.`,
    other: `Izostavljeno redaka štednje: ${count}, jer nijedan Revolutov štedni račun ne vodi valutu ${currencies}.`,
  }),
  otherProductLeftOut: (count, product): CroatianForms => ({
    one: `Izostavljeno redaka proizvoda „${product}”: ${count}.`,
    few: `Izostavljeno redaka proizvoda „${product}”: ${count}.`,
    other: `Izostavljeno redaka proizvoda „${product}”: ${count}.`,
  }),
  pocketsWaiting: (count): CroatianForms => ({
    one: `Prijenos u džep: ${count}. Broji se kao prijenos i čeka Revolutov štedni račun.`,
    few: `Prijenosa u džep: ${count}. Broje se kao prijenosi i čekaju Revolutov štedni račun.`,
    other: `Prijenosa u džep: ${count}. Broje se kao prijenosi i čekaju Revolutov štedni račun.`,
  }),
  withdrawalsWaiting: (count): CroatianForms => ({
    one: `Podizanje gotovine: ${count}. Broji se kao prijenos i na kartici Za pregled čeka račun gotovine.`,
    few: `Podizanja gotovine: ${count}. Broje se kao prijenosi i na kartici Za pregled čekaju račun gotovine.`,
    other: `Podizanja gotovine: ${count}. Broje se kao prijenosi i na kartici Za pregled čekaju račun gotovine.`,
  }),
  balanceDiffers: (product, balance, worked) => `Zadnje stanje izvoza za ${product} je ${balance}, a njegovi retci daju ${worked}, pa možda neki redak nedostaje.`,
  notTakenLeftOut: (count, account): CroatianForms => ({
    one: `Izostavljeno redaka računa ${account}: ${count}, jer retke dobiva iz veze s bankom. U njegovim postavkama možete dopustiti izvod banke.`,
    few: `Izostavljeno redaka računa ${account}: ${count}, jer retke dobiva iz veze s bankom. U njegovim postavkama možete dopustiti izvod banke.`,
    other: `Izostavljeno redaka računa ${account}: ${count}, jer retke dobiva iz veze s bankom. U njegovim postavkama možete dopustiti izvod banke.`,
  }),
  beforeOpeningLeftOut: (count): CroatianForms => ({
    one: `Izostavljeno redaka prije otvaranja računa: ${count}.`,
    few: `Izostavljeno redaka prije otvaranja računa: ${count}.`,
    other: `Izostavljeno redaka prije otvaranja računa: ${count}.`,
  }),
  outsideDaysLeftOut: (count, from, to): CroatianForms => ({
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
  pendingBooked: (count): CroatianForms => ({
    one: `${count} plaćanje koje banka još nije bila proknjižila sada je proknjiženo i ostaje razvrstano kako ste ga razvrstali.`,
    few: `${count} plaćanja koja banka još nije bila proknjižila sada su proknjižena i ostaju razvrstana kako ste ih razvrstali.`,
    other: `${count} plaćanja koja banka još nije bila proknjižila sada su proknjižena i ostaju razvrstana kako ste ih razvrstali.`,
  }),
  pendingGone: (count): CroatianForms => ({
    one: `${count} plaćanje koje banka još nije bila proknjižila uklonjeno je, jer ga banka više ne navodi.`,
    few: `${count} plaćanja koja banka još nije bila proknjižila uklonjena su, jer ih banka više ne navodi.`,
    other: `${count} plaćanja koja banka još nije bila proknjižila uklonjena su, jer ih banka više ne navodi.`,
  }),
  pendingLookAlikesWait: (count): CroatianForms => ({
    one: `${count} plaćanje koje banka još nije proknjižila nalikuje retku koji Kuna ima, pa je izostavljeno dok se ne proknjiži.`,
    few: `${count} plaćanja koja banka još nije proknjižila nalikuju recima koje Kuna ima, pa su izostavljena dok se ne proknjiže.`,
    other: `${count} plaćanja koja banka još nije proknjižila nalikuju recima koje Kuna ima, pa su izostavljena dok se ne proknjiže.`,
  }),
  doesNotTie: (opening, rows, reached, closing, gap) =>
    `Izvod se ne slaže: početno stanje ${opening} i njegovi retci ${rows} daju ${reached}, a ispisano završno stanje je ${closing}, razlika ${gap}.`,
}

export const words = language === 'hr' ? hr : en
