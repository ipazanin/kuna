import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { firstDayOf, lastDayOf } from '../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import { monthLabel } from '../../../../shared/calendar/monthLabel'
import { capitalised } from '../../../../shared/text/capitalised'
import { language } from '../../../../shared/text/language'
import type { EnglishForms, Translation } from '../../../../shared/text/translation'
import { monthCase } from '../../../../shared/calendar/monthCase'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// A bank account is račun u banci, a ledger row stavka, the ledger evidencija and Kuna's own file datoteka. Net stays neto.
// Croatian leaves the currency's name out where it would have to be inflected, as in "every euro earned".

export const en = {
  title: 'Overview',
  description: 'How the company is doing, and what waits for you.',
  /** The newest complete month in one sentence, around its figures. */
  headline: { opening: ': ', between: ' came in and ', closing: ' went out', loss: ', a loss of ' },
  waiting: {
    title: 'Waiting for you',
    subtitle: 'Across the whole workbook, whatever the filters.',
    open: (job: string, page: string) => `${job}, open ${page}`,
    notFiled: (count: number): EnglishForms => ({ one: '1 statement was not filed', other: `${count} statements were not filed` }),
    folderUnread: 'The statements folder could not be read',
    toReview: (count: number): EnglishForms => ({ one: `${count} row waits for a category check`, other: `${count} rows wait for a category check` }),
    invoicesNotMade: (count: number, oldest: string): EnglishForms => ({
      one: `${count} invoice the billing plan expects is not made yet, the oldest for ${oldest}`,
      other: `${count} invoices the billing plan expects are not made yet, the oldest for ${oldest}`,
    }),
    thisMonthNotMade: (client: string) => `This month's invoice for ${client} is not made yet`,
    monthNotMade: (month: string, client: string) => `The ${month} invoice for ${client} is not made yet`,
    overdue: (count: number, owed: string): EnglishForms => ({
      one: `An invoice is past the due date, ${owed} still owed`,
      other: `${count} invoices are past the due date, ${owed} still owed`,
    }),
    links: { import: 'Import', review: 'To review', invoicing: 'Invoicing', invoices: 'Invoices' },
  },
  tiles: {
    cashOnHand: 'Cash on hand',
    sinceMonthEnd: (month: MonthKey) => `since the end of ${monthLabel(month)}`,
    cashDefinition: 'The closing balance of every account in view on its newest booking day, added together.',
    net: 'Net, last 12 months',
    perMonth: (amount: string, months: string) => `${amount} a month over ${months}`,
    netDefinition: (income: string, costs: string) =>
      `${income} less ${costs} over the last 12 months, the month so far included. The caption averages the 12 complete months before the month so far. Transfers and reimbursements are left out.`,
    monthlyCosts: 'Monthly costs',
    against12Months: 'vs the 12-month average',
    costsDefinition: (costs: string) => `${capitalised(costs)} over the last three complete months, divided by three.`,
    runway: 'Runway',
    noCosts: 'No costs',
    months: (text: string): EnglishForms => ({ one: `${text} months`, other: `${text} months` }),
    /** The 12-month runway in the caption, which English writes without its unit. */
    atYearCost: (text: string): EnglishForms => ({ one: `${text}`, other: `${text}` }),
    runwayCaption: (atYearCost: string) => `At the 3-month cost, ${atYearCost} at the 12-month cost`,
    runwayDefinition: 'Cash on hand divided by the monthly costs: how long the company runs if no more income arrives. The figure takes the last three complete months, the caption the last twelve.',
  },
  typicalMonth: {
    title: 'A typical month, three ways',
    subtitle: 'Each window ends with the last complete month. A wide spread means recent months are not like the rest.',
    last3: 'Last 3 months',
    last12: 'Last 12 months',
    allTime: (from: MonthKey) => `All time, since ${from}`,
    perMonth: 'Per month',
    last3Against12: 'Last 3 vs 12 months',
    scale: 'The change on a scale of minus to plus 50%',
    changeAgainst12: (change: string) => `${change} last 3 vs 12 months`,
    openRows: (line: string, column: string) => `${line}, ${column}, open the rows`,
  },
  monthly: {
    title: 'Income and costs by month',
    subtitle: 'Last 12 complete months and the month so far. Income above zero, costs below it. Click a month or a bar for its rows.',
    definition: (costs: string) => `Costs are ${costs}. The line is the average net of the three months up to each one, so it starts once three complete months exist.`,
  },
  balance: {
    title: 'Balance at month end',
    subtitle: 'Last 12 months and the month so far, each account stacked with the total on top',
  },
  euro: {
    title: (unit: string) => `Every ${unit} earned, last 12 months`,
    lossSubtitle: (unit: string) => `Costs ran above income, so the ring splits every ${unit} spent.`,
    subtitle: (unit: string) => `Where each ${unit} of income went.`,
    definition: (costs: string, unit: string) => `What is kept is income less ${costs}. In a loss nothing is kept, so the ring splits every ${unit} spent instead.`,
    kept: 'Kept',
    income: 'income',
    moreOutThanIn: 'more out than in',
    ofIncome: (unit: string, shares: string) => `Of every ${unit} earned in the last 12 months: ${shares}.`,
    ofCost: (shortfall: string, unit: string, shares: string) => `In the last 12 months costs exceeded income by ${shortfall}, so the ring splits every ${unit} spent: ${shares}.`,
  },
  accounts: {
    title: 'Accounts',
    subtitle: 'Each account at its newest balance',
    summary: (count: number): EnglishForms => ({ one: `${count} account`, other: `${count} accounts` }),
    closedCount: (count: number): EnglishForms => ({ one: `, ${count} closed`, other: `, ${count} closed` }),
    closed: 'Closed',
    asOf: (day: string, count: number, since: string): EnglishForms => ({ one: `As of ${day}. ${count} row since ${since}.`, other: `As of ${day}. ${count} rows since ${since}.` }),
    everyRow: (account: string) => `${account}, every row`,
  },
}

