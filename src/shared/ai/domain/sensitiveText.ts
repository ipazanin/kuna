import { fold, normaliseIban } from '../../text/fold'
import { replacedIdentifiers } from './maskIdentifiers'

/** What an alias stands for, which is also the word it starts with. It stays in English in every language, so one value has one spelling in a chat. */
export type AliasKind = 'Person' | 'IBAN' | 'OIB' | 'Address'

/** Words that say a company or a place of trade stands behind a name, after accents and case are folded. */
const BUSINESS_WORDS: ReadonlySet<string> = new Set(
  (
    'DOO JDOO DD LTD LLC INC GMBH AG SRL PLC CORP SA BV KG ' +
    'BANK BANKA MARKET SUPERMARKET TRGOVINA SHOP STORE MALL CENTAR CENTER RESTORAN RESTAURANT BISTRO CAFFE CAFE KAFIC BAR PIZZERIA HOTEL HOSTEL ' +
    'LJEKARNA PHARMACY PEKARA BAKERY BENZINSKA STATION FUEL POSTA POST TELECOM TELEKOM AIRLINES AIRWAYS STUDIO GRUPA GROUP SERVIS SERVICE AGENCIJA AGENCY KLINIKA OSIGURANJE'
  ).split(' '),
)

/** Places a statement prints after a shop's name, which neither make a name nor hide one: `KONZUM ZAGREB` is a shop, and `ANA HORVAT ZAGREB` is still Ana Horvat. */
const PLACE_WORDS: ReadonlySet<string> = new Set('HRVATSKA CROATIA ZAGREB SPLIT RIJEKA OSIJEK ZADAR PULA DUBROVNIK SIBENIK VARAZDIN KARLOVAC'.split(' '))

/** Whether the words, without any place among them, read as a name: two to four of them and none a business's. */
function wordsNameAPerson(words: readonly string[]): boolean {
  const folded = words.map(fold)
  const named = folded.filter((word) => !PLACE_WORDS.has(word))
  return named.length >= 2 && named.length <= 4 && !named.some((word) => BUSINESS_WORDS.has(word))
}

/** A legal form right after a name, as `d.o.o.` or `j.d.o.o.` stands after a company's. */
const LEGAL_FORM_NEXT = /^\s*(?:j\.?\s?)?d\.?\s?(?:o\.?\s?o|d)\b/i
const NAME_WORD = /^\p{Lu}[\p{L}'’-]+$/u
/** Two or more words in a row that each start with a capital, as a name stands in a sentence, or a bank's capitals. */
const NAME_RUN = /(?<![\p{L}\p{N}])\p{Lu}[\p{L}'’-]+(?: \p{Lu}[\p{L}'’-]+)+(?![\p{L}\p{N}])/gu
/** A street and a house number, ending the text or followed by a comma or a postal code, as an address stands in a bank's text. */
const STREET = /(?<![\p{L}\p{N}])\p{Lu}\p{L}+(?: \p{L}+){0,3} \d{1,3}[a-z]?(?=,|$|\s+\d{5})/gu

/**
 * Whether a payee's or a merchant's name reads as a person's: two to four capitalised words of letters, places aside, and no
 * sign of a business. A word alone stays, as does anything holding a digit or a mark such as `*` or `.`, since it then reads as a
 * brand or a company. A wrong yes costs the model a hint and shows the real name on screen all the same.
 */
export function namesAPerson(name: string): boolean {
  const words = name.trim().split(/\s+/)
  return words.every((word) => NAME_WORD.test(word)) && wordsNameAPerson(words)
}

/** The stable aliases of one chat, held in memory only. The same value gets the same alias, however a statement spells it. */
export interface ChatAliases {
  aliasOf(kind: AliasKind, value: string): string
  /** The value behind an alias, or null for text that is not one of this chat's aliases. */
  valueOf(alias: string): string | null
  /** The text with each of this chat's aliases back as the value it stands for, for the screen only. */
  restored(text: string): string
}

/** A person's words in any order and case, so `HORVAT ANA` and `Ana Horvat` are one person, and an identifier without its spaces. */
function sameValueKey(kind: AliasKind, value: string): string {
  return kind === 'Person' ? fold(value).split(' ').sort().join(' ') : kind === 'Address' ? fold(value) : normaliseIban(value)
}

/** An alias as a model may write it: as given, or with `Person` or `Address` translated and declined in a Croatian sentence. */
const WRITTEN_ALIAS = /(?<![\p{L}\p{N}])(Person|Osob\p{L}*|IBAN|OIB|Address|Adres\p{L}*) (\d+)(?![\p{L}\p{N}])/gu

function canonicalWord(written: string): string {
  if (written.startsWith('Osob')) return 'Person'
  return written.startsWith('Adres') ? 'Address' : written
}

export function chatAliases(): ChatAliases {
  const aliases = new Map<string, string>()
  const values = new Map<string, string>()
  const counts = new Map<AliasKind, number>()
  return {
    aliasOf(kind, value) {
      const key = `${kind}/${sameValueKey(kind, value)}`
      const known = aliases.get(key)
      if (known !== undefined) return known
      const count = (counts.get(kind) ?? 0) + 1
      counts.set(kind, count)
      const alias = `${kind} ${count}`
      aliases.set(key, alias)
      values.set(alias, value)
      return alias
    },
    valueOf: (alias) => values.get(alias.trim()) ?? null,
    restored: (text) => text.replace(WRITTEN_ALIAS, (written, word: string, count: string) => values.get(`${canonicalWord(word)} ${count}`) ?? written),
  }
}

/** The text with what it can be seen to hold of a person replaced by aliases: an address, an IBAN, an OIB, and any words that read as a name. */
export function anonymisedText(text: string, aliases: ChatAliases): string {
  const withoutAddresses = text.replace(STREET, (street) => aliases.aliasOf('Address', street))
  const withoutNames = withoutAddresses.replace(NAME_RUN, (run, at: number, whole: string) =>
    run.includes('Address') || LEGAL_FORM_NEXT.test(whole.slice(at + run.length)) || !wordsNameAPerson(run.split(' ')) ? run : aliases.aliasOf('Person', run),
  )
  return replacedIdentifiers(
    withoutNames,
    (iban) => aliases.aliasOf('IBAN', iban),
    (oib) => aliases.aliasOf('OIB', oib),
  )
}

/** A payee or a merchant: an alias when it names a person, or else the name, with any identifier in it replaced. */
export function anonymisedCounterparty(name: string, aliases: ChatAliases): string {
  return namesAPerson(name)
    ? aliases.aliasOf('Person', name)
    : replacedIdentifiers(
        name,
        (iban) => aliases.aliasOf('IBAN', iban),
        (oib) => aliases.aliasOf('OIB', oib),
      )
}
