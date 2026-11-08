import { language } from '../../../../../shared/text/language'
import type { Translation } from '../../../../../shared/text/translation'

export const en = {
  reads: {
    ownerAdvance: 'Costs the owner paid privately for the company, which the company owes back.',
    planLine: "The owner's plan for a year: a category's monthly amount, a dividend, a purchase, or the owner pay scenario from a day.",
    scenarioComponent: "One part of an owner pay scenario for a year: the salary, a tax-free item, rent, a dividend or the director's basis.",
    yearEndLine: "A figure from the accountant's year-end package.",
    asset: 'A purchase kept as a fixed asset and depreciated.',
    grant: 'A grant the company received, with its terms.',
    employee: 'A person the company pays a salary, with the facts the payroll needs.',
  },
  reports: {
    forecast: {
      title: 'the year forecast',
      about:
        "How the year is likely to end, as the Year screen's Forecast shows it: revenue, each profit and loss line, profit, the corporate tax with its rate and advances, profit after tax, what can be paid out as a dividend, and the cash at year end. Any month of the year names it. A year the accountant has closed has none. It holds owner pay, so it stays on this device while Anonymise is on and the company has an employee.",
    },
    taxes: {
      title: "the year's taxes",
      about:
        "Each tax category paid over a year, net of refunds, as the Year screen's Taxes shows them, and the client revenue. The taxes on pay and the net taxes that hold them are left out. Any month of the year names it.",
    },
  },
}

export const hr: Translation<typeof en> = {
  reads: {
    ownerAdvance: 'Troškovi koje je vlasnik platio privatno za tvrtku, a tvrtka mu ih duguje.',
    planLine: 'Vlasnikov plan za godinu: mjesečni iznos kategorije, dividenda, kupnja ili scenarij plaće vlasnika od nekog dana.',
    scenarioComponent: 'Jedan dio scenarija plaće vlasnika za godinu: plaća, neoporezivi primitak, najam, dividenda ili osnovica direktora.',
    yearEndLine: 'Iznos iz knjigovođina paketa za kraj godine.',
    asset: 'Kupnja koja se vodi kao dugotrajna imovina i amortizira.',
    grant: 'Potpora koju je tvrtka primila, s njezinim uvjetima.',
    employee: 'Osoba kojoj tvrtka isplaćuje plaću, s podacima koji trebaju za obračun.',
  },
  reports: {
    forecast: {
      title: 'prognoza godine',
      about:
        'Kako će godina vjerojatno završiti, kako je prikazuje Prognoza na zaslonu Godina: prihodi, svaka stavka računa dobiti i gubitka, dobit, porez na dobit sa stopom i predujmovima, dobit nakon poreza, koliko se može isplatiti kao dividenda i novac na kraju godine. Imenuje je bilo koji mjesec te godine. Godina koju je knjigovođa zatvorio nema je. Sadrži plaću vlasnika, pa ostaje na ovom uređaju dok je uključena anonimizacija i tvrtka ima zaposlenika.',
    },
    taxes: {
      title: 'porezi godine',
      about:
        'Svaka porezna kategorija plaćena tijekom godine, umanjena za povrate, kako ih prikazuju Porezi na zaslonu Godina, i prihod od klijenata. Porezi na plaću i neto porezi koji ih sadrže nisu uključeni. Imenuje je bilo koji mjesec te godine.',
    },
  },
}

export const words = language === 'hr' ? hr : en
