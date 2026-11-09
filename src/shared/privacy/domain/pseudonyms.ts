import { fold } from '../../text/fold'
import { eachIdentifier, maskedIdentifier } from './maskIdentifiers'
import type { FoundIdentifier, IdentifierReach } from './maskIdentifiers'
import { isName, nameIn, namePartRuns, nameRuns, sameName } from './names'
import type { NameRun } from './names'

/** A person an app knows by name. Their name goes under an alias, and an employee's rows stay on the device while Anonymise is on. */
export interface KnownPerson {
  readonly name: string
  readonly employee: boolean
  /** The IBANs the person is paid into, normalised, which name them as surely as their name. */
  readonly ibans: readonly string[]
}

/** An IBAN or OIB that went out under a token, kept as first written so restoring gives it back as the person typed it. */
interface IdentifierPseudonym {
  readonly token: string
  readonly compact: string
  readonly written: string
}

/** The word an alias of a person starts with, in English and in Croatian. Restoring reads both, so a chat that changed language still reads back. */
export type PersonWord = 'Person' | 'Osoba'

const PERSON_WORDS: readonly PersonWord[] = ['Person', 'Osoba']

/** A person's name that goes out under an alias such as `Person 1`, with every way a text wrote it. */
interface PersonPseudonym {
  readonly number: number
  readonly alias: string
  readonly name: string
  readonly spellings: string[]
}

/** Which real name, IBAN or OIB each alias and token of a conversation stands for, as the chat keeps it in this browser between reloads. */
export interface AliasMap {
  readonly identifiers: readonly IdentifierPseudonym[]
  readonly persons: readonly PersonPseudonym[]
}

const NO_ALIASES: AliasMap = { identifiers: [], persons: [] }

/** The tokens and aliases one conversation hands out, so the same identifier or person always reads the same and can be read back. */
export interface Pseudonyms {
  /** Gives each name an alias, unless it has one or cannot be matched. Aliases follow the order names are first known. */
  know(names: readonly string[]): void
  /** The text with each IBAN and OIB under its token, each card and domestic account number the reach covers masked, and each known person under their alias. */
  pseudonymised(text: string, reach: IdentifierReach): string
  /**
   * A file's row with each IBAN and OIB under its token, each card and domestic account number masked, and each known
   * person under their alias, a name split across cells such as `Ana` and `Horvat` included.
   */
  pseudonymisedRow(cells: readonly string[]): readonly string[]
  /** The text with each IBAN and OIB under its token, each card and domestic account number masked, and every name as written, as a file's text leaves while Anonymise is off. */
  identifiersTokened(text: string): string
  /** A field that holds one identifier, under its token whatever its shape. */
  identifierToken(value: string): string
  /** What a token or an alias stands for, or null for text Kuna never handed out. */
  valueOf(token: string): string | null
  /** Every way the text Kuna sent wrote the person behind an alias, the known name first, or the value behind a token. Empty for text Kuna never handed out. */
  spellingsOf(token: string): readonly string[]
  /** The text with each token and alias Kuna handed out back as what it stands for, and any other left as written. */
  restored(text: string): string
  /** Every alias and token handed out so far, with what it stands for, which `newPseudonyms` takes back after a reload. */
  aliasMap(): AliasMap
}

function compactOf(written: string): string {
  return written.replace(/[\s-]/g, '').toUpperCase().replace(/^IBAN/, '')
}

