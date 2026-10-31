/**
 * Finds English left on a Croatian screen. The English words are every word the `en` side of the
 * app's `words.ts` files writes and no Croatian text of the app does, so a loanword Croatian keeps,
 * such as plan or status, never counts. A Croatian screen may still show English that is data, such
 * as what the fake files store as typed or a key in the identifier style. Each such case is a named
 * entry of `ENGLISH_ALLOWED`, and nothing else gets through.
 */

import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as XLSX from 'xlsx'

import { en as companyBooksEnglish, hr as companyBooksCroatian } from '../../src/apps/company/workbook/domain/words.ts'
import { fakeWorkbookDocument } from '../../src/apps/company/workbook/infrastructure/fake/fakeWorkbook.ts'
import { templateColumnNames } from '../../src/apps/company/workbook/infrastructure/workbookTemplate.ts'
import { WORKBOOK_TABS } from '../../src/apps/company/workbook/infrastructure/workbookSnapshot.ts'
import { NEW_BOOKS_TITLE } from '../../src/apps/company/workbook/presentation/workbookFiles.ts'
import { DEFAULT_MAIL_SUBJECT } from '../../src/apps/company/invoicing/domain/invoiceMail.ts'
import { en as settingsEnglish } from '../../src/apps/company/settings/domain/words.ts'
import { sampleCamtXml, sampleTableFile } from '../../src/apps/company/imports/infrastructure/fake/sampleImportFiles.ts'
import { FAKE_SEARCH_FAILURE, FAKE_UPLOAD_FAILURE, fakeMails } from '../../src/apps/company/mail/infrastructure/fake/fakeMailbox.ts'
import { FAKE_BOOKS_FOLDER } from '../../src/shared/storage/infrastructure/fake/fakeDriveSession.ts'
import { fakeStaffOf } from '../../src/apps/company/packs/hr-doo/infrastructure/fake/fakeStaff.ts'
import { en as scenariosEnglish } from '../../src/apps/company/packs/hr-doo/domain/scenarios/words.ts'
import { OPEN_ITEMS, RULES } from '../../src/apps/company/packs/hr-doo/ruleset/ruleset.ts'
import { termLabel } from '../../src/apps/company/packs/hr-doo/ruleset/presentation/ruleWording.ts'
import { fakeLoansDocument } from '../../src/apps/loans/workbook/infrastructure/fake/fakeLoans.ts'
import { fakeInvestmentsDocument } from '../../src/apps/investments/workbook/infrastructure/fake/fakeInvestments.ts'
import { sampleWorkbookGrid } from '../../src/apps/investments/imports/infrastructure/fake/sampleWorkbook.ts'
import { installHrDooPack } from './installPack.mjs'

const SOURCE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src')

/** The text of every file under `folder` that `wanted` picks by its path. */
function sourcesUnder(folder, wanted) {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name)
    if (entry.isDirectory()) return sourcesUnder(path, wanted)
    return wanted(path) ? [readFileSync(path, 'utf8')] : []
  })
}

/**
 * The string literals of a stretch of TypeScript, each static part of a template on its own, with
 * comments and regular expressions skipped, since a comment in the Croatian half is English.
 */
