import { dayLabel } from '../../../../shared/calendar/dayLabel'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import type { Money } from '../../../../shared/money/money'
import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Račun is both an account and a receipt, so a receipt is fiskalni račun wherever both could be meant.

export const en = {
  difference: 'Difference',
  linesOff: (lines: Money, total: Money) => `The lines add up to ${formatMoney(lines)}, the receipt says ${formatMoney(total)}`,
  qrTotal: (total: Money) => `The QR code says ${formatMoney(total)}, the read says otherwise. The QR total is used.`,
  qrIssued: (date: CivilDate, time: string) => `The QR code says ${dayLabel(date)} at ${time}, the read says otherwise. The QR's is used.`,
  lineOff: (line: string, worked: Money, printed: Money) => `${line}: quantity times price gives ${formatMoney(worked)}, the line says ${formatMoney(printed)}`,
  vatOff: (table: Money, total: Money) => `The VAT table gives ${formatMoney(table)}, the receipt says ${formatMoney(total)}`,
  merchantOib: "The merchant's OIB check digit is wrong",
  buyerOib: "The buyer's OIB check digit is wrong",
  noCompanyOib: 'The receipt names a buyer, and Kuna has no company OIB on this device to compare it with. Set the OIB in Company.',
  setOibInCompany: 'Set the OIB in Company',
  timeUnread: (text: string) => `The read gave the time as ${text}, which is left out`,
  discountAboveZero: (line: string) => `${line} is a discount, but its amount reads as a cost`,
  noAmount: (line: string) => `${line} has no amount, so it is left out`,
  noTotal: 'The read gave no total above zero',
  noDate: 'The read gave no date',
  unreadable: (part: string) => `Could not read: ${part}`,
}

export const hr: Translation<typeof en> = {
  difference: 'Razlika',
  linesOff: (lines, total) => `Stavke daju ${formatMoney(lines)}, a na računu piše ${formatMoney(total)}`,
  qrTotal: (total) => `QR kod kaže ${formatMoney(total)}, a čitanje drukčije. Koristi se iznos iz QR koda.`,
  qrIssued: (date, time) => `QR kod kaže ${dayLabel(date)} u ${time}, a čitanje drukčije. Koristi se onaj iz QR koda.`,
  lineOff: (line, worked, printed) => `${line}: količina puta cijena daje ${formatMoney(worked)}, a na stavci piše ${formatMoney(printed)}`,
  vatOff: (table, total) => `Tablica PDV-a daje ${formatMoney(table)}, a na računu piše ${formatMoney(total)}`,
  merchantOib: 'Kontrolna znamenka OIB-a trgovca nije ispravna',
  buyerOib: 'Kontrolna znamenka OIB-a kupca nije ispravna',
  noCompanyOib: 'Fiskalni račun navodi kupca, a Kuna na ovom uređaju nema OIB tvrtke s kojim bi ga usporedila. Upišite OIB u Tvrtki.',
  setOibInCompany: 'Upiši OIB u Tvrtki',
  timeUnread: (text) => `Čitanje navodi vrijeme ${text}, koje je izostavljeno`,
  discountAboveZero: (line) => `${line} je popust, ali se iznos čita kao trošak`,
  noAmount: (line) => `${line} nema iznos, pa je izostavljena`,
  noTotal: 'Čitanje nije dalo ukupan iznos veći od nule',
  noDate: 'Čitanje nije dalo datum',
  unreadable: (part) => `Nije pročitano: ${part}`,
}

export const words = language === 'hr' ? hr : en
