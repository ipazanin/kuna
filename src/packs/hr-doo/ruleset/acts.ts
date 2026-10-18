export type ActId =
  | 'ZPD'
  | 'PravPD'
  | 'ZPDoh'
  | 'PravPDoh'
  | 'ZDop'
  | 'PravDop'
  | 'Naredba2025'
  | 'Naredba2026'
  | 'ZMP'
  | 'UredbaMP2025'
  | 'UredbaMP2026'
  | 'ZOMO'
  | 'OdlukaSplit'
  | 'ZPDV'
  | 'PravPDV'
  | 'ZoR'
  | 'HSFI'
  | 'PravGFI'
  | 'ZTD'
  | 'OdlukaKamataPovezane2024'
  | 'OdlukaKamataPovezane2025'
  | 'OdlukaKamataPovezane2026'
  | 'OdlukaDnevniceInozemstvo'
  | 'OPZ'
  | 'PravOPZ'
  | 'ZLP'
  | 'ZDP'
  | 'ZCTZ'
  | 'ZFisk'
  | 'ZUP'

/** An act or bylaw, once. Rules point at it by id so an abbreviation can never name the wrong act. */
export interface Act {
  readonly id: ActId
  /** The Croatian name. */
  readonly title: string
  /** NN issues of the act and its amendments, oldest first, as the law files list them. Empty for an act cited but never loaded. */
  readonly nn: readonly string[]
  /** False when the law files leave out part of the history or mark an issue uncertain. A source may then cite any issue between the first and the last listed. */
  readonly nnComplete: boolean
  /** The page with the current text: the zakon.hr consolidated text, or the NN page of an act never amended. */
  readonly textUrl: string | null
}