function stringLiterals(source) {
  const found = []
  let index = 0
  // A slash after one of these, or after return, opens a regular expression rather than dividing.
  const startsRegex = () => {
    const before = source.slice(0, index).trimEnd()
    return before === '' || /[(,=:[!&|?{};]$/.test(before) || /\breturn$/.test(before)
  }
  const skipRegex = () => {
    let inClass = false
    for (index += 1; index < source.length; index += 1) {
      const char = source[index]
      if (char === '\\') index += 1
      else if (char === '[') inClass = true
      else if (char === ']') inClass = false
      else if (char === '/' && !inClass) break
    }
    index += 1
    while (/[a-z]/.test(source[index] ?? '')) index += 1
  }
  const readQuoted = (quote) => {
    let text = ''
    for (index += 1; index < source.length && source[index] !== quote; index += 1) {
      if (source[index] === '\\') index += 1
      text += source[index]
    }
    index += 1
    found.push(text)
  }
  const readTemplate = () => {
    let text = ''
    for (index += 1; index < source.length && source[index] !== '`'; index += 1) {
      if (source[index] === '\\') {
        index += 1
        text += source[index]
      } else if (source.startsWith('${', index)) {
        found.push(text)
        text = ''
        index += 2
        readCode(true)
        index -= 1
      } else {
        text += source[index]
      }
    }
    index += 1
    found.push(text)
  }
  const readCode = (untilClosingBrace) => {
    let depth = 0
    while (index < source.length) {
      if (source.startsWith('//', index)) {
        const end = source.indexOf('\n', index)
        index = end === -1 ? source.length : end
      } else if (source.startsWith('/*', index)) {
        const end = source.indexOf('*/', index + 2)
        index = end === -1 ? source.length : end + 2
      } else if (source[index] === '/' && startsRegex()) {
        skipRegex()
      } else if (source[index] === "'" || source[index] === '"') {
        readQuoted(source[index])
      } else if (source[index] === '`') {
        readTemplate()
      } else {
        if (source[index] === '{') depth += 1
        if (source[index] === '}') {
          if (untilClosingBrace && depth === 0) {
            index += 1
            return
          }
          depth -= 1
        }
        index += 1
      }
    }
  }
  readCode(false)
  return found
}

/** A key with dots, hyphens, colons or underscores, a path, a mail address or a camelCase name, which counts as no word of either language. */
const IDENTIFIER_LIKE = /(?<![\p{L}\d])[\p{Ll}\d]+(?:[._/@:-][\p{L}\d]+)+|\p{Ll}+\p{Lu}[\p{L}\d]*/gu

/** The words of a text as written, two letters or more. */
function wordsAsWritten(text) {
  return (text.replace(IDENTIFIER_LIKE, ' ').match(/\p{L}+/gu) ?? []).filter((word) => word.length > 1)
}

function wordsOf(text) {
  return wordsAsWritten(text).map((word) => word.toLowerCase())
}

installHrDooPack()

/** A field of the file a Croatian reason names after the word polje, as the file stores it, such as polje amount. */
const FIELD_AFTER_POLJE = /(?<=(?:^|[\s(])[Pp]olj(?:e|a|u) )[\p{Ll}\d_]+(?: i [\p{Ll}\d_]+)?/gu

/** A placeholder of a file name or mail template, such as {client}. */
const PLACEHOLDER = /\{[a-z]+\}/g

const FAKE_SAVED_AT = '2026-10-16T08:00:00.000Z'

/** The files of the fake build, whose records hold what it stores as typed. */
const FAKE_DOCUMENTS = [
  fakeWorkbookDocument(FAKE_SAVED_AT, 'drive'),
  fakeWorkbookDocument(FAKE_SAVED_AT, 'browser'),
  ...['one-employee', 'five-employees'].map((variant) => fakeWorkbookDocument(FAKE_SAVED_AT, 'drive', fakeStaffOf(variant))),
  ...['sample', 'one-loan', 'house-and-car'].map((set) => fakeLoansDocument(FAKE_SAVED_AT, set)),
  ...['sample', 'cash-below-zero'].map((variant) => fakeInvestmentsDocument(FAKE_SAVED_AT, variant)),
]

/** The words of the field names of the Company, Loans and Investments files, which a Croatian reason writes in lower case as the file stores them. */
const FILE_FIELDS = new Set(
  [
    ...WORKBOOK_TABS.flatMap((tab) => templateColumnNames(tab)),
    ...FAKE_DOCUMENTS.flatMap((document) => Object.values(document.records).flatMap((records) => records.flatMap((record) => Object.keys(record)))),
  ].flatMap((field) => field.split('_')),
)

/** File field words that are Croatian words too, so a Croatian sentence writes them in lower case for their own sake. */
const CROATIAN_HOMOGRAPHS = new Set(['to', 'on', 'date', 'instrument'])

/** Each words file's English and Croatian halves, as the strings each writes. */
const HALVES = sourcesUnder(SOURCE, (path) => path.endsWith('/words.ts')).map((source) => {
  const croatianStart = source.search(/^export const hr\b/m)
  const englishStart = source.search(/^export const en\b/m)
  const wordsStart = source.search(/^export const words\b/m)
  // A lower-case key the Croatian half compares or looks up, such as 'operating', is no Croatian word.
  const croatian = stringLiterals(source.slice(croatianStart, wordsStart === -1 ? undefined : wordsStart)).filter((text) => !/^[a-z][a-z\d_.-]*$/.test(text))
  return { english: stringLiterals(source.slice(englishStart, croatianStart)), croatian }
})

/** The rule titles Croatian screens show, which sit beside the rules rather than in a words file. */
const CROATIAN_RULE_TITLES = stringLiterals(readFileSync(join(SOURCE, 'apps/company/packs/hr-doo/ruleset/presentation/ruleTitles.ts'), 'utf8'))

/** A Croatian text without what it names as the file stores it: a quoted key, a field after polje or a placeholder. */
function namedAsStored(text) {
  return text
    .replace(/„[^„”]*”/gu, ' ')
    .replace(FIELD_AFTER_POLJE, ' ')
    .replace(PLACEHOLDER, ' ')
}

const CROATIAN_WORDS = new Set(
  [...HALVES.flatMap((half) => half.croatian), ...CROATIAN_RULE_TITLES]
    .map(namedAsStored)
    .flatMap(wordsAsWritten)
    .filter((word) => word !== word.toLowerCase() || !FILE_FIELDS.has(word) || CROATIAN_HOMOGRAPHS.has(word))
    .map((word) => word.toLowerCase()),
)

/** The words that mark English: written in English and never in Croatian. */
export const ENGLISH_WORDS = new Set(
  HALVES.flatMap((half) => half.english)
    .flatMap(wordsOf)
    .filter((word) => !CROATIAN_WORDS.has(word)),
)

/** What Kuna writes into a file in English and names in Croatian on a Croatian screen, so it is never data that may stay English. */
const SEEDED_IN_ENGLISH = new Set([...Object.values(settingsEnglish.bucketLabels), ...Object.values(scenariosEnglish.starting), NEW_BOOKS_TITLE])

/** Every string anywhere in a value, such as a fake file's records. */
function stringsIn(value) {
  if (typeof value === 'string') return [value]
  if (value === null || typeof value !== 'object') return []
  return Object.values(value).flatMap(stringsIn)
}

/**
 * Text the fake build keeps as typed: the records of its files, the mail of its mailbox, its Drive
 * folder and the rows of the sample statement, bank export and portfolio workbook. A single lower-case word is a stored
 * kind such as `computers`, which a screen names in Croatian, so it is not data that may stay English.
 */
async function typedInFakeFiles() {
  const camt = [...sampleCamtXml().matchAll(/>([^<>]+)</g)].map((match) => match[1])
  const table = XLSX.read(await sampleTableFile(), { type: 'buffer' })
  const tableCells = Object.values(table.Sheets).flatMap((sheet) => XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false }).flat())
  return [...FAKE_DOCUMENTS.flatMap(stringsIn), ...fakeMails().flatMap(stringsIn), FAKE_BOOKS_FOLDER, ...camt, ...tableCells.map(String), ...sampleWorkbookGrid().flat().map(String)]
    .map((text) => text.trim())
    .filter((text) => !SEEDED_IN_ENGLISH.has(text) && !/^\p{Ll}+$/u.test(text) && wordsOf(text).some((word) => ENGLISH_WORDS.has(word)))
}

const TYPED_IN_FAKE_FILES = await typedInFakeFiles()

/** Every whole text the English halves write, such as the label Split. */
const ENGLISH_LABELS = new Set(HALVES.flatMap((half) => half.english).map((text) => text.trim().toLowerCase()))

/** One-word typed texts that are English labels too, such as the town Split, which pass only in quotes so a button left in English cannot pass as one. */
const TYPED_LABELS = new Set(TYPED_IN_FAKE_FILES.filter((text) => wordsOf(text).length === 1 && ENGLISH_LABELS.has(text.toLowerCase())).map((text) => text.toLowerCase()))

/** The labels a category shows without one of its own, where Kuna has no Croatian name for its slug. */
function unseededCategoryLabels() {
  const slugs = new Set((FAKE_DOCUMENTS[0].records.category ?? []).map((category) => category.category))
  return [...slugs].filter((slug) => companyBooksCroatian.unlabelled(slug) === companyBooksEnglish.unlabelled(slug)).map((slug) => companyBooksEnglish.unlabelled(slug))
}

/** The label of every term of every rule, and of every column of a table term. */
function ruleTermLabels() {
  const keys = RULES.flatMap((rule) =>
    rule.versions.flatMap((version) => Object.entries(version.value).flatMap(([key, term]) => [key, ...(term.kind === 'table' ? term.rows.flatMap((row) => Object.keys(row)) : [])])),
  )
  return [...new Set(keys)].map(termLabel)
}

/** The default subject of the invoice mail as a pattern, its placeholders filled in English as the client's mail language asks. */
function invoiceMailSubject() {
  const fills = { '{number}': '[\\w./-]+', '{month}': '\\p{L}+ \\d{4}' }
  return new RegExp(
    DEFAULT_MAIL_SUBJECT.split(/(\{\w+\})/)
      .map((part) => fills[part] ?? (part.startsWith('{') ? '.+?' : escaped(part)))
      .join(''),
    'gu',
  )
}

/** The research notes of every rule version and every open item. */
function ruleNotes() {
  return [...RULES.flatMap((rule) => rule.versions.flatMap((version) => (version.note === undefined ? [] : [version.note]))), ...OPEN_ITEMS.map((item) => item.note)]
}

/**
 * What may stay English on a Croatian screen, each with why. An entry with `selector` lets through
 * every text inside an element it matches, and one with `pattern` what the pattern matches. One
 * with `texts` lets a text of several words through wherever it stands in a line, and a one-word
 * text only as a whole line or inside a quoted typed name. A typed one-word text that is also an
 * English label, such as the folder Books, passes only in quotes. With `oneWordAnywhere` a one-word
 * text passes anywhere as written, as a category's name does in a list of them.
 */
export const ENGLISH_ALLOWED = [
  {
    name: 'identifier style',
    reason: 'A setting key, a slug or a file name in the identifier style is shown as the file stores it.',
    selector: '.identifier',
  },
  {
    name: 'stored value in quotes',
    reason: 'A Croatian sentence quotes a stored key, kind or slug as the file stores it, such as „categories” or „accountant”.',
    pattern: /„[\p{Ll}\d_.-]+”/gu,
  },
  {
    name: 'field names after polje',
    reason: 'A Croatian reason names a field after the word polje as the file stores it, such as polje amount.',
    pattern: FIELD_AFTER_POLJE,
  },
  {
    name: 'template placeholders',
    reason: 'A file name or mail template takes its placeholders as written, such as {client} and {number}.',
    pattern: PLACEHOLDER,
  },
  {
    name: 'language names and codes',
    reason: "Settings names each language in itself, so English is called English on a Croatian screen, and a client's mail language is a code such as en.",
    texts: ['English', 'en'],
  },
  {
    name: 'file and folder on the books card',
    reason: 'The books card names the file and its Drive folder as they are stored, such as a folder named Books.',
    selector: '[data-testid="books-file-name"], [data-testid="drive-file-place"] a',
  },
  {
    name: 'typed in the fake files',
    reason: 'Names, descriptions and notes the fake build stores, and the rows of its sample statement and bank export, are data and show as typed.',
    texts: TYPED_IN_FAKE_FILES,
  },
  {
    name: 'fake Google failures',
    reason: 'The fake Gmail and Drive fail a search or an upload with these answers, which stand in for the answer Google sends and a real failure shows as Google wrote it.',
    texts: [FAKE_SEARCH_FAILURE, FAKE_UPLOAD_FAILURE],
  },
  {
    name: 'typed by the checks',
    reason: 'What the flows of the visual check type, and the search a screen opens with, are data like anything a person types.',
    texts: ['Paper and pens', 'Train tickets, changed', 'Checked in the editor.', 'purchase, laptop', '€200 a month'],
  },
  {
    name: 'invoice mail in the client language',
    reason: 'An invoice mail leaves Kuna in the language the client reads, so its subject stays English for an English client on a Croatian screen.',
    pattern: invoiceMailSubject(),
  },
  {
    name: 'category labels Kuna did not seed',
    reason: 'A category with no label of its own shows its slug in words, and Kuna has Croatian names only for the slugs it seeds.',
    texts: unseededCategoryLabels(),
    oneWordAnywhere: true,
  },
  {
    name: 'ruleset research notes',
    reason: 'The notes of the rules and the open items are legal research prose, which the language plan keeps English.',
    texts: ruleNotes(),
  },
  {
    name: 'ruleset term labels',
    reason: 'The one open exception: the labels termLabel builds from the ruleset term keys stay English.',
    texts: ruleTermLabels(),
  },
]

const ALLOWED_SELECTORS = ENGLISH_ALLOWED.flatMap((entry) => (entry.selector === undefined ? [] : [entry.selector]))

function escaped(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const ALLOWED_TEXTS = [...new Set(ENGLISH_ALLOWED.flatMap((entry) => entry.texts ?? []))].filter((text) => text !== '')

const ONE_WORD_TEXTS = ALLOWED_TEXTS.filter((text) => wordsOf(text).length === 1)

const ONE_WORD_ANYWHERE = ENGLISH_ALLOWED.flatMap((entry) => (entry.oneWordAnywhere ? entry.texts : [])).filter((text) => wordsOf(text).length === 1)

/** The allowed one-word texts, which pass as a whole line. */
const ALLOWED_LINES = new Set(ONE_WORD_TEXTS.map((text) => text.toLowerCase()).filter((text) => !TYPED_LABELS.has(text)))

/**
 * The allowed patterns, the allowed texts of several words, the longest first so a longer name goes
 * before a shorter one inside it, the one-word texts in quotes, and those that pass anywhere.
 */
const ALLOWED_PATTERNS = [
  ...ENGLISH_ALLOWED.flatMap((entry) => (entry.pattern === undefined ? [] : [entry.pattern])),
  ...ALLOWED_TEXTS.filter((text) => wordsOf(text).length > 1)
    .sort((first, second) => second.length - first.length)
    .map((text) => new RegExp(`(?<![\\p{L}\\d])${escaped(text)}(?![\\p{L}\\d])`, 'giu')),
  ...ONE_WORD_TEXTS.map((text) => new RegExp(`(?<=„[^„”]*)(?<![\\p{L}\\d])${escaped(text)}(?![\\p{L}\\d])(?=[^„”]*”)`, 'giu')),
  ...ONE_WORD_ANYWHERE.map((text) => new RegExp(`(?<![\\p{L}\\d])${escaped(text)}(?![\\p{L}\\d])`, 'gu')),
]

/**
 * Runs in the page: each visible text, and each placeholder, label for a screen reader, tooltip and
 * the page title, with whether an allowed selector holds it.
 */
function textsOnScreen(selectors) {
  const texts = new Map()
  const add = (raw, allowed) => {
    const text = raw.replace(/\s+/g, ' ').trim()
    if (text !== '') texts.set(text, (texts.get(text) ?? true) && allowed)
  }
  const shown = (element) => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden'
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const parent = node.parentElement
    if (parent === null || parent.closest('script, style, noscript, template') !== null || !shown(parent)) continue
    add(
      node.textContent,
      selectors.some((selector) => parent.closest(selector) !== null),
    )
  }
  for (const element of document.querySelectorAll('[placeholder], [aria-label], [title], [alt]')) {
    if (!shown(element)) continue
    for (const name of ['placeholder', 'aria-label', 'title', 'alt']) {
      const value = element.getAttribute(name)
      if (value !== null) add(value, false)
    }
  }
  add(document.title, false)
  return [...texts].map(([text, allowed]) => ({ text, allowed }))
}

/** The English words of a text once every allowed text in it is taken out. */
export function englishIn(text) {
  if (ALLOWED_LINES.has(text.toLowerCase()) || !wordsOf(text).some((word) => ENGLISH_WORDS.has(word))) return []
  const left = ALLOWED_PATTERNS.reduce((rest, pattern) => rest.replace(pattern, ' '), text)
  return [...new Set(wordsOf(left).filter((word) => ENGLISH_WORDS.has(word)))]
}

/** Each text on the page that is English and no entry of `ENGLISH_ALLOWED` lets through, with its English words. */
export async function englishLeftOn(page) {
  const texts = await page.evaluate(textsOnScreen, ALLOWED_SELECTORS)
  return texts.flatMap(({ text, allowed }) => {
    const english = allowed ? [] : englishIn(text)
    return english.length === 0 ? [] : [`English left on a Croatian screen: "${text.length > 140 ? `${text.slice(0, 140)}…` : text}" (${english.join(', ')})`]
  })
}
