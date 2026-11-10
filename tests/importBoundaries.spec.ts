import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { parse } from 'vue/compiler-sfc'

import { PACK_ROLES } from '../src/apps/company/packs/hr-doo/domain/packRoles'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

interface Import {
  /** The importing file and line, such as `src/main.ts:7`. */
  readonly at: string
  readonly from: string
  readonly specifier: string
  /** The imported file from the repo root, or null for a package. */
  readonly target: string | null
  /** An `import()` call rather than a declaration. */
  readonly dynamic: boolean
  /** `import type` or `export type`, which loads nothing. */
  readonly typeOnly: boolean
}

/** Every import in `src`, with type-only ones, `export ... from` and dynamic imports, each relative one resolved to its file. */
function importsInSource(): Import[] {
  const files = readdirSync(join(ROOT, 'src'), { recursive: true, encoding: 'utf8' }).filter((name) => /\.(ts|vue)$/.test(name))
  return files.flatMap((name) => {
    const path = join(ROOT, 'src', name)
    const from = relative(ROOT, path)
    return scriptsOf(path).flatMap(({ code, firstLine }) =>
      ts.preProcessFile(code, true, true).importedFiles.map((imported) => ({
        at: `${from}:${firstLine + code.slice(0, imported.pos).split('\n').length - 1}`,
        from,
        specifier: imported.fileName,
        target: imported.fileName.startsWith('.') ? resolvedFile(dirname(path), imported.fileName) : null,
        dynamic: /\bimport\s*\(\s*$/.test(code.slice(0, imported.pos)),
        typeOnly: /\b(?:import|export)\s+type\b[^'"]*$/.test(code.slice(0, imported.pos)),
      })),
    )
  })
}

/** The code of a file, or of each script block of a single-file component, with the line it starts on. */
function scriptsOf(path: string): { readonly code: string; readonly firstLine: number }[] {
  const text = readFileSync(path, 'utf8')
  if (!path.endsWith('.vue')) {
    return [{ code: text, firstLine: 1 }]
  }
  const { descriptor } = parse(text, { filename: path })
  return [descriptor.script, descriptor.scriptSetup].flatMap((block) => (block === null ? [] : [{ code: block.content, firstLine: block.loc.start.line }]))
}

function resolvedFile(directory: string, specifier: string): string {
  const base = resolve(directory, specifier)
  const found = [base, `${base}.ts`, `${base}.vue`, join(base, 'index.ts')].find((candidate) => existsSync(candidate) && statSync(candidate).isFile())
  return relative(ROOT, found ?? base)
}

const IMPORTS = importsInSource()

const SOURCE_FILES = readdirSync(join(ROOT, 'src'), { recursive: true, encoding: 'utf8' })
  .filter((name) => /\.(ts|vue)$/.test(name))
  .map((name) => join('src', name))

/** Each line of `src`, templates included, that holds the pattern, as `file:line`, outside the files `allowed` keeps. */
function linesHolding(pattern: RegExp, allowed: (file: string) => boolean): string[] {
  return SOURCE_FILES.filter((file) => !allowed(file)).flatMap((file) =>
    readFileSync(join(ROOT, file), 'utf8')
      .split('\n')
      .flatMap((line, index) => (pattern.test(line) ? [`${file}:${index + 1}`] : [])),
  )
}

/** Each line of `src` that holds the text in single or double quotes, as `file:line`, but the lines `allowed` keeps. */
function linesQuoting(text: string, allowed: (file: string, line: string) => boolean): string[] {
  const quoted = new RegExp(`(['"])${text}\\1`)
  return SOURCE_FILES.flatMap((file) =>
    readFileSync(join(ROOT, file), 'utf8')
      .split('\n')
      .flatMap((line, index) => (quoted.test(line) && !allowed(file, line) ? [`${file}:${index + 1}`] : [])),
  )
}

const STARTING_CATEGORIES_FILE = 'src/apps/company/packs/hr-doo/preset/domain/startingCategories.ts'

/** A line of the Croatian names of the categories new books start with, where a category may share its class's name. */
function seededName(file: string, line: string): boolean {
  return file === 'src/apps/company/workbook/domain/words.ts' && /^\s*\['[a-z-]+', '[^']*'\],$/.test(line)
}

/** The app a file belongs to, such as `company` for `src/apps/company/`, or null outside the apps. */
function appOf(file: string): string | null {
  return /^src\/apps\/([^/]+)\//.exec(file)?.[1] ?? null
}

/** The pack folder a file belongs to, such as `src/apps/company/packs/hr-doo/`, or null outside the packs. */
function packOf(file: string): string | null {
  return /^src\/apps\/[^/]+\/packs\/[^/]+\//.exec(file)?.[0] ?? null
}

/** The file through which main.ts installs an app, and which installs the app's pack. */
function isAppEntry(file: string): boolean {
  return /^src\/apps\/[^/]+\/app\.ts$/.test(file)
}

/** Domain code: a `domain` folder, and a pack's ruleset outside its presentation, which holds the law the domain computes with. */
function isDomain(file: string): boolean {
  return /\/domain\//.test(file) || (packOf(file) !== null && /\/ruleset\//.test(file) && !/\/presentation\//.test(file))
}

const DOMAIN_SHARED = [
  'src/shared/storage/domain/',
  'src/shared/calendar/',
  'src/shared/money/',
  'src/shared/text/',
  'src/shared/charts/swatches.ts',
  'src/shared/categorising/domain/',
  'src/shared/mail-filing/domain/',
  'src/shared/recipes/domain/',
  'src/shared/privacy/domain/',
]

/** Where the books are kept: the kernel's document storage and each app's workbook. */
function isStorage(file: string): boolean {
  return file.startsWith('src/shared/storage/') || /^src\/apps\/[^/]+\/workbook\//.test(file)
}

function isStorageAdapter(file: string): boolean {
  return isStorage(file) && /\/infrastructure\//.test(file)
}

/** The spreadsheet adapter's mapping of kinds to tabs, which a pack's own mappings build on. */
const SPREADSHEET_MAPPING = ['spreadsheetTab.ts', 'packTabs.ts', 'workbookTemplate.ts', 'cellFormats.ts'].map((file) => `src/apps/company/workbook/infrastructure/${file}`)

/** The files that wire adapters to the application: each workbook store, the invoice run's Google ports, the model adapters, the saved chat, the chat's attached files and its read of a PDF's pages, and the page's exchange rates. */
const ADAPTER_WIRING = [
  'src/apps/company/workbook/application/workbookStore.ts',
  'src/apps/company/invoicing/application/invoiceGoogle.ts',
  'src/apps/loans/workbook/application/loansStore.ts',
  'src/apps/investments/workbook/application/investmentsStore.ts',
  'src/apps/assets/workbook/application/assetsStore.ts',
  'src/apps/spending/workbook/application/spendingStore.ts',
  'src/shared/ai/application/modelAccess.ts',
  'src/shared/ai/application/savedChat.ts',
  'src/shared/ai/application/attachmentReads.ts',
  'src/shared/ai/application/chatFiles.ts',
  'src/shared/rates/application/pageRates.ts',
]

/** What presentation in the shared kernel still imports from an adapter, a list that only shrinks. */
const SHARED_PRESENTATION_ON_ADAPTERS = [
  'src/shared/secrets/presentation/pageSecrets.ts -> src/shared/secrets/infrastructure/browserSecrets.ts',
  'src/shared/secrets/presentation/secretsStep.ts -> src/shared/secrets/infrastructure/browserSecrets.ts',
  'src/shared/secrets/presentation/secretsStep.ts -> src/shared/secrets/infrastructure/fake/fakeSecretsDrive.ts',
  'src/shared/secrets/presentation/secretsStep.ts -> src/shared/secrets/infrastructure/googleSecretsDrive.ts',
  'src/shared/storage/presentation/BooksFileCard.vue -> src/shared/storage/infrastructure/documentFormat.ts',
  'src/shared/storage/presentation/BooksFileCard.vue -> src/shared/storage/infrastructure/documentRecordStorage.ts',
  'src/shared/storage/presentation/FirstRunFolderStep.vue -> src/shared/storage/infrastructure/documentFormat.ts',
  'src/shared/storage/presentation/MoveIntoKunaDialog.vue -> src/shared/storage/infrastructure/documentFormat.ts',
  'src/shared/storage/presentation/MoveIntoKunaDialog.vue -> src/shared/storage/infrastructure/documentRecordStorage.ts',
  'src/shared/storage/presentation/exportAppFile.ts -> src/shared/storage/infrastructure/documentFormat.ts',
  'src/shared/storage/presentation/exportAppFile.ts -> src/shared/storage/infrastructure/documentRecordStorage.ts',
  'src/shared/storage/presentation/fileFirstRun.ts -> src/shared/storage/infrastructure/documentFormat.ts',
  'src/shared/storage/presentation/fileFirstRun.ts -> src/shared/storage/infrastructure/documentRecordStorage.ts',
  'src/shared/storage/presentation/resumeFileLookup.ts -> src/shared/storage/infrastructure/documentFormat.ts',
  'src/shared/storage/presentation/resumeFileLookup.ts -> src/shared/storage/infrastructure/documentRecordStorage.ts',
  'src/shared/storage/presentation/useDriveFilePlace.ts -> src/shared/storage/infrastructure/documentFormat.ts',
  'src/shared/storage/presentation/useDriveFilePlace.ts -> src/shared/storage/infrastructure/documentRecordStorage.ts',
  'src/shared/storage/presentation/useFindFile.ts -> src/shared/storage/infrastructure/documentFormat.ts',
  'src/shared/storage/presentation/useFindFile.ts -> src/shared/storage/infrastructure/documentRecordStorage.ts',
]

/** What the chat's operations still import from presentation beside its words, a list that only shrinks. */
const OPERATIONS_ON_PRESENTATION = [
  'src/apps/assets/assistant/operations/assetsOperations.ts -> src/apps/assets/asset/presentation/assetTexts.ts',
  'src/apps/assets/assistant/operations/assetsOperations.ts -> src/apps/assets/asset/presentation/loanChoices.ts',
  'src/apps/assets/assistant/operations/assetsOperations.ts -> src/apps/assets/asset/presentation/valuationTexts.ts',
  'src/apps/assets/assistant/operations/assetsOperations.ts -> src/apps/assets/values/presentation/assetsOnDay.ts',
  'src/apps/assets/assistant/operations/proposalLines.ts -> src/apps/assets/values/presentation/assetsOnDay.ts',
  'src/apps/company/assistant/operations/proposalLines.ts -> src/apps/company/settings/presentation/vatTreatmentLabel.ts',
  'src/apps/company/packs/hr-doo/assistant/operations/packOperations.ts -> src/apps/company/packs/hr-doo/presentation/editorColumns.ts',
  'src/apps/company/packs/hr-doo/assistant/operations/packOperations.ts -> src/apps/company/settings/presentation/factTabColumns.ts',
  'src/apps/investments/assistant/operations/importOperations.ts -> src/apps/investments/imports/presentation/dryRunLines.ts',
  'src/apps/investments/assistant/operations/importOperations.ts -> src/apps/investments/imports/presentation/importChoices.ts',
  'src/apps/investments/assistant/operations/importOperations.ts -> src/apps/investments/mail/presentation/mailReaderForm.ts',
  'src/apps/investments/assistant/operations/pricesOperations.ts -> src/apps/investments/overview/presentation/investmentLinks.ts',
  'src/apps/investments/assistant/operations/pricesOperations.ts -> src/apps/investments/prices/presentation/runProblem.ts',
  'src/apps/investments/assistant/operations/proposalLines.ts -> src/apps/investments/holdings/presentation/holdingText.ts',
  'src/apps/investments/assistant/operations/proposalLines.ts -> src/apps/investments/overview/presentation/checkLines.ts',
  'src/apps/investments/assistant/operations/proposalLines.ts -> src/apps/investments/tax/presentation/surtaxCityChoices.ts',
  'src/apps/loans/assistant/operations/loansOperations.ts -> src/apps/loans/bankLoans/presentation/savedTries.ts',
  'src/apps/loans/assistant/operations/offerOperation.ts -> src/apps/loans/scenarios/presentation/offerName.ts',
  'src/apps/loans/assistant/operations/proposalLines.ts -> src/apps/loans/informalLoans/presentation/informalLoanView.ts',
  'src/apps/loans/assistant/operations/proposalLines.ts -> src/apps/loans/scenarios/presentation/scenarioComparison.ts',
  'src/apps/loans/assistant/operations/proposalLines.ts -> src/apps/loans/scenarios/presentation/scenariosView.ts',
]

/** Each app's published file and the one file of another app that may import it. */
const PUBLISHED: Readonly<Record<string, readonly string[]>> = {
  'src/apps/loans/facts.ts': ['src/apps/assets/loans/application/assetLoans.ts'],
}

/** Whether an import reads another app's published file from a file allowed to. */
function readsPublished(entry: Import): boolean {
  return entry.target !== null && (PUBLISHED[entry.target] ?? []).includes(entry.from)
}

/** The shared modules that each hold one capability two apps use, which stay apart so none grows into another. */
const CAPABILITIES = ['src/shared/rates/', 'src/shared/categorising/', 'src/shared/mail-filing/', 'src/shared/privacy/']

function capabilityOf(file: string): string | null {
  return CAPABILITIES.find((folder) => file.startsWith(folder)) ?? null
}

/** Data of the fake build, which only the fake build loads. */
function isFakeSeed(file: string): boolean {
  return /\/infrastructure\/fake\//.test(file)
}

/** The files that declare a branded type. Adding one here is a decision the `kuna-domain` skill describes. */
const BRAND_OWNERS = [
  'src/apps/company/owner-share/domain/ownerShare.ts',
  'src/apps/company/workbook/domain/packPart.ts',
  'src/apps/investments/workbook/domain/mixGroup.ts',
  'src/apps/loans/bankLoans/domain/yearlyRate.ts',
  'src/shared/calendar/civilDate.ts',
  'src/shared/calendar/monthKey.ts',
  'src/shared/money/accountMoney.ts',
  'src/shared/money/currencyCode.ts',
  'src/shared/money/decimal.ts',
  'src/shared/money/money.ts',
  'src/shared/money/percent.ts',
  'src/shared/storage/domain/recordId.ts',
  'src/shared/storage/domain/recordKind.ts',
]

/** What the figure digest still reads from presentation. A figure belongs in domain, so this list only shrinks. */
const FIGURES_IN_PRESENTATION = [
  'src/apps/assets/home/presentation/assetsHubFigures.ts',
  'src/apps/assets/values/presentation/assetsOnDay.ts',
  'src/apps/company/overview/presentation/waitingForYou.ts',
  'src/apps/investments/home/presentation/investmentsHubFigures.ts',
  'src/apps/investments/performance/presentation/performanceLinks.ts',
  'src/apps/loans/bankLoans/presentation/bankLoanView.ts',
  'src/apps/loans/bankLoans/presentation/savedTries.ts',
  'src/apps/loans/informalLoans/presentation/informalLoanView.ts',
  'src/apps/loans/scenarios/presentation/scenariosView.ts',
  'src/apps/spending/analytics/presentation/spendingFigures.ts',
  'src/apps/spending/home/presentation/spendingHubFigures.ts',
]

function digestImportsFromPresentation(): string[] {
  const digest = readFileSync(join(ROOT, 'scripts/figure-digest.mjs'), 'utf8')
  const imported = ts.preProcessFile(digest, true, true).importedFiles.filter((file) => file.fileName.startsWith('.'))
  return [...new Set(imported.map((file) => resolvedFile(join(ROOT, 'scripts'), file.fileName)))].filter((file) => /\/presentation\//.test(file)).sort()
}

function broken(rule: (entry: Import) => boolean): string[] {
  return IMPORTS.filter((entry) => !rule(entry)).map((entry) => `${entry.at} imports ${entry.specifier}`)
}

/** The files nothing in `src` imports: the page's entry and Vite's type declarations. */
const UNIMPORTED = ['src/env.d.ts', 'src/main.ts']

describe('import boundaries', () => {
  it('reads the imports it checks', () => {
    for (const app of ['company', 'loans', 'investments', 'assets', 'spending']) {
      expect(IMPORTS.some((entry) => entry.from === 'src/main.ts' && entry.dynamic && entry.target === `src/apps/${app}/app.ts`)).toBe(true)
      expect(IMPORTS.some((entry) => appOf(entry.from) === app && entry.target?.startsWith(`src/apps/${app}/`))).toBe(true)
    }
    expect(IMPORTS.some((entry) => entry.from === 'src/apps/company/app.ts' && !entry.dynamic && entry.target === 'src/apps/company/packs/hr-doo/hrDooPack.ts')).toBe(true)
    expect(IMPORTS.some((entry) => entry.from.endsWith('.vue') && entry.target?.includes('/domain/'))).toBe(true)
    expect(IMPORTS.filter((entry) => entry.target !== null && !existsSync(join(ROOT, entry.target))).map((entry) => entry.at)).toEqual([])
  })

  it('leaves no file in src that nothing imports, so deleted code takes its last piece with it', () => {
    const imported = new Set(IMPORTS.flatMap((entry) => (entry.target === null ? [] : [entry.target])))
    expect(SOURCE_FILES.filter((file) => !imported.has(file)).sort()).toEqual([...UNIMPORTED].sort())
  })

  it('keeps the shared kernel off the shell and the apps', () => {
    expect(broken((entry) => !entry.from.startsWith('src/shared/') || entry.target === null || entry.target.startsWith('src/shared/'))).toEqual([])
  })

  it("keeps the kernel's storage off the chat's contracts in shared/app, which build on the storage", () => {
    expect(broken((entry) => !/^src\/shared\/storage\/(domain|application)\//.test(entry.from) || entry.target === null || !entry.target.startsWith('src/shared/app/'))).toEqual([])
  })

  it('keeps the shell off the apps, which main.ts installs by importing each app.ts when it starts', () => {
    expect(
      broken((entry) => entry.target === null || !entry.target.startsWith('src/apps/') || appOf(entry.from) !== null || (entry.from === 'src/main.ts' && entry.dynamic && isAppEntry(entry.target))),
    ).toEqual([])
  })

  it("keeps each app to its own folder and the shared kernel, so no app imports another but for another app's published file", () => {
    expect(
      broken((entry) => appOf(entry.from) === null || entry.target === null || entry.target.startsWith('src/shared/') || appOf(entry.target) === appOf(entry.from) || readsPublished(entry)),
    ).toEqual([])
  })

  it('reads each published file from the reader it lists, and keeps the published file to its own app and the shared kernel', () => {
    for (const [published, readers] of Object.entries(PUBLISHED)) {
      for (const reader of readers) {
        expect(existsSync(join(ROOT, reader)), `${reader} is missing`).toBe(true)
        expect(IMPORTS.some((entry) => entry.from === reader && entry.target === published)).toBe(true)
      }
      expect(broken((entry) => entry.from !== published || entry.target === null || entry.target.startsWith('src/shared/') || appOf(entry.target) === appOf(published))).toEqual([])
    }
  })

  it("keeps an app's code outside its packs free of pack code, which only its app.ts installs", () => {
    expect(broken((entry) => appOf(entry.from) === null || packOf(entry.from) !== null || isAppEntry(entry.from) || entry.target === null || packOf(entry.target) === null)).toEqual([])
  })

  it('keeps a pack to its own folder, its app and the shared kernel', () => {
    expect(
      broken(
        (entry) =>
          packOf(entry.from) === null ||
          entry.target === null ||
          entry.target.startsWith('src/shared/') ||
          packOf(entry.target) === packOf(entry.from) ||
          (appOf(entry.target) === appOf(entry.from) && packOf(entry.target) === null),
      ),
    ).toEqual([])
  })

  it("keeps domain code to its own app's domain code, the record types, the rules core and the calendar, money and text helpers", () => {
    expect(
      broken(
        (entry) =>
          !isDomain(entry.from) ||
          (entry.target !== null && ((isDomain(entry.target) && appOf(entry.target) === appOf(entry.from)) || DOMAIN_SHARED.some((folder) => entry.target!.startsWith(folder)))),
      ),
    ).toEqual([])
  })

  it('leaves row numbers to the spreadsheet adapter, and record ids to their maker', () => {
    expect(linesHolding(/\bsheetRow\b/, () => false).length).toBeGreaterThan(0)
    expect(linesHolding(/\bsheetRows?\b/, isStorageAdapter)).toEqual([])
    expect(linesHolding(/\bas RecordId\b/, (file) => file === 'src/shared/storage/domain/recordId.ts')).toEqual([])
  })

  it("keeps every app's settings rows in the shared settings module", () => {
    expect(linesHolding(/\b(interface|type) SettingRow\b/, (file) => file === 'src/shared/storage/domain/settingRows.ts')).toEqual([])
  })

  it('declares a brand only in the files that own one', () => {
    const brand = /\breadonly __[a-zA-Z]+\??:/
    expect(linesHolding(brand, (file) => BRAND_OWNERS.includes(file))).toEqual([])
    expect(BRAND_OWNERS.filter((file) => !brand.test(readFileSync(join(ROOT, file), 'utf8')))).toEqual([])
  })

  it('reads the figures of the digest from domain code, but for a list that only shrinks', () => {
    expect(digestImportsFromPresentation()).toEqual(FIGURES_IN_PRESENTATION)
  })

  it("keeps the storage adapters inside the kernel's storage and the app's workbook, which its app.ts wires in and a pack maps its tabs with", () => {
    expect(
      broken(
        (entry) =>
          entry.target === null ||
          !isStorageAdapter(entry.target) ||
          isStorage(entry.from) ||
          isAppEntry(entry.from) ||
          isFakeSeed(entry.from) ||
          (packOf(entry.from) !== null && /\/infrastructure\//.test(entry.from) && SPREADSHEET_MAPPING.includes(entry.target)),
      ),
    ).toEqual([])
  })

  it('keeps each shared capability module off the others', () => {
    expect(broken((entry) => capabilityOf(entry.from) === null || entry.target === null || capabilityOf(entry.target) === null || capabilityOf(entry.target) === capabilityOf(entry.from))).toEqual([])
  })

  it('leaves the names of the secrets, in this browser and on Drive, to the secrets module alone', () => {
    expect(linesHolding(/kuna\.secret|kuna-secrets|kuna-investments-keys-|kuna\.price-vendor-key/, (file) => file.startsWith('src/shared/secrets/'))).toEqual([])
  })

  it("leaves the app's hidden folder on Drive to the secrets adapter, the Google client and the fake Drive", () => {
    expect(
      linesHolding(
        /\bAPP_DATA_FOLDER\b|tokenFor\('drive\.appdata'/,
        (file) => file.startsWith('src/shared/secrets/') || file.startsWith('src/shared/google/') || file.startsWith('src/shared/storage/infrastructure/fake/'),
      ),
    ).toEqual([])
  })

  it('leaves the AI hosts and the AI SDKs to the AI adapters', () => {
    expect(
      linesHolding(
        /api\.anthropic\.com|api\.openai\.com|openrouter\.ai|generativelanguage\.googleapis\.com|api\.mistral\.ai|api\.groq\.com|localhost:11434|localhost:1234/,
        (file) => file.startsWith('src/shared/ai/infrastructure/') || file === 'src/shared/ai/domain/providerPresets.ts',
      ),
    ).toEqual([])
    expect(broken((entry) => !/^(@anthropic-ai\/sdk|openai)(\/|$)/.test(entry.specifier) || entry.from.startsWith('src/shared/ai/infrastructure/'))).toEqual([])
  })

  it('keeps the AI module off Google, the stores, their writes and the sync, so it can write nothing', () => {
    expect(
      broken(
        (entry) =>
          !entry.from.startsWith('src/shared/ai/') ||
          entry.target === null ||
          !['src/shared/google/', 'src/shared/storage/application/', 'src/shared/storage/presentation/', 'src/shared/sync/'].some((folder) => entry.target!.startsWith(folder)),
      ),
    ).toEqual([])
  })

  it('keeps the AI module off the same folders through every file it loads as it starts', () => {
    const loaded = new Set(IMPORTS.filter((entry) => entry.from.startsWith('src/shared/ai/')).map((entry) => entry.from))
    for (const file of loaded) {
      for (const entry of IMPORTS) {
        if (entry.from === file && entry.target !== null && !entry.dynamic && !entry.typeOnly) loaded.add(entry.target)
      }
    }
    expect(
      [...loaded].filter((file) => ['src/shared/google/', 'src/shared/storage/application/', 'src/shared/storage/presentation/', 'src/shared/sync/'].some((folder) => file.startsWith(folder))),
    ).toEqual([])
  })

  it("reaches an app's acceptance in the AI module only from the proposal card, so no tool writes without a person's Accept", () => {
    const reaching = linesHolding(/\.acceptance\b|\bacceptance\?*\./, (file) => !file.startsWith('src/shared/ai/') || file === 'src/shared/ai/presentation/ProposalCard.vue')
    expect(reaching).toEqual([])
    expect(linesHolding(/\.acceptance\b|\bacceptance\?*\./, (file) => file !== 'src/shared/ai/presentation/ProposalCard.vue')).not.toEqual([])
  })

  it('reads a key in the AI module only through its one door', () => {
    expect(linesHolding(/\bstoredSecret(Changes)?\b/, (file) => !file.startsWith('src/shared/ai/') || file === 'src/shared/ai/application/modelAccess.ts')).toEqual([])
  })

  it('offers no model the web, and names the suffix that would turn it on only where a typed model is refused for it', () => {
    expect(linesHolding(/web_search|web_fetch|:online\b/, (file) => file === 'src/shared/ai/domain/providerPresets.ts')).toEqual([])
  })

  describe('what a chat can reach', () => {
    const CHAT_CODE = (file: string): boolean =>
      [
        'src/shared/ai/application/catalogue.ts',
        'src/shared/ai/application/chatTools.ts',
        'src/shared/ai/application/chatReads.ts',
        'src/shared/ai/application/chatProposals.ts',
        'src/shared/ai/application/runChatTurn.ts',
        'src/shared/ai/domain/chatText.ts',
        'src/shared/ai/domain/chatRefs.ts',
        'src/shared/privacy/domain/pseudonyms.ts',
        'src/shared/privacy/domain/names.ts',
        'src/shared/privacy/domain/maskIdentifiers.ts',
        'src/shared/privacy/domain/exposure.ts',
        'src/shared/app/assistantReader.ts',
        'src/shared/app/assistantOperations.ts',
      ].includes(file) || /^src\/apps\/.*\/assistant\/[^/]+\.ts$/.test(file)

    it('covers the catalogue, the tools and every app with a page', () => {
      expect(SOURCE_FILES.filter((file) => /\/assistant\//.test(file) && /\.ts$/.test(file) && !/words\.ts$/.test(file)).length).toBeGreaterThanOrEqual(6)
    })

    it('loads no secrets, no Google, no store and no books through anything it imports', () => {
      const loaded = new Set(SOURCE_FILES.filter(CHAT_CODE))
      for (const file of loaded) {
        for (const entry of IMPORTS) {
          if (entry.from === file && entry.target !== null && !entry.dynamic && !entry.typeOnly) loaded.add(entry.target)
        }
      }
      const outOfReach = /^src\/shared\/(secrets|google|sync)\/|^src\/shared\/storage\/(application|infrastructure|presentation)\/|^src\/apps\/.*\/(application|infrastructure)\//
      expect([...loaded].filter((file) => outOfReach.test(file))).toEqual([])
    })

    it('reads a store only through what an app hands in, and imports no writes', () => {
      const assistantFiles = SOURCE_FILES.filter((file) => /^src\/apps\/.*\/assistant\/[^/]+\.ts$/.test(file))
      expect(IMPORTS.filter((entry) => assistantFiles.includes(entry.from) && entry.target !== null && /Writes\.ts$|useRecordWrites|recordWrites|Store\.ts$/.test(entry.target))).toEqual([])
    })

    it('reaches an accept only from the card, and no tool holds one', () => {
      const declares = (file: string): boolean =>
        file === 'src/shared/app/appContribution.ts' ||
        file === 'src/shared/app/assistantOperations.ts' ||
        file === 'src/shared/app/browserFileCards.ts' ||
        file === 'src/shell/assistant/kunaAssistant.ts' ||
        /^src\/apps\/[^/]+\/(app\.ts$|assistant\/)/.test(file)
      expect(linesHolding(/\bacceptance\b|\.accept\(/, (file) => file === 'src/shared/ai/presentation/ProposalCard.vue' || declares(file))).toEqual([])
      expect(linesHolding(/\.accept\(/, (file) => file === 'src/shared/ai/presentation/ProposalCard.vue')).toEqual([])
    })

    it('lets only the operations write, off secrets and Google, and leaves the readers to read', () => {
      const operations = SOURCE_FILES.filter((file) => /^src\/apps\/.*\/assistant\/operations\//.test(file))
      expect(operations.length).toBeGreaterThanOrEqual(2)
      expect(IMPORTS.filter((entry) => operations.includes(entry.from) && entry.target !== null && /^src\/shared\/(secrets|google|sync)\//.test(entry.target))).toEqual([])
      expect(IMPORTS.filter((entry) => CHAT_CODE(entry.from) && !entry.dynamic && entry.target !== null && entry.target.includes('/assistant/operations/'))).toEqual([])
    })

    it('keeps the operations off presentation but its words, so a check a dialog makes is a domain function the chat calls too, but for a list that only shrinks', () => {
      const found = IMPORTS.filter(
        (entry) => /\/assistant\/operations\//.test(entry.from) && entry.target !== null && /\/presentation\//.test(entry.target) && !/[wW]ords\.ts$/.test(entry.target),
      ).map((entry) => `${entry.from} -> ${entry.target}`)
      expect([...new Set(found)].sort()).toEqual(OPERATIONS_ON_PRESENTATION)
    })

    it("sets this device's settings only through what Kuna's assistant hands in, so neither reaches a secret or Google beyond the auto sync switch and the page's sync", () => {
      expect(
        IMPORTS.filter((entry) => entry.from === 'src/shell/assistant/kunaOperations.ts' && entry.target !== null && !entry.typeOnly && /^src\/shared\/(secrets|google|sync|ai)\//.test(entry.target)),
      ).toEqual([])
      const handedIn = [
        'src/shared/ai/presentation/chatDock.ts',
        'src/shared/ai/presentation/chatSession.ts',
        'src/shared/app/kunaStart.ts',
        'src/shared/sync/infrastructure/autoSyncSwitch.ts',
        'src/shared/sync/presentation/pageSync.ts',
        'src/shared/text/language.ts',
        'src/shared/theme/theme.ts',
        'src/shared/ui/cardCollapse.ts',
        'src/shell/routing/appRegistry.ts',
        'src/shell/ui/sidebarLayout.ts',
        'src/shell/assistant/kunaOperations.ts',
        'src/shell/assistant/words.ts',
      ]
      expect(
        IMPORTS.filter((entry) => entry.from === 'src/shell/assistant/kunaAssistant.ts' && !entry.typeOnly && !handedIn.includes(entry.target ?? entry.specifier)).map((entry) => entry.at),
      ).toEqual([])
    })

    it('touches no browser storage, no cookie and no network itself', () => {
      expect(linesHolding(/localStorage|sessionStorage|indexedDB|\bDexie\b|from 'dexie'|document\.cookie|\bfetch\(|XMLHttpRequest/, (file) => !CHAT_CODE(file))).toEqual([])
    })

    it('spells the issues page in one place, with no draft in its address and no GitHub token anywhere', () => {
      expect(linesHolding(/github\.com\/ipazanin\/kuna\/issues/, (file) => file === 'src/shared/ai/application/catalogue.ts')).toEqual([])
      expect(linesHolding(/KUNA_ISSUES_ADDRESS\s*[+`]|issues\/new/, () => false)).toEqual([])
      expect(linesHolding(/api\.github\.com|ghp_|github_pat_/, () => false)).toEqual([])
    })

    it('keeps the chat out of the first load, so without a key its code never loads', () => {
      const staticImports = IMPORTS.filter((entry) => !entry.dynamic && !entry.typeOnly && entry.target === 'src/shared/ai/presentation/ChatPanel.vue')
      expect(staticImports).toEqual([])
    })
  })

  it('reads the secrets imports the cases above check', () => {
    expect(IMPORTS.some((entry) => appOf(entry.from) !== null && entry.target?.startsWith('src/shared/secrets/'))).toBe(true)
  })

  it('keeps application code off infrastructure, but for the files that wire the adapters', () => {
    expect(broken((entry) => !/\/application\//.test(entry.from) || entry.target === null || !/\/infrastructure\//.test(entry.target) || ADAPTER_WIRING.includes(entry.from))).toEqual([])
  })

  it('keeps presentation in the shared kernel off infrastructure, but for a list that only shrinks', () => {
    const found = IMPORTS.filter((entry) => /^src\/shared\/.*\/presentation\//.test(entry.from) && entry.target !== null && /\/infrastructure\//.test(entry.target)).map(
      (entry) => `${entry.from} -> ${entry.target}`,
    )
    expect([...new Set(found)].sort()).toEqual(SHARED_PRESENTATION_ON_ADAPTERS)
  })

  it("keeps a pack's ruleset off its preset, which reads the ruleset", () => {
    expect(SOURCE_FILES.some((file) => /\/packs\/[^/]+\/preset\//.test(file))).toBe(true)
    expect(broken((entry) => !/\/packs\/[^/]+\/ruleset\//.test(entry.from) || entry.target === null || !/\/packs\/[^/]+\/preset\//.test(entry.target))).toEqual([])
  })

  it("keeps a pack's preset to domain code outside its presentation", () => {
    expect(SOURCE_FILES.filter((file) => /\/packs\/[^/]+\/preset\//.test(file) && !/\/preset\/(domain|presentation)\//.test(file))).toEqual([])
  })

  it('spells the new tax class roles in the pack roles alone, where other-income is also a category of the starting set', () => {
    const roleHome = (file: string): boolean => file === 'src/apps/company/packs/hr-doo/domain/packRoles.ts' || isFakeSeed(file)
    for (const role of ['deductible-cost', 'outside-profit', 'vehicle-insurance-interest-tax-and-fees']) {
      expect(linesQuoting(role, roleHome), role).toEqual([])
    }
    expect(linesQuoting('other-income', (file, line) => roleHome(file) || (file === STARTING_CATEGORIES_FILE && /^\s*\['other-income', \[/.test(line)) || seededName(file, line))).toEqual([])
  })

  it('names no pack role in the company app outside its packs, revenue aside, which receivables also spell', () => {
    const packRoles = Object.values(PACK_ROLES).filter((role) => role !== 'revenue')
    // The same word as another concept core knows: a VAT treatment, and a kind of record a slug names.
    const otherMeaning = (file: string, line: string): boolean =>
      ((file === 'src/apps/company/workbook/domain/vatTreatment.ts' || file === 'src/apps/company/settings/presentation/words.ts') && /'representation'/.test(line)) ||
      (file === 'src/apps/company/workbook/domain/words.ts' && /^export type SlugNoun = /.test(line))
    const coreFile = (file: string): boolean => file.startsWith('src/apps/company/') && packOf(file) === null && !isFakeSeed(file)
    const found = packRoles.flatMap((role) => linesQuoting(role, (file, line) => !coreFile(file) || seededName(file, line) || otherMeaning(file, line)).map((line) => `${line} ${role}`))
    expect(found).toEqual([])
  })
})