export const ACTS: Readonly<Record<ActId, Act>> = {
  ZPD: {
    id: 'ZPD',
    title: 'Zakon o porezu na dobit',
    nn: ['177/04', '90/05', '57/06', '146/08', '80/10', '22/12', '148/13', '143/14', '50/16', '115/16', '106/18', '121/19', '32/20', '138/20', '114/22', '114/23', '151/25'],
    nnComplete: true,
    textUrl: 'https://www.zakon.hr/z/99/zakon-o-porezu-na-dobit',
  },
  PravPD: {
    id: 'PravPD',
    title: 'Pravilnik o porezu na dobit',
    nn: ['95/05', '156/23', '16/25', '39/26'],
    nnComplete: false,
    textUrl: 'https://www.zakon.hr/cms.htm?id=60061',
  },
  ZPDoh: {
    id: 'ZPDoh',
    title: 'Zakon o porezu na dohodak',
    nn: ['115/16', '106/18', '121/19', '32/20', '138/20', '151/22', '114/23', '152/24'],
    nnComplete: true,
    textUrl: 'https://www.zakon.hr/z/85/zakon-o-porezu-na-dohodak',
  },
  PravPDoh: {
    id: 'PravPDoh',
    title: 'Pravilnik o porezu na dohodak',
    nn: ['10/17', '143/23', '16/25', '157/25'],
    nnComplete: false,
    textUrl: null,
  },
  ZDop: {
    id: 'ZDop',
    title: 'Zakon o doprinosima',
    nn: ['84/08', '152/08', '94/09', '18/11', '22/12', '144/12', '148/13', '41/14', '143/14', '115/16', '106/18', '33/23', '114/23', '152/24'],
    nnComplete: true,
    textUrl: 'https://www.zakon.hr/z/365/Zakon-o-doprinosima',
  },
  PravDop: {
    id: 'PravDop',
    title: 'Pravilnik o doprinosima',
    nn: ['143/23'],
    nnComplete: false,
    textUrl: null,
  },
  Naredba2025: {
    id: 'Naredba2025',
    title: 'Naredba o iznosima osnovica za obračun doprinosa za obvezna osiguranja za 2025. godinu',
    nn: ['137/24', '25/25'],
    nnComplete: true,
    textUrl: 'https://www.zakon.hr/cms.htm?id=540573',
  },
  Naredba2026: {
    id: 'Naredba2026',
    title: 'Naredba o iznosima osnovica za obračun doprinosa za obvezna osiguranja za 2026. godinu',
    nn: ['150/25'],
    nnComplete: true,
    textUrl: 'https://narodne-novine.nn.hr/clanci/sluzbeni/2025_12_150_2237.html',
  },
  ZMP: {
    id: 'ZMP',
    title: 'Zakon o minimalnoj plaći',
    nn: ['118/18', '120/21', '152/24'],
    nnComplete: true,
    textUrl: 'https://www.zakon.hr/z/400/zakon-o-minimalnoj-placi',
  },
  UredbaMP2025: {
    id: 'UredbaMP2025',
    title: 'Uredba o visini minimalne plaće za 2025. godinu',
    nn: ['124/24'],
    nnComplete: true,
    textUrl: 'https://narodne-novine.nn.hr/clanci/sluzbeni/2024_10_124_2072.html',
  },
  UredbaMP2026: {
    id: 'UredbaMP2026',
    title: 'Uredba o visini minimalne plaće za 2026. godinu',
    nn: ['132/25'],
    nnComplete: true,
    textUrl: 'https://narodne-novine.nn.hr/clanci/sluzbeni/2025_10_132_1931.html',
  },
  ZOMO: {
    id: 'ZOMO',
    title: 'Zakon o mirovinskom osiguranju',
    nn: ['96/25'],
    nnComplete: false,
    textUrl: 'https://www.zakon.hr/z/91/Zakon-o-mirovinskom-osiguranju',
  },
  OdlukaSplit: {
    id: 'OdlukaSplit',
    title: 'Odluka o visini poreznih stopa godišnjeg poreza na dohodak na području Grada Splita',
    nn: ['150/23', '35/25'],
    nnComplete: true,
    textUrl: null,
  },
  ZPDV: {
    id: 'ZPDV',
    title: 'Zakon o porezu na dodanu vrijednost',
    nn: ['73/13', '152/24', '52/25', '151/25', '32/26', '48/26'],
    nnComplete: false,
    textUrl: 'https://www.zakon.hr/z/1455/zakon-o-porezu-na-dodanu-vrijednost',
  },
  PravPDV: {
    id: 'PravPDV',
    title: 'Pravilnik o porezu na dodanu vrijednost',
    nn: [],
    nnComplete: false,
    textUrl: null,
  },
  ZoR: {
    id: 'ZoR',
    title: 'Zakon o računovodstvu',
    nn: ['85/24', '145/24', '151/25', '59/26'],
    nnComplete: true,
    textUrl: 'https://www.zakon.hr/z/118/zakon-o-racunovodstvu',
  },
  HSFI: {
    id: 'HSFI',
    title: 'Hrvatski standardi financijskog izvještavanja',
    nn: ['86/15', '105/20', '9/21', '150/22', '84/24'],
    nnComplete: true,
    textUrl: 'https://www.zakon.hr/cms.htm?id=60100',
  },
  PravGFI: {
    id: 'PravGFI',
    title: 'Pravilnik o strukturi i sadržaju godišnjih financijskih izvještaja',
    nn: ['95/16', '158/23'],
    nnComplete: false,
    textUrl: null,
  },
  ZTD: {
    id: 'ZTD',
    title: 'Zakon o trgovačkim društvima',
    nn: ['111/93', '130/23', '136/24'],
    nnComplete: false,
    textUrl: 'https://www.zakon.hr/z/546/zakon-o-trgovackim-drustvima',
  },
  OdlukaKamataPovezane2024: {
    id: 'OdlukaKamataPovezane2024',
    title: 'Odluka o objavi kamatne stope na zajmove između povezanih osoba',
    nn: ['157/23'],
    nnComplete: false,
    textUrl: null,
  },
  OdlukaKamataPovezane2025: {
    id: 'OdlukaKamataPovezane2025',
    title: 'Odluka o objavi kamatne stope na zajmove između povezanih osoba',
    nn: ['151/24'],
    nnComplete: false,
    textUrl: 'https://narodne-novine.nn.hr/clanci/sluzbeni/2024_12_151_2486.html',
  },
  OdlukaKamataPovezane2026: {
    id: 'OdlukaKamataPovezane2026',
    title: 'Odluka o objavi kamatne stope na zajmove između povezanih osoba',
    nn: ['150/25'],
    nnComplete: true,
    textUrl: 'https://narodne-novine.nn.hr/clanci/sluzbeni/2025_12_150_2236.html',
  },
  OdlukaDnevniceInozemstvo: {
    id: 'OdlukaDnevniceInozemstvo',
    title: 'Odluka o visini dnevnice za službeno putovanje u inozemstvo',
    nn: ['16/24'],
    nnComplete: true,
    textUrl: 'https://www.zakon.hr/cms.htm?id=59611',
  },
  OPZ: {
    id: 'OPZ',
    title: 'Opći porezni zakon',
    nn: [],
    nnComplete: false,
    textUrl: null,
  },
  PravOPZ: {
    id: 'PravOPZ',
    title: 'Pravilnik o provedbi Općeg poreznog zakona',
    nn: ['109/26'],
    nnComplete: false,
    textUrl: null,
  },
  ZLP: {
    id: 'ZLP',
    title: 'Zakon o lokalnim porezima',
    nn: ['114/23'],
    nnComplete: false,
    textUrl: null,
  },
  ZDP: {
    id: 'ZDP',
    title: 'Zakon o državnim potporama',
    nn: ['47/14', '69/17'],
    nnComplete: true,
    textUrl: null,
  },
  ZCTZ: {
    id: 'ZCTZ',
    title: 'Zakon o članarinama u turističkim zajednicama',
    nn: ['52/19', '144/20'],
    nnComplete: true,
    textUrl: null,
  },
  ZFisk: {
    id: 'ZFisk',
    title: 'Zakon o fiskalizaciji',
    nn: [],
    nnComplete: false,
    textUrl: null,
  },
  ZUP: {
    id: 'ZUP',
    title: 'Zakon o općem upravnom postupku',
    nn: [],
    nnComplete: false,
    textUrl: null,
  },
}