function escaped(token: string): string {
  return token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * The pseudonyms of one conversation, whose people go out as `Person 1` or, on a Croatian screen, `Osoba 1`. A chat
 * brought back after a reload passes its map, so each alias still stands for the same person or identifier.
 */
export function newPseudonyms(personWord: PersonWord = 'Person', kept: AliasMap = NO_ALIASES): Pseudonyms {
  const identifiers: IdentifierPseudonym[] = [...kept.identifiers]
  const persons: PersonPseudonym[] = kept.persons.map((person) => ({ ...person, spellings: [...person.spellings] }))

  /**
   * The token an IBAN or an OIB already has, or a new one shaped like its mask, with ` #2` and on when another identifier
   * holds that mask. A card or a domestic account number goes masked, with no way back.
   */
  function tokenOf(identifier: FoundIdentifier): string {
    if (identifier.kind === 'card' || identifier.kind === 'account') {
      return maskedIdentifier(identifier)
    }
    const known = identifiers.find((pseudonym) => pseudonym.compact === identifier.compact)
    if (known !== undefined) {
      return known.token
    }
    const mask = maskedIdentifier(identifier)
    const sharing = identifiers.filter((pseudonym) => pseudonym.token === mask || pseudonym.token.startsWith(`${mask} #`)).length
    const token = sharing === 0 ? mask : `${mask} #${sharing + 1}`
    identifiers.push({ token, compact: identifier.compact, written: identifier.written })
    return token
  }

  function aliasedRuns(text: string, person: PersonPseudonym, runsOf: (text: string, name: string) => readonly NameRun[]): string {
    return runsOf(text, person.name).reduceRight((replaced, run) => {
      const written = text.slice(run.start, run.end)
      if (!person.spellings.some((spelling) => fold(spelling) === fold(written))) {
        person.spellings.push(written)
      }
      return `${replaced.slice(0, run.start)}${person.alias}${replaced.slice(run.end)}`
    }, text)
  }

  function longestNameFirst(): readonly PersonPseudonym[] {
    return [...persons].sort((one, other) => other.name.length - one.name.length)
  }

  function realValues(): ReadonlyMap<string, string> {
    const everyAlias = persons.flatMap((person) => PERSON_WORDS.map((word) => [`${word} ${person.number}`, person.name] as const))
    return new Map([...identifiers.map((pseudonym) => [pseudonym.token, pseudonym.written] as const), ...everyAlias])
  }

  function personOf(token: string): PersonPseudonym | undefined {
    const match = /^(?:Person|Osoba) (\d+)$/.exec(token.trim())
    return match === null ? undefined : persons.find((person) => person.number === Number(match[1]))
  }

  return {
    know(names) {
      for (const name of names) {
        if (isName(name) && !persons.some((person) => sameName(person.name, name))) {
          persons.push({ number: persons.length + 1, alias: `${personWord} ${persons.length + 1}`, name, spellings: [name] })
        }
      }
    },
    pseudonymised(text, reach) {
      const tokened = eachIdentifier(text, tokenOf, reach)
      return longestNameFirst().reduce((aliased, person) => aliasedRuns(aliased, person, nameRuns), tokened)
    },
    pseudonymisedRow(cells) {
      const tokened = cells.map((cell) => eachIdentifier(cell, tokenOf, 'written'))
      const row = tokened.join('\n')
      const named = longestNameFirst().filter((person) => nameIn(row, person.name))
      return tokened.map((cell) => named.reduce((aliased, person) => aliasedRuns(aliased, person, namePartRuns), cell))
    },
    identifiersTokened(text) {
      return eachIdentifier(text, tokenOf, 'written')
    },
    identifierToken(value) {
      const compact = compactOf(value)
      if (compact === '') {
        return value
      }
      return tokenOf({ kind: /^\d{11}$/.test(compact) ? 'oib' : 'iban', written: value, compact })
    },
    valueOf(token) {
      return realValues().get(token.trim()) ?? null
    },
    spellingsOf(token) {
      const person = personOf(token)
      if (person !== undefined) {
        return [...person.spellings]
      }
      const value = realValues().get(token.trim())
      return value === undefined ? [] : [value]
    },
    restored(text) {
      const real = realValues()
      if (real.size === 0) {
        return text
      }
      const tokens = [...real.keys()].sort((one, other) => other.length - one.length).map(escaped)
      const handedOut = new RegExp(`(?<![\\p{L}\\p{N}])(?:${tokens.join('|')})(?![\\p{L}\\p{N}]| #\\d)`, 'gu')
      return text.replace(handedOut, (token) => real.get(token) ?? token)
    },
    aliasMap() {
      return { identifiers: [...identifiers], persons: persons.map((person) => ({ ...person, spellings: [...person.spellings] })) }
    },
  }
}
