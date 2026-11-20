import { language } from '../../../../shared/text/language'
import type { CroatianForms, EnglishForms, Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. A statement is izvod and an export izvoz. A column's name stays as the file writes it.

export const en = {
  feeOn: (description: string) => `Fee on ${description}`,
  pocketsWaiting: (count: number): EnglishForms => ({
    one: '1 pocket move counts as a transfer and waits for a Revolut savings account.',
    other: `${count} pocket moves count as transfers and wait for a Revolut savings account.`,
  }),
  withdrawalsWaiting: (count: number): EnglishForms => ({
    one: '1 cash withdrawal counts as a transfer and waits on To review for its cash account.',
    other: `${count} cash withdrawals count as transfers and wait on To review for their cash account.`,
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
  feeOn: (description) => `Naknada za ${description}`,
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