export const hr: Translation<typeof en> = {
  title: 'Pregled',
  description: 'Kako tvrtka posluje i što vas čeka.',
  headline: { opening: ': ušlo je ', between: ', a izašlo ', closing: '', loss: ', uz gubitak od ' },
  waiting: {
    title: 'Čeka vas',
    subtitle: 'U cijeloj datoteci, bez obzira na filtre.',
    open: (job, page) => `${job}, otvori ${page}`,
    notFiled: (count) => ({ one: `${count} izvod nije upisan`, few: `${count} izvoda nisu upisana`, other: `${count} izvoda nije upisano` }),
    folderUnread: 'Mapu izvoda nije moguće pročitati',
    toReview: (count) => ({
      one: `${count} stavka čeka provjeru kategorije`,
      few: `${count} stavke čekaju provjeru kategorije`,
      other: `${count} stavki čeka provjeru kategorije`,
    }),
    invoicesNotMade: (count, oldest) => ({
      one: `${count} račun iz plana naplate još nije izdan, najstariji za ${oldest}`,
      few: `${count} računa iz plana naplate još nisu izdana, najstariji za ${oldest}`,
      other: `${count} računa iz plana naplate još nije izdano, najstariji za ${oldest}`,
    }),
    thisMonthNotMade: (client) => `Ovomjesečni račun klijentu „${client}” još nije izdan`,
    monthNotMade: (month, client) => `Račun za ${monthCase(month, 'accusative')} klijentu „${client}” još nije izdan`,
    overdue: (count, owed) => ({
      one: `Rok plaćanja prošao je za ${count} račun, a duguje se još ${owed}`,
      few: `Rok plaćanja prošao je za ${count} računa, a duguje se još ${owed}`,
      other: `Rok plaćanja prošao je za ${count} računa, a duguje se još ${owed}`,
    }),
    links: { import: 'Uvoz', review: 'Za provjeru', invoicing: 'Računi', invoices: 'Računi' },
  },
  tiles: {
    cashOnHand: 'Novac na računima',
    sinceMonthEnd: (month) => `od ${dayLabel(lastDayOf(month))}`,
    cashDefinition: 'Zbroj završnih stanja svih prikazanih računa u banci, svakog na dan njegove najnovije knjižbe.',
    net: 'Neto, zadnjih 12 mjeseci',
    perMonth: (amount, months) => `${amount} mjesečno, ${months}`,
    netDefinition: (income, costs) =>
      `${income} minus ${costs} u zadnjih 12 mjeseci, uključujući tekući mjesec. Natpis ispod prosjek je 12 cijelih mjeseci prije tekućeg. Prijenosi i povrati troškova nisu uključeni.`,
    monthlyCosts: 'Mjesečni troškovi',
    against12Months: 'prema prosjeku 12 mjeseci',
    costsDefinition: (costs) => `${capitalised(costs)} u zadnja tri cijela mjeseca, podijeljeno s tri.`,
    runway: 'Novca dostaje za',
    noCosts: 'Nema troškova',
    months: (text) => ({ one: `${text} mjesec`, few: `${text} mjeseca`, other: `${text} mjeseci` }),
    atYearCost: (text) => ({ one: `${text} mjesec`, few: `${text} mjeseca`, other: `${text} mjeseci` }),
    runwayCaption: (atYearCost) => `Prema troškovima zadnja 3 mjeseca. Prema zadnjih 12 mjeseci: ${atYearCost}`,
    runwayDefinition:
      'Novac na računima podijeljen s mjesečnim troškovima: koliko dugo tvrtka može raditi ako ne stigne novi prihod. Brojka uzima zadnja tri cijela mjeseca, a natpis ispod zadnjih dvanaest.',
  },
  typicalMonth: {
    title: 'Tipičan mjesec, na tri načina',
    subtitle: 'Svako razdoblje završava zadnjim cijelim mjesecom. Velika razlika znači da se nedavni mjeseci razlikuju od ostalih.',
    last3: 'Zadnja 3 mjeseca',
    last12: 'Zadnjih 12 mjeseci',
    allTime: (from) => `Sve od ${dayLabel(firstDayOf(from))}`,
    perMonth: 'Mjesečno',
    last3Against12: 'Zadnja 3 prema 12 mjeseci',
    scale: 'Promjena na ljestvici od minus 50 % do plus 50 %',
    changeAgainst12: (change) => `${change} zadnja 3 prema 12 mjeseci`,
    openRows: (line, column) => `${line}, ${column}, otvori stavke`,
  },
  monthly: {
    title: 'Prihodi i troškovi po mjesecima',
    subtitle: 'Zadnjih 12 cijelih mjeseci i tekući mjesec. Prihodi iznad nule, troškovi ispod nje. Kliknite mjesec ili stupac za njegove stavke.',
    definition: (costs) => `Troškovi su ${costs}. Crta je prosječni neto triju mjeseci do svakog mjeseca, pa počinje kad postoje tri cijela mjeseca.`,
  },
  balance: {
    title: 'Stanje na kraju mjeseca',
    subtitle: 'Zadnjih 12 mjeseci i tekući mjesec, računi u banci naslagani, a ukupno stanje iznad njih',
  },
  euro: {
    title: () => 'Kamo ide prihod, zadnjih 12 mjeseci',
    lossSubtitle: () => 'Troškovi su bili veći od prihoda, pa prsten dijeli potrošeni novac.',
    subtitle: () => 'Na što je otišao prihod.',
    definition: (costs) => `Zadržano je prihod minus ${costs}. U gubitku ništa nije zadržano, pa prsten umjesto toga dijeli potrošeni novac.`,
    kept: 'Zadržano',
    income: 'prihod',
    moreOutThanIn: 'više izašlo nego ušlo',
    ofIncome: (_unit, shares) => `Prihod zadnjih 12 mjeseci: ${shares}.`,
    ofCost: (shortfall, _unit, shares) => `U zadnjih 12 mjeseci troškovi su premašili prihod za ${shortfall}, pa prsten dijeli troškove: ${shares}.`,
  },
  accounts: {
    title: 'Računi u banci',
    subtitle: 'Svaki račun s najnovijim stanjem',
    summary: (count) => ({ one: `${count} račun`, few: `${count} računa`, other: `${count} računa` }),
    closedCount: (count) => ({ one: `, ${count} zatvoren`, few: `, ${count} zatvorena`, other: `, ${count} zatvorenih` }),
    closed: 'Zatvoren',
    asOf: (day, count, since) => ({
      one: `Stanje na dan ${day}, ${count} stavka od ${since}`,
      few: `Stanje na dan ${day}, ${count} stavke od ${since}`,
      other: `Stanje na dan ${day}, ${count} stavki od ${since}`,
    }),
    everyRow: (account) => `${account}, sve stavke`,
  },
}

export const words = language === 'hr' ? hr : en
