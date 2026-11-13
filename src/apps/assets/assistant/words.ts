import { language } from '../../../shared/text/language'
import type { Translation } from '../../../shared/text/translation'

// Croatian addresses the reader as vi. Something you own is imovina, one thing of it a stavka imovine, and what it was worth on a day a procjena.

export const en = {
  guides: {
    setUp: {
      title: 'Set up Assets with the chat',
      body: [
        "Set up Loans first, so the bank loan an asset was bought with can be named. Have ready the purchase contract, a car's registration document, and any valuation report. A PDF or photo goes to the AI provider whole.",
        'The cards, in this order:',
        "1. Each asset as add-asset: its kind, the day bought and the price paid as the contract prints them, a home's region for the house price index, a car's first registration from its registration document, and the name of the bank loan Loans lists for it.",
        '2. Each valuation report or bank appraisal as add-valuation, on the day it states.',
        'Ask the person, and never work out: what an asset is worth with no report, which loan paid for it when no document says, and a region the address does not make plain.',
      ].join('\n'),
    },
  },
  quickActions: {
    worth: { label: 'What are my assets worth?', prompt: 'What are my assets worth today, how was each value reached, and what is mine after the bank loans on them?' },
    valuation: { label: 'Add a valuation', prompt: 'I have a new valuation for one of my assets. Which asset has the oldest one?' },
  },
  reads: {
    asset: 'Something you own: a flat or house, a car, or anything else, with what you paid and the bank loan on it.',
    valuation: 'What an asset was worth on a day, as you typed it, such as a bank appraisal or your own guess.',
    loanGone: 'a bank loan that Loans no longer lists',
    loanUnknown: 'a bank loan of Loans, which cannot be read now',
    loanNotSetUp: 'a bank loan, but Loans is not set up',
  },
  reports: {
    worth: {
      title: 'what the assets are worth',
      about: 'What the assets are worth together on a day, and each one by its kind and purchase day with how its value was reached, the bank loan on it and what is yours after the loan.',
    },
  },
}

export const hr: Translation<typeof en> = {
  guides: {
    setUp: {
      title: 'Postavi Imovinu kroz razgovor',
      body: [
        'Najprije postavite Kredite, da se može navesti kredit kojim je imovina kupljena. Pripremite kupoprodajni ugovor, prometnu dozvolu automobila i svaku procjenu. PDF ili fotografija šalje se pružatelju umjetne inteligencije cijela.',
        'Kartice, ovim redom:',
        '1. Svaku stavku imovine kao add-asset: vrstu, dan kupnje i plaćenu cijenu kako ih ugovor ispisuje, područje stana ili kuće za indeks cijena stambenih objekata, prvu registraciju automobila iz prometne dozvole i naziv kredita pod kojim ga Krediti vode.',
        '2. Svaki izvještaj o procjeni ili procjenu banke kao add-valuation, na dan koji navodi.',
        'Pitajte osobu i nikad ne izračunavajte: koliko imovina vrijedi bez procjene, kojim je kreditom plaćena kad to nijedan dokument ne kaže i područje koje adresa ne odaje.',
      ].join('\n'),
    },
  },
  quickActions: {
    worth: { label: 'Koliko vrijedi moja imovina?', prompt: 'Koliko danas vrijedi moja imovina, kako je došlo do svake vrijednosti i što je moje nakon kredita na njoj?' },
    valuation: { label: 'Dodaj procjenu', prompt: 'Imam novu procjenu za jednu od svojih stavki imovine. Koja ima najstariju?' },
  },
  reads: {
    asset: 'Nešto što posjedujete: stan ili kuća, automobil ili bilo što drugo, s plaćenom cijenom i kreditom na tome.',
    valuation: 'Koliko je stavka imovine vrijedila na neki dan, kako ste unijeli, na primjer procjena banke ili vaša vlastita.',
    loanGone: 'kredit kojeg Krediti više ne navode',
    loanUnknown: 'kredit iz Kredita koji se sada ne može pročitati',
    loanNotSetUp: 'kredit, ali Krediti nisu postavljeni',
  },
  reports: {
    worth: {
      title: 'koliko vrijedi imovina',
      about: 'Koliko imovina vrijedi zajedno na dan, i svaka stavka po vrsti i danu kupnje, uz način na koji je došlo do vrijednosti, kredit na njoj i što je vaše nakon kredita.',
    },
  },
}

export const words = language === 'hr' ? hr : en
