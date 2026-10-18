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
 * older `Categorise.gs`, or none once the constant is gone. The client IBANs come from the
 * export's `clients` tab, which the Apps Script reads with `requireClientIbans` when an enabled rule
 * tests `counterparty_is_client`, and the app with its workbook reader. The two lists must agree.
 *
 * A synthetic case follows: one rule, tried first, that files credits from a client. Its clients
 * are the export's tab, or two counterparty IBANs that sent the ledger money when the export has
 * none. Both engines run over every row with it, and both must refuse it without a clients tab.
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
import { RULE_COLUMNS } from '../src/features/rules/domain/rule.ts'
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

const { tabs: fileTabs, missingTabs: tabsTheExportLacks } = await readWorkbookFile(readFileSync(options.workbook))
let tabs = fileTabs
let missingTabs = tabsTheExportLacks
console.log(`loaded ${projectFiles.length} Apps Script files from ${options.scripts}`)

if (tabs.rules.length === 0) {
  if (!appsScriptDefines('rulesTabSeedRows')) {
    console.error('The export has no rules tab, and this Apps Script project no longer seeds one, so there is nothing to compare. Export the Sheet again.')
    process.exit(1)
  }
  const seeded = callAppsScript('rulesTabSeedRows')
  tabs = { ...tabs, rules: sheetRowsFromValues([vm.runInContext('RULE_COLUMNS', appsScript), ...seeded]) }
  missingTabs = missingTabs.filter((tab) => tab !== 'rules')
  console.log(`the export has no rules tab, so both engines read the ${seeded.length} rows rulesTabSeedRows builds`)
}

const spreadsheet = spreadsheetOver(tabs, missingTabs)
const ownIbans = Object.keys(callAppsScript('requireAccountIbans', spreadsheet))

if (options.statements !== undefined) {
  tabs = { ...tabs, ledger: withStatementSignals(tabs.ledger, options.statements) }
}

const workbook = workbookOver(tabs, missingTabs)
const cardAccounts = cardSettlementAccounts()
const settings = { ...workbook.settings, cardSettlementIbans: cardAccounts.app }
console.log(missingTabs.includes('clients') ? 'the export has no clients tab' : `the export has a clients tab with ${workbook.clients.length} clients`)

const exported = compareEngines(tabs, spreadsheet, workbook)
if (exported === null) {
  process.exit(1)
}
const contextWithoutCardAccount = categorisationContextOf({ ...workbook, settings: { ...settings, cardSettlementIbans: [] } })
const dependsOnCardAccount = workbook.transactions.filter(
  (transaction) => categorise(transaction, workbook.rules, contextWithoutCardAccount).ruleId !== categorise(transaction, workbook.rules, exported.context).ruleId,
).length
const unreadLedgerRows = workbook.problems.filter((problem) => problem.tab === 'ledger').length
console.log(
  `${workbook.transactions.length} ledger rows (${exported.withSignals} with signals, ${unreadLedgerRows} the app could not read), ` +
    `${exported.appsScriptRuleCount} enabled rules for Apps Script, ${workbook.rules.filter((rule) => rule.enabled).length} for the app, ` +
    `${exported.ruleProblems} rules rows the app refuses`,
)
console.log(`${exported.decidingRules} rules decide at least one row, ${exported.unmatched} rows match no rule`)
console.log(`the app's verdict equals the ledger's category on ${exported.agreesWithLedger} rows`)
console.log(`${dependsOnCardAccount} rows change verdict without the ${settings.cardSettlementIbans.length} card settlement accounts`)
console.log(`${exported.differences.length} differences`)
exported.differences.forEach((line) => console.log(`  ${line}`))

const synthetic = compareClientRule()
process.exitCode = exported.differences.length === 0 && exported.ruleProblems === 0 && exported.clientsAgree && cardAccounts.agree && synthetic ? 0 : 1

/**
 * Both engines over every ledger row of these tabs, each reading the rules, the clients and the
 * card settlement accounts its own way. Null when the Apps Script refuses the tabs.
 */
