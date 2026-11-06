import { language } from '../../text/language'
import type { Translation } from '../../text/translation'
import type { ProviderId } from '../infrastructure/providerPresets'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.

export const en = {
  card: {
    title: 'Assistant',
    subtitle: 'Your own AI key, the model it runs and the apps that may use it. Each app stays off until you switch it on. Your keys stay in this browser while no file of yours is on Drive.',
    subtitleOnDrive:
      'Your own AI key, the model it runs and the apps that may use it. Each app stays off until you switch it on. Each sync saves your keys to your Google account, hidden from Drive, so every browser you sign in to gets them.',
    key: (provider: string) => `Key for ${provider}`,
    model: 'Model',
    defaultModel: (model: string) => `${model} (default)`,
    typedModel: {
      anthropic: 'Kuna knows no price for this model, so its runs say price unknown.',
      openai: 'Kuna knows no price for this model, so its runs say price unknown.',
      openrouter: 'OpenRouter reports what each run cost, and Kuna shows that. A typed model may search the web on its own side, which Kuna cannot see.',
    } satisfies Record<ProviderId, string>,
    searchesWeb: 'This model id turns on web search, which Kuna keeps off, so runs stay on the default model.',
    use: 'Use this provider',
    inUse: 'In use',
    getKey: 'Get a key',
    refused: (provider: string) => `${provider} refused the key.`,
    testFailed: (reason: string) => `The test did not finish: ${reason}`,
    apps: 'Apps',
  },
  retention: {
    anthropic: 'Anthropic deletes what Kuna sends within 30 days and does not train on it.',
    openai: 'OpenAI keeps what Kuna sends up to 30 days for abuse checks and does not train on it.',
    openrouter: "OpenRouter keeps nothing by default, and the model's own provider keeps what its terms say.",
  } satisfies Record<ProviderId, string>,
  consent: {
    switchOn: (app: string) => `Switch on for ${app}`,
    sends: (sends: string) => `What leaves this device: ${sends}`,
    cancel: 'Cancel',
  },
  addKey: 'Add a key in Kuna settings to use the assistant.',
  usage: {
    line: (model: string, counts: string, cost: string) => `${model}, ${counts}, ${cost}`,
    input: (count: string) => `${count} in`,
    cacheRead: (count: string) => `${count} from cache`,
    cacheWrite: (count: string) => `${count} to cache`,
    output: (count: string) => `${count} out`,
    about: (cost: string) => `about ${cost}`,
    underCent: (cost: string) => `under ${cost}`,
    priceUnknown: 'price unknown',
  },
  result: {
    refused: (reason: string) => `The model declined this request: ${reason}`,
    declined: 'The model declined this request.',
    timedOut: 'The provider did not answer within five minutes.',
    cutOff: 'The answer was cut off. Try again, or pick a larger model.',
    tooLong: (count: string) => `The next request would send more than ${count} tokens, so Kuna stopped.`,
    overBudget: 'This task reached the most one task may spend, so Kuna stopped before another request.',
    holdsSecret: 'This request holds a key or a token, so Kuna did not send it.',
    failed: (reason: string) => `The assistant could not answer: ${reason}`,
    noPdf: (provider: string) => `${provider} does not read PDFs in Kuna. Pick Anthropic or OpenAI in Kuna settings.`,
  },
  answer: {
    notFromRules: "Not from Kuna's rules",
    ownKnowledge: 'The model added this from its own knowledge. Kuna did not check it.',
    strayFigure: 'Contains a figure Kuna did not compute',
    partlyUnchecked: 'Partly unchecked: the model named a source it was not given, or none at all',
    tryAgain: 'Try again',
    sources: 'Sources',
  },
}

