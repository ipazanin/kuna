/**
 * Runs the Apps Script categoriser and the app's rules engine over every ledger row of an xlsx
 * export, each with the row's stored signals and the export's `rules` tab, and fails on any row
 * where the two disagree on the category, on who decided it, or on which rule did. Nothing is
 * written anywhere.
 *
 *   npm run parity:rules -- --workbook <export.xlsx> [--statements <folder of camt xml>] [--scripts <Apps Script folder>]
 *
 * The Apps Script side loads every `.gs` file of the project into `node:vm`, so it reads the rules
 * with `readRules`, turns a ledger row into signals with `ledgerRowSignals` and categorises with
 * `categoriseTransaction`, all as written. An export without a `rules` tab gets the rows
 * `rulesTabSeedRows` would seed, read by both sides, while the project still has that function.
 * `--statements` fills the signal columns of ledger rows that have none from the archived camt
 * files, parsed by `parseCamtStatement` and matched by account and bank reference, for an export
 * taken before the columns existed.
 *
 * Each side reads the card settlement accounts from the `card_settlement_ibans` setting with its
 * own reader. An export without a settings tab gives both the `CARD_SETTLEMENT_IBAN` constant of an
 * older `Categorise.gs`, or none once the constant is gone.
 *
 * The output names rows by sheet row, rule id and category only. The export holds real bank data,
 * so keep it outside the repository.
 */

import { readFileSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import vm from 'node:vm'
import { JSDOM } from 'jsdom'

import { categorise } from '../src/features/rules/domain/categorise.ts'
import { categorisationContextOf } from '../src/features/rules/domain/transactionFacts.ts'
import { readWorkbookFile, workbookGrids } from '../src/features/workbook/infrastructure/workbookFile.ts'
import { readWorkbook } from '../src/features/workbook/infrastructure/workbookReader.ts'
import { sheetRowsFromValues } from '../src/features/workbook/infrastructure/workbookSnapshot.ts'

const SIGNAL_COLUMNS = ['purpose', 'tx_domain', 'tx_family', 'tx_sub_family', 'creditor_reference', 'instructed_currency', 'review_reasons']

const { values: options } = parseArgs({
  options: {
    workbook: { type: 'string' },
    statements: { type: 'string' },
    scripts: { type: 'string', default: join(homedir(), 'gdrive/work/dss/dss-finance/shadow-accounting/scripts') },
  },
})
if (options.workbook === undefined) {
  console.error('Usage: npm run parity:rules -- --workbook <export.xlsx> [--statements <folder of camt xml>] [--scripts <Apps Script folder>]')
  process.exit(2)
}

const appsScript = vm.createContext({ XmlService: xmlService() })
const projectFiles = readdirSync(options.scripts).filter((name) => name.endsWith('.gs')).sort()
vm.runInContext(projectFiles.map((name) => readFileSync(join(options.scripts, name), 'utf8')).join('\n;\n'), appsScript, { filename: 'project.gs' })
/** Calls an Apps Script function by name, with arguments handed over through the context. */
function callAppsScript(name, ...args) {
  appsScript.__args = args
  return vm.runInContext(`${name}(...__args)`, appsScript)
}

const { tabs: fileTabs } = await readWorkbookFile(readFileSync(options.workbook))
let tabs = fileTabs
console.log(`loaded ${projectFiles.length} Apps Script files from ${options.scripts}`)

if (tabs.rules.length === 0) {
  if (!appsScriptDefines('rulesTabSeedRows')) {
    console.error('The export has no rules tab, and this Apps Script project no longer seeds one, so there is nothing to compare. Export the Sheet again.')
    process.exit(1)
  }
  const seeded = callAppsScript('rulesTabSeedRows')
  tabs = { ...tabs, rules: sheetRowsFromValues([vm.runInContext('RULE_COLUMNS', appsScript), ...seeded]) }
  console.log(`the export has no rules tab, so both engines read the ${seeded.length} rows rulesTabSeedRows builds`)
}

const spreadsheet = spreadsheetOver(tabs)
const ownIbans = Object.keys(callAppsScript('requireAccountIbans', spreadsheet))

if (options.statements !== undefined) {
  tabs = { ...tabs, ledger: withStatementSignals(tabs.ledger, options.statements) }
}

const workbook = readWorkbook({
  meta: { id: 'parity', source: 'excel', title: options.workbook, syncedAt: new Date().toISOString(), ledgerSheetId: null, lastExportedAt: null, unexportedSince: null },
  ...tabs,
})
let appsScriptRules
try {
  appsScriptRules = callAppsScript('readRules', spreadsheet)
} catch (error) {
  console.error(`Apps Script refuses the rules tab: ${redact(error.message)}`)
  process.exit(1)
}
const ruleProblems = workbook.problems.filter((problem) => problem.tab === 'rules')
ruleProblems.forEach((problem) => console.log(`app refuses rules row ${problem.sheetRow}: ${redact(problem.reason)}`))

const cardAccounts = cardSettlementAccounts()
const appsScriptContext = { ownIbans, cardSettlementIbans: cardAccounts.appsScript }
const settings = { ...workbook.settings, cardSettlementIbans: cardAccounts.app }
const context = categorisationContextOf({ accounts: workbook.accounts, settings })
const contextWithoutCardAccount = categorisationContextOf({ accounts: workbook.accounts, settings: { ...settings, cardSettlementIbans: [] } })
const cellsByRow = new Map(tabs.ledger.map((row) => [row.sheetRow, row.cells]))

let withSignals = 0
let agreesWithLedger = 0
let dependsOnCardAccount = 0
let unmatched = 0
const differences = []
const decidingRules = new Set()
for (const transaction of workbook.transactions) {
  const record = cellsByRow.get(transaction.sheetRow)
  const signals = callAppsScript('ledgerRowSignals', record, appsScriptContext)
  if (signals.txDomain || signals.txFamily || signals.txSubFamily) {
    withSignals += 1
  }
  const byAppsScript = callAppsScript('categoriseTransaction', signals, appsScriptRules)
  const byApp = categorise(transaction, workbook.rules, context)
  if (byApp.ruleId === null) {
    unmatched += 1
  } else {
    decidingRules.add(byApp.ruleId)
  }
  if (byApp.category === transaction.category) {
    agreesWithLedger += 1
  }
  const withoutCardAccount = categorise(transaction, workbook.rules, contextWithoutCardAccount)
  if (withoutCardAccount.ruleId !== byApp.ruleId) {
    dependsOnCardAccount += 1
  }
  const appsScriptVerdict = `${String(byAppsScript.category).toLowerCase()} (${byAppsScript.flaggedBy}, ${byAppsScript.rule || 'no rule'})`
  const appVerdict = `${byApp.category} (${byApp.flaggedBy}, ${byApp.ruleId ?? 'no rule'})`
  if (appsScriptVerdict !== appVerdict) {
    differences.push(`row ${transaction.sheetRow}: Apps Script ${appsScriptVerdict}, app ${appVerdict}`)
  }
}

const unreadLedgerRows = workbook.problems.filter((problem) => problem.tab === 'ledger').length
console.log(
  `${workbook.transactions.length} ledger rows (${withSignals} with signals, ${unreadLedgerRows} the app could not read), ` +
    `${appsScriptRules.length} enabled rules for Apps Script, ${workbook.rules.filter((rule) => rule.enabled).length} for the app, ` +
    `${ruleProblems.length} rules rows the app refuses`,
)
console.log(`${decidingRules.size} rules decide at least one row, ${unmatched} rows match no rule`)
console.log(`the app's verdict equals the ledger's category on ${agreesWithLedger} rows`)
console.log(`${dependsOnCardAccount} rows change verdict without the ${settings.cardSettlementIbans.length} card settlement accounts`)
console.log(`${differences.length} differences`)
differences.forEach((line) => console.log(`  ${line}`))
process.exitCode = differences.length === 0 && ruleProblems.length === 0 && cardAccounts.agree ? 0 : 1

/** Each side's card settlement accounts, from the settings tab, or from the old constant for an export without one. */
function cardSettlementAccounts() {
  if (tabs.settings.length === 0) {
    const constant = appsScriptDefines('CARD_SETTLEMENT_IBAN') ? [vm.runInContext('CARD_SETTLEMENT_IBAN', appsScript)] : []
    console.log(
      constant.length === 0
        ? 'the export has no settings tab and Categorise.gs names no CARD_SETTLEMENT_IBAN, so neither side knows a card settlement account'
        : 'the export has no settings tab, so both sides take the card settlement account from CARD_SETTLEMENT_IBAN in Categorise.gs',
    )
    return { appsScript: constant, app: constant, agree: true }
  }
  let appsScriptIbans
  try {
    appsScriptIbans = [...callAppsScript('requireCardSettlementIbans', spreadsheet)]
  } catch (error) {
    console.log(`Apps Script refuses the settings tab: ${redact(error.message)}`)
    return { appsScript: [], app: workbook.settings.cardSettlementIbans, agree: false }
  }
  const agree = JSON.stringify(appsScriptIbans) === JSON.stringify(workbook.settings.cardSettlementIbans)
  console.log(
    `card_settlement_ibans from the settings tab: ${appsScriptIbans.length} for Apps Script, ${workbook.settings.cardSettlementIbans.length} for the app` +
      (agree ? '' : ', and the two lists DIFFER'),
  )
  return { appsScript: appsScriptIbans, app: workbook.settings.cardSettlementIbans, agree }
}

function appsScriptDefines(name) {
  return vm.runInContext(`typeof ${name} !== 'undefined'`, appsScript)
}

/** Fills the signal columns of ledger rows that have none, from the camt files matched by account and bank reference. */
function withStatementSignals(ledgerRows, folder) {
  const accountNames = callAppsScript('requireAccountIbans', spreadsheet)
  const signalsByEntry = new Map()
  const files = readdirSync(folder).filter((name) => name.endsWith('.xml')).sort()
  for (const name of files) {
    const statement = callAppsScript('parseCamtStatement', readFileSync(join(folder, name), 'utf8'), accountNames)
    for (const entry of statement.rows) {
      if (entry.reference) {
        signalsByEntry.set(entryKey(statement.account, entry.reference), signalCellsOf(entry))
      }
    }
  }
  let filled = 0
  const rows = ledgerRows.map((row) => {
    const signals = signalsByEntry.get(entryKey(row.cells.account, row.cells.reference))
    if (signals === undefined || SIGNAL_COLUMNS.some((column) => row.cells[column] !== undefined)) {
      return row
    }
    filled += 1
    const stated = Object.fromEntries(Object.entries(signals).filter(([, cell]) => cell !== '' && cell !== null && cell !== undefined))
    return { ...row, cells: { ...row.cells, ...stated } }
  })
  console.log(`${files.length} camt files, ${signalsByEntry.size} entries, signals filled on ${filled} ledger rows`)
  return rows
}

/** The signal columns of the ledger row `ledgerRowFor` would write for a parsed camt entry. */
function signalCellsOf(entry) {
  const { cells } = callAppsScript('ledgerRowFor', entry, { category: '', flaggedBy: '' })
  const columns = vm.runInContext('LEDGER_TAB_COLUMNS', appsScript)
  return Object.fromEntries(SIGNAL_COLUMNS.map((column) => [column, cells[columns.indexOf(column)]]))
}

function entryKey(account, reference) {
  return `${String(account ?? '').trim().toLowerCase()}\u0000${String(reference ?? '').trim()}`
}

/** The few SpreadsheetApp reads the Apps Script readers make, over the tabs the export has. A tab it lacks stays missing. */
function spreadsheetOver(workbookTabs) {
  const grids = workbookGrids(workbookTabs, readWorkbook({ meta: { id: 'grid', source: 'excel', title: '', syncedAt: '', ledgerSheetId: null, lastExportedAt: null, unexportedSince: null }, ...workbookTabs }))
  const sheets = new Map(
    Object.entries(grids).filter(([tab]) => workbookTabs[tab].length > 0).map(([tab, grid]) => {
      const cells = [grid.header, ...grid.rows].map((row) => grid.header.map((_, column) => row[column] ?? ''))
      return [tab, sheetOver(cells)]
    }),
  )
  return { getSheetByName: (name) => sheets.get(name) ?? null }
}

function sheetOver(cells) {
  const width = cells[0]?.length ?? 0
  return {
    getLastRow: () => cells.length,
    getLastColumn: () => width,
    getMaxRows: () => cells.length,
    getRange: (row, column, rowCount = 1, columnCount = 1) => ({
      getValues: () => cells.slice(row - 1, row - 1 + rowCount).map((cellsOfRow) => cellsOfRow.slice(column - 1, column - 1 + columnCount)),
    }),
  }
}

/** Apps Script's XmlService, as far as `parseCamtStatement` uses it, over jsdom's DOMParser. */
function xmlService() {
  const parser = new new JSDOM('').window.DOMParser()
  const wrap = (node) => ({
    getNamespace: () => ({ uri: node.namespaceURI }),
    getChild: (name, namespace) => {
      const child = [...node.children].find((candidate) => candidate.localName === name && candidate.namespaceURI === namespace.uri)
      return child === undefined ? null : wrap(child)
    },
    getChildren: (name, namespace) =>
      [...node.children].filter((candidate) => candidate.localName === name && candidate.namespaceURI === namespace.uri).map(wrap),
    getText: () => node.textContent,
    getAttribute: (name) => {
      const attribute = node.getAttribute(name)
      return attribute === null ? null : { getValue: () => attribute }
    },
  })
  return {
    parse: (xml) => {
      const document = parser.parseFromString(xml, 'application/xml')
      return { getRootElement: () => wrap(document.documentElement) }
    },
  }
}

function redact(text) {
  return String(text).replace(/\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/g, '<IBAN>')
}
