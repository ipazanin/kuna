import type { MonthKey } from '../../../../../../shared/calendar/monthKey'
import { monthLabel } from '../../../../../../shared/calendar/monthLabel'
import { language } from '../../../../../../shared/text/language'
import type { Translation } from '../../../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// A grant is potpora, counted as income priznata, and what waits odgođena. A label that a day follows ends where the day is written.

export const en = {
  /** The labels of a grant's release, which the build-ups name. */
  release: {
    releasedIn: (year: number) => `Grant released in ${year}`,
    releasedByPolicy: (year: number) => `Released in ${year} by our policy`,
    deferredByPolicy: (year: number) => `Deferred at the end of ${year} by our policy`,
    notReceived: 'Nothing received yet',
    periodEnded: 'Nothing, the grant period ended on',
    fixedPart: 'Fixed part, on receipt',
    assetCosts: (asset: string) => `${asset}, depreciation and write-offs`,
    beyondVariable: 'Beyond the variable part, not released',
    neverReleased: 'Variable part beyond what the funded assets cost',
    wholeSpread: (days: number, total: number) => `Whole grant, spread over ${days} of the period's ${total} days`,
    nothingNever: 'Nothing, the whole grant is spread over its period',
    notReceivedDeferred: 'Not received yet, so nothing deferred on',
    received: 'Grant received',
    releasedBy: 'Released by',
    deferredOn: 'Grant deferred on',
    depreciationIn: (month: MonthKey) => `Depreciation in ${month}`,
    wholeClawback: (year: 'first' | 'second') => `The whole grant, if a condition breaks in the ${year} year`,
    clawback: (year: 'first' | 'second') => `Clawback if a condition breaks in the ${year} year`,
    notExplained: 'Not explained by our policy',
  },
}

export const hr: Translation<typeof en> = {
  release: {
    releasedIn: (year) => `Potpora priznata u ${year}.`,
    releasedByPolicy: (year) => `Priznato u ${year}. prema računovodstvenoj politici`,
    deferredByPolicy: (year) => `Odgođeno na kraju ${year}. prema računovodstvenoj politici`,
    notReceived: 'Još ništa nije primljeno',
    periodEnded: 'Ništa, razdoblje potpore završilo je',
    fixedPart: 'Fiksni dio, pri primitku',
    assetCosts: (asset) => `${asset}, amortizacija i otpisi`,
    beyondVariable: 'Iznad varijabilnog dijela, nije priznato',
    neverReleased: 'Varijabilni dio iznad troška financiranih sredstava',
    wholeSpread: (days, total) => `Cijela potpora, raspoređena na ${days} od ${total} dana razdoblja`,
    nothingNever: 'Ništa, cijela potpora raspoređena je kroz svoje razdoblje',
    notReceivedDeferred: 'Još nije primljeno, pa ništa nije odgođeno na dan',
    received: 'Primljena potpora',
    releasedBy: 'Priznato do',
    deferredOn: 'Potpora odgođena na dan',
    depreciationIn: (month) => `Amortizacija, ${monthLabel(month)}`,
    wholeClawback: (year) => `Cijela potpora, ako se uvjet prekrši u ${year === 'first' ? 'prvoj' : 'drugoj'} godini`,
    clawback: (year) => `Povrat ako se uvjet prekrši u ${year === 'first' ? 'prvoj' : 'drugoj'} godini`,
    notExplained: 'Nije objašnjeno našom računovodstvenom politikom',
  },
}

export const words = language === 'hr' ? hr : en