export const hr: Translation<typeof en> = {
  card: {
    title: 'Asistent',
    subtitle:
      'Vaš AI ključ, model koji pokreće i aplikacije koje ga smiju koristiti. Svaka aplikacija ostaje isključena dok je ne uključite. Vaši ključevi ostaju u ovom pregledniku dok nijedna vaša datoteka nije na Driveu.',
    subtitleOnDrive:
      'Vaš AI ključ, model koji pokreće i aplikacije koje ga smiju koristiti. Svaka aplikacija ostaje isključena dok je ne uključite. Svaka sinkronizacija sprema vaše ključeve na vaš Google račun, u skrivenu mapu koju Drive ne prikazuje, pa ih dobiva svaki preglednik u kojem ste prijavljeni.',
    key: (provider) => `Ključ za ${provider}`,
    model: 'Model',
    defaultModel: (model) => `${model} (zadano)`,
    typedModel: {
      anthropic: 'Kuna ne zna cijenu ovog modela, pa uz njegova pokretanja piše cijena nepoznata.',
      openai: 'Kuna ne zna cijenu ovog modela, pa uz njegova pokretanja piše cijena nepoznata.',
      openrouter: 'OpenRouter javlja koliko je svako pokretanje koštalo i Kuna to prikazuje. Upisani model može sam pretraživati web, a Kuna to ne vidi.',
    },
    searchesWeb: 'Ovaj naziv modela uključuje pretraživanje weba, koje Kuna drži isključenim, pa pokretanja ostaju na zadanom modelu.',
    use: 'Koristi ovog pružatelja',
    inUse: 'U upotrebi',
    getKey: 'Nabavi ključ',
    refused: (provider) => `${provider} je odbio ključ.`,
    testFailed: (reason) => `Provjera nije završila: ${reason}`,
    apps: 'Aplikacije',
  },
  retention: {
    anthropic: 'Anthropic briše ono što Kuna pošalje u roku od 30 dana i ne uči na tome.',
    openai: 'OpenAI čuva ono što Kuna pošalje do 30 dana radi provjera zlouporabe i ne uči na tome.',
    openrouter: 'OpenRouter prema zadanim postavkama ništa ne čuva, a pružatelj modela čuva ono što kažu njegovi uvjeti.',
  },
  consent: {
    switchOn: (app) => `Uključi za ${app}`,
    sends: (sends) => `Što napušta ovaj uređaj: ${sends}`,
    cancel: 'Odustani',
  },
  addKey: 'Dodajte ključ u postavkama Kune da biste koristili asistenta.',
  usage: {
    line: (model, counts, cost) => `${model}, ${counts}, ${cost}`,
    input: (count) => `${count} ulaznih`,
    cacheRead: (count) => `${count} iz predmemorije`,
    cacheWrite: (count) => `${count} u predmemoriju`,
    output: (count) => `${count} izlaznih`,
    about: (cost) => `oko ${cost}`,
    underCent: (cost) => `ispod ${cost}`,
    priceUnknown: 'cijena nepoznata',
  },
  result: {
    refused: (reason) => `Model je odbio ovaj zahtjev: ${reason}`,
    declined: 'Model je odbio ovaj zahtjev.',
    timedOut: 'Pružatelj nije odgovorio u roku od pet minuta.',
    cutOff: 'Odgovor je prekinut. Pokušajte ponovno ili odaberite veći model.',
    tooLong: (count) => `Sljedeći zahtjev poslao bi više od ${count} tokena, pa je Kuna stala.`,
    overBudget: 'Ovaj zadatak dosegao je najviše što jedan zadatak smije potrošiti, pa je Kuna stala prije sljedećeg zahtjeva.',
    holdsSecret: 'Ovaj zahtjev sadrži ključ ili token, pa ga Kuna nije poslala.',
    failed: (reason) => `Asistent nije mogao odgovoriti: ${reason}`,
    noPdf: (provider) => `${provider} u Kuni ne čita PDF-ove. Odaberite Anthropic ili OpenAI u postavkama Kune.`,
  },
  answer: {
    notFromRules: 'Nije iz Kuninih pravila',
    ownKnowledge: 'Model je ovo dodao iz vlastitog znanja. Kuna to nije provjerila.',
    strayFigure: 'Sadrži iznos koji Kuna nije izračunala',
    partlyUnchecked: 'Djelomično neprovjereno: model je naveo izvor koji nije dobio ili nije naveo nijedan',
    tryAgain: 'Pokušaj ponovno',
    sources: 'Izvori',
  },
}

export const words = language === 'hr' ? hr : en