function compareEngines(caseTabs, caseSpreadsheet, caseWorkbook) {
  let appsScriptRules
  try {
    appsScriptRules = callAppsScript('readRules', caseSpreadsheet)
  } catch (error) {
    console.error(`Apps Script refuses the rules tab: ${redact(error.message)}`)
    return null
  }
  const ruleProblems = caseWorkbook.problems.filter((problem) => problem.tab === 'rules')
  ruleProblems.forEach((problem) => console.log(`app refuses rules row ${problem.sheetRow}: ${redact(problem.reason)}`))
  const clients = clientIbansOf(appsScriptRules, caseSpreadsheet, caseWorkbook)
  if (clients === null) {
    return null
  }
  const appsScriptContext = { ownIbans, clientIbans: clients.appsScript, cardSettlementIbans: cardAccounts.appsScript }
  const context = categorisationContextOf({ ...caseWorkbook, settings: { ...caseWorkbook.settings, cardSettlementIbans: cardAccounts.app } })
  const cellsByRow = new Map(caseTabs.ledger.map((row) => [row.sheetRow, row.cells]))
  const result = { context, withSignals: 0, agreesWithLedger: 0, unmatched: 0, differences: [], decidedBy: new Map(), appsScriptRuleCount: appsScriptRules.length, ruleProblems: ruleProblems.length, clientsAgree: clients.agree }
  const deciding = new Set()
  for (const transaction of caseWorkbook.transactions) {
    const signals = callAppsScript('ledgerRowSignals', cellsByRow.get(transaction.sheetRow), appsScriptContext)
    if (signals.txDomain || signals.txFamily || signals.txSubFamily) {
      result.withSignals += 1
    }
    const byAppsScript = callAppsScript('categoriseTransaction', signals, appsScriptRules)
    const byApp = categorise(transaction, caseWorkbook.rules, context)
    if (byApp.ruleId === null) {
      result.unmatched += 1
    } else {
      deciding.add(byApp.ruleId)
      result.decidedBy.set(byApp.ruleId, (result.decidedBy.get(byApp.ruleId) ?? 0) + 1)
    }
    if (byApp.category === transaction.category) {
      result.agreesWithLedger += 1
    }
    const appsScriptVerdict = `${String(byAppsScript.category).toLowerCase()} (${byAppsScript.flaggedBy}, ${byAppsScript.rule || 'no rule'})`
    const appVerdict = `${byApp.category} (${byApp.flaggedBy}, ${byApp.ruleId ?? 'no rule'})`
    if (appsScriptVerdict !== appVerdict) {
      result.differences.push(`row ${transaction.sheetRow}: Apps Script ${appsScriptVerdict}, app ${appVerdict}`)
    }
  }
  return { ...result, decidingRules: deciding.size }
}

/**
 * The client IBANs each side categorises with. The Apps Script reads the clients tab only when an
 * enabled rule tests counterparty_is_client, as `categorisationContext` does, and the app always
 * reads it. Null when the Apps Script refuses the tab.
 */
function clientIbansOf(appsScriptRules, caseSpreadsheet, caseWorkbook) {
  const app = [...categorisationContextOf(caseWorkbook).clientIbans].sort()
  const testsClients = appsScriptRules.some((rule) => rule.conditions.some((condition) => condition.column === 'counterparty_is_client'))
  if (!testsClients) {
    return { appsScript: [], app, agree: true }
  }
  let appsScript
  try {
    appsScript = [...new Set(callAppsScript('requireClientIbans', caseSpreadsheet))].sort()
  } catch (error) {
    console.error(`Apps Script refuses the clients tab: ${redact(error.message)}`)
    return null
  }
  const agree = JSON.stringify(appsScript) === JSON.stringify(app)
  console.log(`client IBANs from the clients tab: ${appsScript.length} for Apps Script, ${app.length} for the app` + (agree ? '' : ', and the two lists DIFFER'))
  return { appsScript, app, agree }
}

/**
 * A synthetic case on top of the export: a rule tried first that files credits from a client, run
 * by both engines over every row. Its clients are the export's clients tab, or, for an export
 * without one, two counterparty IBANs that sent the ledger money, kept in memory only. Then the
 * same rule without a clients tab, which both sides must refuse.
 */
