import { language } from '../../../../shared/text/language'
import { plural } from '../../../../shared/text/translation'
import type { Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// A role and a category keep their names as the categories tab stores them, such as owner-benefit and travel. A bucket takes its Croatian name in quotes.
// A setting keeps its key as the settings tab stores it, such as number_locale, and TRUE and FALSE stay as the tab writes them.

const CROATIAN_BUCKET_LABELS = {
  income: 'Prihodi',
  operating: 'Poslovni rashodi',
  taxes: 'Porezi',
  'owner-pay': 'Isplate vlasniku',
  financing: 'Financiranje',
  neutral: 'Neutralno',
}

/** A bucket's Croatian name, or what the file holds for a bucket the app does not know. */
export function croatianBucketName(bucket: string): string {
  return Object.entries(CROATIAN_BUCKET_LABELS).find(([id]) => id === bucket)?.[1] ?? bucket
}

/** A bucket as a Croatian sentence names it, its name in quotes. */
export function croatianBucket(bucket: string): string {
  return `„${croatianBucketName(bucket)}”`
}

export const en = {
  /** What each bucket is called on screen while the file keeps the label Kuna wrote for it. */
  bucketLabels: {
    income: 'Income',
    operating: 'Operating cost',
    taxes: 'Taxes',
    'owner-pay': 'Owner pay',
    financing: 'Financing',
    neutral: 'Neutral',
  },
  /** The profit and loss lines no single bucket makes up. */
  lines: { cost: 'All costs', net: 'Net', ownerEarns: 'Owner earns' },
  /** Why a value on the settings tab or in Settings, General cannot be used. */
  settings: {
    notAVersion: (value: string) => `"${value}" is not a template version`,
    newerVersion: (version: number, read: number) => `the workbook is template version ${version} and this app reads version ${read}`,
    notAFlag: (value: string) => `"${value}" is neither TRUE nor FALSE`,
    booksFolderLater: (value: string, booksFolder: string) => `"${value}" holds ${booksFolder} after its start, where it names no folder`,
    namesNoFolder: (value: string) => `"${value}" names no folder`,
    notADay: (value: string) => `"${value}" is not a date such as 2026-01-01`,
    setTwice: 'set on more than one row, so the default is used',
    defaultUsed: (reason: string) => `${reason}, so the default is used`,
    noKey: 'a value without a key',
    unknownKey: 'not a setting this app knows, so it is kept but not used',
    profileTwice: 'set on more than one row, so the profile is not offered',
    profileNotOffered: (reason: string) => `${reason}, so the profile is not offered`,
    labelsReset: (clash: string) => `${clash}, so every bucket label is back to its default`,
    labelsClash: (taken: string, bucket: string, label: string) => `${taken} and ${bucket} are both labelled "${label}"`,
    nameTheSubject: 'name the words before the statement number in the subject, so other mail from the bank is left alone',
    labelTaken: (label: string) => `${label} already uses this label`,
    labelBlank: 'a label cannot be blank',
    labelTooLong: (most: number) => `a label can be at most ${most} characters`,
    labelReserved: (label: string) => `"${label}" already names another line`,
    notACurrencyCode: (currency: string) => `"${currency}" is not a three-letter currency code`,
    unknownCurrency: (currency: string) => `${currency} is not a currency this browser knows`,
    tooManyDecimals: (currency: string, digits: number) => `${currency} has ${digits} decimals, and the app counts in hundredths`,
    unknownLocale: (locale: string) => `"${locale}" is not a locale this browser knows`,
    notALocale: (locale: string) => `"${locale}" is not a locale tag such as en-GB`,
    notIbans: (ibans: readonly string[]) => `${ibans.map((iban) => `"${iban}"`).join(', ')} ${ibans.length === 1 ? 'is not an IBAN' : 'are not IBANs'}`,
    reviewLabelFormat: 'use letters, digits, - or _, with no spaces',
    reviewLabelTaken: (label: string) => `"${label}" is what the categoriser writes`,
  },
  /** Why a change to the accounts tab is refused. */
  accounts: {
    keepsIban: (slug: string) => `"${slug}" keeps its IBAN, since ledger rows name the account and the app files no statement whose IBAN the accounts tab does not name.`,
    onAnotherAccount: (iban: string, account: string) => `${iban} is already the IBAN of the ${account} account, and the app files each statement by its IBAN, so one IBAN names one account.`,
    onAClient: (iban: string, client: string) => `${iban} is the IBAN of the client ${client}, so the rules would read its payments as transfers between your own accounts.`,
  },
  /** What the categories editor says beside a field it cannot save. */
  fields: {
    required: 'Required',
    usedAbove: 'Already used above',
    keepsName: (name: string) => `${name} is in use, so it keeps its name`,
    slugFormat: 'Lower-case letters, digits and single hyphens',
    notABucket: 'Not one of the six buckets',
    unknownRoles: (count: number, roles: string) => `Not ${count === 1 ? 'a role' : 'roles'} the app knows: ${roles}`,
    unknownVat: 'Not a VAT treatment the app knows',
    shareRange: 'A whole number from 0 to 100',
    onlyOperating: 'Only an operating category holds a share',
    roleFirst: (role: string) => `Give a category the ${role} role first`,
  },
  /** Why a change to the categories is refused. */
  refusals: {
    advancesBucket: (slug: string, advances: number) =>
      `"${slug}" stays in the operating or taxes bucket, since ${advances === 1 ? 'an owner advance carries it' : `${advances} owner advances carry it`} and an advance counts only as an operating cost or a tax.`,
    colour: (slug: string, colour: string) => `"${slug}" takes one of the nine colours of the palette, or none for its bucket's colour, not "${colour}".`,
    roleBucket: (slug: string, bucket: string, role: string) =>
      `"${slug}" is in the ${bucket} bucket, and only an owner-pay category carries the ${role} role, since the owner's part of a shared cost counts there.`,
    roleOnce: (slug: string, role: string, count: number, others: string) => `"${slug}" takes the ${role} role only once no other category carries it, and ${others} ${count === 1 ? 'does' : 'do'}.`,
    shareBucket: (slug: string, bucket: string) => `"${slug}" is in the ${bucket} bucket, and only an operating category holds an owner share.`,
    shareRole: (slug: string, role: string) => `"${slug}" holds an owner share only once a category carries the ${role} role, where the owner's part counts.`,
    unknownRoles: (slug: string, roles: string) => `"${slug}" takes only roles the app knows, not ${roles}.`,
  },
  /** Why a new IBAN on the accounts or the clients tab is refused. */
  notAnIban: (iban: string) => `"${iban}" is not a valid IBAN.`,
  /** Why a change to the clients tab is refused. */
  clients: {
    onAnotherClient: (iban: string, client: string) => `${iban} is already on the clients tab for ${client}.`,
    ownAccount: (iban: string, account: string) => `${iban} is the IBAN of your ${account} account, so a transfer between your own accounts would read as a payment from a client.`,
  },
  /** Why a billing or invoice term on the settings tab cannot be used. */
  terms: {
    amountAboveZero: 'use an amount above zero, such as 7200',
    itemTooLong: (most: number) => `an item can be at most ${most} characters`,
    nameTheItem: 'name the item its rows carry on the outgoing-plan tab',
    notAnIban: (text: string) => `"${text}" is not an IBAN`,
  },
}

export const hr: Translation<typeof en> = {
  bucketLabels: CROATIAN_BUCKET_LABELS,
  lines: { cost: 'Svi troškovi', net: 'Neto', ownerEarns: 'Zarada vlasnika' },
  settings: {
    notAVersion: (value) => `„${value}” nije verzija predloška`,
    newerVersion: (version, read) => `datoteka je verzija predloška ${version}, a ova aplikacija čita verziju ${read}`,
    notAFlag: (value) => `„${value}” nije ni TRUE ni FALSE`,
    booksFolderLater: (value, booksFolder) => `„${value}” sadrži ${booksFolder} iza početka, gdje to ne imenuje mapu`,
    namesNoFolder: (value) => `„${value}” ne imenuje nijednu mapu`,
    notADay: (value) => `„${value}” nije datum poput 2026-01-01`,
    setTwice: 'postavljeno je u više redaka, pa vrijedi zadana vrijednost',
    defaultUsed: (reason) => `${reason}, pa vrijedi zadana vrijednost`,
    noKey: 'vrijednost bez ključa',
    unknownKey: 'aplikacija ne poznaje tu postavku, pa se čuva, ali ne koristi',
    profileTwice: 'postavljeno je u više redaka, pa se profil ne nudi',
    profileNotOffered: (reason) => `${reason}, pa se profil ne nudi`,
    labelsReset: (clash) => `${clash}, pa su svi nazivi skupina vraćeni na zadane`,
    labelsClash: (taken, bucket, label) => `${taken} i ${bucket} imaju isti naziv „${label}”`,
    nameTheSubject: 'upišite riječi ispred broja izvoda u predmetu, da ostala pošta banke ostane netaknuta',
    labelTaken: (label) => `Taj naziv već ima skupina ${label}`,
    labelBlank: 'naziv ne može biti prazan',
    labelTooLong: (most) => `naziv može imati najviše ${most} znakova`,
    labelReserved: (label) => `„${label}” već je naziv drugog retka`,
    notACurrencyCode: (currency) => `„${currency}” nije troslovna oznaka valute`,
    unknownCurrency: (currency) => `${currency} nije valuta koju ovaj preglednik poznaje`,
    tooManyDecimals: (currency, digits) => `${currency} ima ${digits} decimale, a aplikacija broji u stotinkama`,
    unknownLocale: (locale) => `„${locale}” nije oznaka jezika i regije koju ovaj preglednik poznaje`,
    notALocale: (locale) => `„${locale}” nije oznaka jezika i regije poput en-GB`,
    notIbans: (ibans) => `${ibans.map((iban) => `„${iban}”`).join(', ')} ${ibans.length === 1 ? 'nije IBAN' : 'nisu IBAN-ovi'}`,
    reviewLabelFormat: 'upotrijebite slova, znamenke, - ili _, bez razmaka',
    reviewLabelTaken: (label) => `„${label}” upisuje automatsko razvrstavanje`,
  },
  accounts: {
    keepsIban: (slug) => `„${slug}” zadržava svoj IBAN jer ga stavke evidencije navode, a aplikacija ne sprema izvod čiji IBAN nije među računima u banci.`,
    onAnotherAccount: (iban, account) => `${iban} već je IBAN računa u banci ${account}, a aplikacija svaki izvod sprema po IBAN-u, pa jedan IBAN označava jedan račun.`,
    onAClient: (iban, client) => `${iban} je IBAN klijenta ${client}, pa bi pravila njegove uplate čitala kao prijenose između vaših računa.`,
  },
  fields: {
    required: 'Obavezno',
    usedAbove: 'Već se koristi iznad',
    keepsName: (name) => `${name} je u upotrebi, pa zadržava naziv`,
    slugFormat: 'Mala slova, znamenke i pojedinačne crtice',
    notABucket: 'Nije jedna od šest skupina',
    unknownRoles: (count, roles) => `${plural({ one: 'Uloga koju', few: 'Uloge koje', other: 'Uloge koje' }, count)} aplikacija ne poznaje: ${roles}`,
    unknownVat: 'Aplikacija ne poznaje taj PDV tretman',
    shareRange: 'Cijeli broj od 0 do 100',
    onlyOperating: `Udio može imati samo kategorija skupine ${croatianBucket('operating')}`,
    roleFirst: (role) => `Najprije nekoj kategoriji dajte ulogu ${role}`,
  },
  refusals: {
    advancesBucket: (slug, advances) =>
      `„${slug}” ostaje u skupini ${croatianBucket('operating')} ili ${croatianBucket('taxes')} jer ${plural({ one: `je nosi ${advances} predujam vlasnika`, few: `je nose ${advances} predujma vlasnika`, other: `je nosi ${advances} predujmova vlasnika` }, advances)}, a predujam se broji samo kao poslovni rashod ili porez.`,
    colour: (slug, colour) => `„${slug}” uzima jednu od devet boja palete ili nijednu za boju svoje skupine, a ne „${colour}”.`,
    roleBucket: (slug, bucket, role) =>
      `„${slug}” je u skupini ${croatianBucket(bucket)}, a ulogu ${role} ima samo kategorija skupine ${croatianBucket('owner-pay')} jer se ondje broji vlasnikov dio zajedničkog troška.`,
    roleOnce: (slug, role, count, others) =>
      `„${slug}” može dobiti ulogu ${role} tek kad je nema nijedna druga kategorija, a ${plural({ one: 'ima je', few: 'imaju je', other: 'imaju je' }, count)} ${others}.`,
    shareBucket: (slug, bucket) => `„${slug}” je u skupini ${croatianBucket(bucket)}, a udio vlasnika ima samo kategorija skupine ${croatianBucket('operating')}.`,
    shareRole: (slug, role) => `„${slug}” može imati udio vlasnika tek kad neka kategorija ima ulogu ${role}, u kojoj se broji vlasnikov dio.`,
    unknownRoles: (slug, roles) => `„${slug}” uzima samo uloge koje aplikacija poznaje, a ne ${roles}.`,
  },
  notAnIban: (iban) => `„${iban}” nije ispravan IBAN.`,
  clients: {
    onAnotherClient: (iban, client) => `${iban} već je u popisu klijenata, kod klijenta ${client}.`,
    ownAccount: (iban, account) => `${iban} je IBAN vašeg računa u banci ${account}, pa bi prijenos između vaših računa izgledao kao uplata klijenta.`,
  },
  terms: {
    amountAboveZero: 'upišite iznos veći od nule, na primjer 7200',
    itemTooLong: (most) => `stavka može imati najviše ${most} znakova`,
    nameTheItem: 'upišite stavku koju njezini retci imaju u planu naplate',
    notAnIban: (text) => `„${text}” nije IBAN`,
  },
}

export const words = language === 'hr' ? hr : en
