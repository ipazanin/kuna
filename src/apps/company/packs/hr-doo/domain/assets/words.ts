import type { CivilDate } from '../../../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../../../shared/calendar/dayLabel'
import { language } from '../../../../../../shared/text/language'
import { plural } from '../../../../../../shared/text/translation'
import type { Translation } from '../../../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// Long-term assets are dugotrajna imovina and one asset sredstvo, depreciation amortizacija and small inventory sitni inventar. A label that a day follows ends where the day is written.

export const en = {
  /** The labels of an asset's depreciation, which the build-ups name. */
  schedule: {
    cost: 'Cost without deductible VAT',
    depreciationIn: (year: number, months: number, rate: string) => `Depreciation in ${year}, ${months} ${months === 1 ? 'month' : 'months'} at ${rate}`,
    doubledRate: (rate: string) => `${rate}, the doubled rate`,
    accumulated: 'Accumulated depreciation on',
    notBought: 'Not bought yet, so no book value on',
    writtenOff: 'No book value after the write-off on',
    bookValue: 'Book value on',
    allAllowed: 'Depreciation the corporate tax allows, all of it',
    carCap: 'Car cost the corporate tax counts',
    inProportion: 'Depreciation the corporate tax allows, in proportion to the capped cost',
    smallInventory: 'Small inventory, written off when put in use',
    untilDisposal: 'Depreciation until disposal',
    disposal: 'Book value written off on disposal',
  },
  /** The labels of the asset books across years. */
  books: {
    depreciationIn: (year: number) => `Depreciation in ${year}`,
    aboveAllowed: 'Depreciation above what the tax allows',
    moreDepreciation: (year: number) => `More depreciation in ${year}`,
    moreGrant: (year: number) => `More grant released in ${year}`,
    atDoubled: 'at doubled rates',
    atWorkbookRates: 'at the rates the workbook asks for',
    profitChange: (year: number) => `Change in profit before tax for ${year}`,
    taxChange: (year: number, rate: string, high: boolean) => `Change in profit tax for ${year}, at ${rate}${high ? '' : ' for revenue below the threshold'}`,
    depreciationInBasis: (year: number, basis: string) => `Depreciation in ${year} ${basis}`,
    grantInBasis: (year: number, basis: string) => `Grant released in ${year} ${basis}`,
  },
  /** Why an asset claims no bank row it would otherwise claim. */
  unchecked: (byDate: boolean, day: CivilDate) =>
    `${byDate ? `the capital purchase of ${day} may pay for it` : `its ledger_reference finds the bank row of ${day}`}, but the app has no standard VAT rate for that day to check the amount against, so the row is left unclaimed`,
}

export const hr: Translation<typeof en> = {
  schedule: {
    cost: 'Nabavna vrijednost bez odbitnog PDV-a',
    depreciationIn: (year, months, rate) => `Amortizacija u ${year}., ${months} ${plural({ one: 'mjesec', few: 'mjeseca', other: 'mjeseci' }, months)} po stopi ${rate}`,
    doubledRate: (rate) => `${rate}, udvostručena stopa`,
    accumulated: 'Ispravak vrijednosti na dan',
    notBought: 'Još nije kupljeno, pa nema knjigovodstvenu vrijednost na dan',
    writtenOff: 'Nema knjigovodstvene vrijednosti nakon otpisa na dan',
    bookValue: 'Knjigovodstvena vrijednost na dan',
    allAllowed: 'Amortizacija koju porez na dobit priznaje, cijela',
    carCap: 'Trošak automobila koji porez na dobit priznaje',
    inProportion: 'Amortizacija koju porez na dobit priznaje, razmjerno ograničenom trošku',
    smallInventory: 'Sitni inventar, otpisan pri stavljanju u upotrebu',
    untilDisposal: 'Amortizacija do otuđenja',
    disposal: 'Knjigovodstvena vrijednost otpisana pri otuđenju',
  },
  books: {
    depreciationIn: (year) => `Amortizacija u ${year}.`,
    aboveAllowed: 'Amortizacija iznad onoga što porez priznaje',
    moreDepreciation: (year) => `Veća amortizacija u ${year}.`,
    moreGrant: (year) => `Više priznate potpore u ${year}.`,
    atDoubled: 'po udvostručenim stopama',
    atWorkbookRates: 'po stopama koje traži datoteka',
    profitChange: (year) => `Promjena dobiti prije oporezivanja za ${year}.`,
    taxChange: (year, rate, high) => `Promjena poreza na dobit za ${year}., po stopi ${rate}${high ? '' : ' za prihode ispod praga'}`,
    depreciationInBasis: (year, basis) => `Amortizacija u ${year}. ${basis}`,
    grantInBasis: (year, basis) => `Potpora priznata u ${year}. ${basis}`,
  },
  unchecked: (byDate, day) =>
    `${byDate ? `nabava dugotrajne imovine od ${dayLabel(day)} možda ga plaća` : `njegovo polje ledger_reference pronalazi bankovnu stavku od ${dayLabel(day)}`}, ali aplikacija za taj dan nema opću stopu PDV-a za provjeru iznosa, pa stavka ostaje nepovezana`,
}

export const words = language === 'hr' ? hr : en
