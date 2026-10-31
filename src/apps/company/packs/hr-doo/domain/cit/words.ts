import { language } from '../../../../../../shared/text/language'
import { plural } from '../../../../../../shared/text/translation'
import type { Translation } from '../../../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// Corporate income tax is porez na dobit, a line of the PD return redak obrasca PD, its monthly advance predujam and its balance due razlika za uplatu.

export const en = {
  /** The labels of the PD return's lines, which the build-ups name. */
  base: {
    profitBeforeTax: 'PD line 3, profit before tax',
    representation: 'PD line 6, representation',
    personalTransport: 'PD line 7, personal transport',
    nonDeductible: 'PD lines 9, 11 and 24, fines, forced collection and private costs',
    depreciationAbove: 'PD line 18, depreciation above the allowed rates and caps',
    relatedParty: 'PD lines 16 and 25, related-party interest below the prescribed rate',
    noRelatedParty: 'PD lines 16 and 25, no related-party interest: the rule reaches a resident owner only while the company has a tax loss',
    increases: 'PD line 26, increases',
    decreases: 'PD line 35, decreases: none recorded',
    beforeLosses: 'Tax base before losses brought forward',
    base: 'PD line 38, tax base',
    addedBack: (label: string, share: string) => `${label}, ${share} added back`,
    lossSetOff: (year: number) => `Loss of ${year} set off`,
    losses: 'PD line 37, losses brought forward',
  },
  liability: {
    rateTestRevenue: 'PD line 1 less line 28, with no grant for special circumstances on line 28',
    highRate: 'PD line 43, the rate for revenue at or above the threshold',
    lowRate: 'PD line 43, the rate for revenue below the threshold',
    tax: (rate: string) => `PD lines 44 and 53, tax at ${rate}`,
    noAdvances: 'PD line 56, no advances in a first tax period',
    monthlyAdvance: (months: number) => `PD line 59, the liability over the ${months} months of the period`,
    balanceDue: 'PD line 57, balance due',
    refund: 'PD line 58, overpaid',
    advancesPaid: (year: number) => `PD line 56, advances paid for ${year}`,
  },
  schedule: {
    advancesExpected: (year: number) => `Advances expected for ${year}`,
    advanceFor: (month: string) => `Advance for ${month}`,
    balanceDueFor: (year: number) => `Balance due for ${year}`,
    paid: (obligation: string) => `${obligation}, paid`,
    /** A day follows. */
    due: (obligation: string) => `${obligation}, due`,
  },
  filed: {
    liability: (year: number) => `PD line 53 for ${year}, as the accountant filed it`,
    balanceDue: (year: number) => `PD line 57 for ${year}, as the accountant filed it`,
    advance: (year: number) => `PD line 59 for ${year}, as the accountant filed it`,
  },
}

export const hr: Translation<typeof en> = {
  base: {
    profitBeforeTax: 'Redak 3 obrasca PD, dobit prije oporezivanja',
    representation: 'Redak 6 obrasca PD, reprezentacija',
    personalTransport: 'Redak 7 obrasca PD, osobni prijevoz',
    nonDeductible: 'Retci 9, 11 i 24 obrasca PD, kazne, prisilna naplata i privatni troškovi',
    depreciationAbove: 'Redak 18 obrasca PD, amortizacija iznad dopuštenih stopa i ograničenja',
    relatedParty: 'Retci 16 i 25 obrasca PD, kamata povezanih osoba ispod propisane stope',
    noRelatedParty: 'Retci 16 i 25 obrasca PD, nema kamate povezanih osoba: pravilo obuhvaća vlasnika rezidenta samo dok tvrtka ima porezni gubitak',
    increases: 'Redak 26 obrasca PD, uvećanja',
    decreases: 'Redak 35 obrasca PD, umanjenja: ništa nije zabilježeno',
    beforeLosses: 'Porezna osnovica prije prenesenih gubitaka',
    base: 'Redak 38 obrasca PD, porezna osnovica',
    addedBack: (label, share) => `${label}, uvećanje od ${share}`,
    lossSetOff: (year) => `Pokriven gubitak iz ${year}.`,
    losses: 'Redak 37 obrasca PD, preneseni gubici',
  },
  liability: {
    rateTestRevenue: 'Redak 1 obrasca PD umanjen za redak 28, bez potpore za posebne okolnosti u retku 28',
    highRate: 'Redak 43 obrasca PD, stopa za prihode na pragu ili iznad njega',
    lowRate: 'Redak 43 obrasca PD, stopa za prihode ispod praga',
    tax: (rate) => `Retci 44 i 53 obrasca PD, porez po stopi ${rate}`,
    noAdvances: 'Redak 56 obrasca PD, u prvom poreznom razdoblju nema predujmova',
    monthlyAdvance: (months) => `Redak 59 obrasca PD, obveza podijeljena na ${months} ${plural({ one: 'mjesec', few: 'mjeseca', other: 'mjeseci' }, months)} razdoblja`,
    balanceDue: 'Redak 57 obrasca PD, razlika za uplatu',
    refund: 'Redak 58 obrasca PD, preplata',
    advancesPaid: (year) => `Redak 56 obrasca PD, plaćeni predujmovi za ${year}.`,
  },
  schedule: {
    advancesExpected: (year) => `Očekivani predujmovi za ${year}.`,
    advanceFor: (month) => `Predujam za mjesec ${month}`,
    balanceDueFor: (year) => `Razlika za uplatu za ${year}.`,
    paid: (obligation) => `${obligation}, plaćeno`,
    due: (obligation) => `${obligation}, dospijeva`,
  },
  filed: {
    liability: (year) => `Redak 53 obrasca PD za ${year}., kako ga je prijavio knjigovođa`,
    balanceDue: (year) => `Redak 57 obrasca PD za ${year}., kako ga je prijavio knjigovođa`,
    advance: (year) => `Redak 59 obrasca PD za ${year}., kako ga je prijavio knjigovođa`,
  },
}

export const words = language === 'hr' ? hr : en