function compareClientRule() {
  const category = workbook.categories.find((candidate) => candidate.roles.includes('revenue'))?.slug ?? workbook.categories[0]?.slug
  if (category === undefined) {
    console.log('synthetic counterparty_is_client case skipped: the export defines no category')
    return true
  }
  const ruleHeader = [...new Set([...RULE_COLUMNS, ...tabs.rules.flatMap((row) => Object.keys(row.cells))])]
  const firstOrder = Math.min(0, ...workbook.rules.map((rule) => rule.order)) - 100
  const syntheticRule = { sheetRow: Math.max(1, ...tabs.rules.map((row) => row.sheetRow)) + 1, cells: { rule: 'parity-synthetic-client', order: firstOrder, enabled: true, direction: 'credit', counterparty_is_client: true, category, confidence: 'rule' } }
  const clientRows = missingTabs.includes('clients') ? syntheticClientRows() : tabs.clients
  const withRule = { ...tabs, rules: [...tabs.rules, syntheticRule], clients: clientRows }
  const caseMissingTabs = missingTabs.filter((tab) => tab !== 'clients')
  console.log(`synthetic counterparty_is_client case: one rule filing client credits as ${category}, with ${new Set(clientRows.map((row) => row.cells.client)).size} clients ${missingTabs.includes('clients') ? 'made up from credit IBANs' : 'from the export'}`)
  const caseWorkbook = workbookOver(withRule, caseMissingTabs)
  const compared = compareEngines(withRule, spreadsheetOver(withRule, caseMissingTabs, ruleHeader), caseWorkbook)
  if (compared === null) {
    return false
  }
  const decided = compared.decidedBy.get('parity-synthetic-client') ?? 0
  console.log(`  the synthetic rule decides ${decided} rows, ${compared.differences.length} differences`)
  compared.differences.forEach((line) => console.log(`    ${line}`))

  const withoutClients = { ...withRule, clients: [] }
  const missing = [...caseMissingTabs, 'clients']
  const appRefuses = workbookOver(withoutClients, missing).problems.some((problem) => problem.tab === 'rules' && problem.reason.startsWith('parity-synthetic-client tests counterparty_is_client'))
  let appsScriptRefuses = false
  try {
    const rules = callAppsScript('readRules', spreadsheetOver(withoutClients, missing, ruleHeader))
    callAppsScript('requireClientIbans', spreadsheetOver(withoutClients, missing, ruleHeader))
    appsScriptRefuses = !rules.some((rule) => rule.id === 'parity-synthetic-client')
  } catch {
    appsScriptRefuses = true
  }
  console.log(`  without a clients tab: Apps Script ${appsScriptRefuses ? 'refuses' : 'ACCEPTS'} the rule, the app ${appRefuses ? 'refuses' : 'ACCEPTS'} it`)
  return decided > 0 && compared.differences.length === 0 && compared.ruleProblems === 0 && compared.clientsAgree && appRefuses && appsScriptRefuses
}

/** Two clients made from the counterparty IBANs of the first credits from outside the company, as `clients` tab rows. */
function syntheticClientRows() {
  const own = new Set(ownIbans.map((iban) => iban.replace(/\s+/g, '').toUpperCase()))
  const ibans = [...new Set(workbook.transactions.filter((transaction) => transaction.amount > 0 && transaction.counterpartyIban !== '' && !own.has(transaction.counterpartyIban)).map((transaction) => transaction.counterpartyIban))].slice(0, 2)
  return ibans.map((iban, index) => ({ sheetRow: index + 2, cells: { client: `synthetic-${index + 1}`, iban } }))
}

function workbookOver(caseTabs, caseMissingTabs) {
  return readWorkbook({
    meta: { id: 'parity', source: 'google', title: options.workbook, syncedAt: new Date().toISOString(), ledgerSheetId: null, lastExportedAt: null, unexportedSince: null, missingTabs: caseMissingTabs },
    ...caseTabs,
  })
}

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

/**
 * The few SpreadsheetApp reads the Apps Script readers make, over the tabs the export has. A tab
 * the export lacks stays missing. `rulesHeader` widens the rules tab's header, for a rule that
 * fills a column no exported row does.
 */
function spreadsheetOver(workbookTabs, absentTabs, rulesHeader = []) {
  const grids = workbookGrids(workbookTabs, workbookOver(workbookTabs, absentTabs))
  const sheets = new Map(
    Object.entries(grids)
      .filter(([tab]) => !absentTabs.includes(tab))
      .map(([tab, grid]) => {
        const header = tab === 'rules' ? [...new Set([...grid.header, ...rulesHeader])] : grid.header
        const rows = grid.rows.map((row) => header.map((name) => row[grid.header.indexOf(name)]))
        const cells = [header, ...rows].map((row) => header.map((_, column) => row[column] ?? ''))
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
