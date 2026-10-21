import { computed, ref, shallowRef, watch } from 'vue'
import type { Ref } from 'vue'

import { parseCivilDate, today } from '../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../shared/calendar/civilDate'
import type { DateRange } from '../../../shared/calendar/dateRange'
import { downloadFile } from '../../../shared/files/downloadFile'
import { amountOf } from '../../../shared/money/money'
import type { Money } from '../../../shared/money/money'
import { typedAmount } from '../../../shared/money/typedAmount'
import { expectedInvoices } from '../../billingPlan/domain/expectedInvoices'
import { INVOICE_ROWS, invoiceCellsOf } from '../../receivables/application/invoiceRows'
import { rowCellsOf } from '../../workbook/application/tabRowWrites'
import { useWorkbook } from '../../workbook/application/workbookStore'
import type { RowCells, TabRowsChange } from '../../workbook/domain/rowChanges'
import type { Client, Invoice } from '../../workbook/domain/workbook'
import { invoiceDrafts, invoiceDrive } from '../application/invoiceGoogle'
import { continueRun, locateFiling, runStepsOf } from '../application/invoiceRun'
import type { FilingTarget, InvoiceDrive, RunPlan, RunStep } from '../application/invoiceRun'
import { newInvoiceDates } from '../domain/invoiceDates'
import { invoiceProblems, recipientOf } from '../domain/invoiceDocument'
import type { InvoiceDocument } from '../domain/invoiceDocument'
import { filingPathOf, pathInWords } from '../domain/invoiceFiling'
import { filledMail, gmailComposeUrl } from '../domain/invoiceMail'
import type { InvoiceMail } from '../domain/invoiceMail'
import { linesTotal, plannedLines, registerItemOf } from '../domain/invoiceLines'
import type { InvoiceLine } from '../domain/invoiceLines'
import { nextInvoiceNumber, numberTaken } from '../domain/invoiceNumber'

/** A new invoice, or the PDF and draft of one on the register made again. */
export type InvoiceRunMode = { readonly kind: 'new'; readonly client: string | null } | { readonly kind: 'reexport'; readonly sheetRow: number }

/** A line as typed, the amount as text until it reads as money. */
export interface LineDraft {
  description: string
  amount: string
}

export type RunStage =
  | { readonly kind: 'edit'; readonly message: string | null }
  | { readonly kind: 'checking' }
  /** A path folder is not in view and the person did not pick it: pick again, or make it. */
  | { readonly kind: 'hidden'; readonly segment: string; readonly path: string }
  | { readonly kind: 'ready'; readonly target: FilingTarget | null; readonly pdf: Uint8Array }
  | { readonly kind: 'running' }
  | { readonly kind: 'finished' }

const DRAFT_PREFERENCE_KEY = 'ledgerboard.invoice-mail-draft'

function storedDraftPreference(): boolean {
  try {
    return localStorage.getItem(DRAFT_PREFERENCE_KEY) === 'true'
  } catch {
    return false
  }
}

function rememberDraftPreference(on: boolean): void {
  try {
    localStorage.setItem(DRAFT_PREFERENCE_KEY, String(on))
  } catch {
    // Not remembered on this device, so the switch starts off next time.
  }
}

function amountText(amount: Money): string {
  return amountOf(amount).toFixed(2)
}

function linesOf(drafts: readonly LineDraft[]): InvoiceLine[] {
  return drafts.map((draft) => ({ description: draft.description.trim(), amount: typedAmount(draft.amount) ?? (Number.NaN as Money) }))
}

async function pdfOf(document: InvoiceDocument): Promise<Uint8Array> {
  const [{ renderInvoicePdf }, { invoiceFonts }] = await Promise.all([import('../infrastructure/invoicePdf'), import('../infrastructure/invoiceFonts')])
  return renderInvoicePdf(document, await invoiceFonts())
}

/**
 * The invoice dialog's state and its run: the form, the preview PDF, the checks before anything
 * is written, and the steps that file the PDF, save the draft and write the register row.
 */
export function useInvoiceRun(mode: Ref<InvoiceRunMode>) {
  const store = useWorkbook()
  const workbook = computed(() => store.state.workbook)
  const google = computed(() => workbook.value?.source === 'google')

  const client = ref('')
  const issued = ref('')
  const number = ref('')
  const numberTyped = ref(false)
  const due = ref('')
  const periodFrom = ref('')
  const periodTo = ref('')
  const lines = ref<LineDraft[]>([])
  const mailDraft = ref(storedDraftPreference())
  const stage = ref<RunStage>({ kind: 'edit', message: null })
  const steps = ref<RunStep[]>([])
  const creatable = ref(new Set<string>())
  let plan: RunPlan | null = null

  watch(mailDraft, rememberDraftPreference)

  const reexported = computed((): Invoice | null => {
    const current = mode.value
    return current.kind === 'reexport' ? (workbook.value?.invoices.find((invoice) => invoice.sheetRow === current.sheetRow) ?? null) : null
  })

  const expected = computed(() => (workbook.value === null ? [] : expectedInvoices(workbook.value.billingPlan, workbook.value.invoices)))

  /** Starts the form over, as the dialog opens. */
  function reset(): void {
    const current = workbook.value
    stage.value = { kind: 'edit', message: null }
    steps.value = []
    creatable.value = new Set()
    plan = null
    numberTyped.value = false
    if (current === null) return
    const invoice = reexported.value
    if (invoice !== null) {
      client.value = invoice.client
      issued.value = invoice.issued
      number.value = invoice.number
      const fresh = newInvoiceDates(invoice.issued)
      due.value = invoice.due ?? fresh.due
      periodFrom.value = invoice.deliveryPeriod?.from ?? fresh.periodFrom
      periodTo.value = invoice.deliveryPeriod?.to ?? fresh.periodTo
      lines.value = [{ description: invoice.item, amount: amountText(invoice.amount) }]
      return
    }
    const asked = mode.value.kind === 'new' ? mode.value.client : null
    const fallback = current.settings.billing.client || expected.value[0]?.client || (current.clients.length === 1 ? current.clients[0]!.slug : '')
    client.value = asked ?? fallback
    issued.value = today()
    number.value = suggestedNumber.value
    issueChanged()
  }

  /** A new issue date moves the due date and the delivery period with it, and takes the plan's rows up to its month. */
  function issueChanged(): void {
    const day = parseCivilDate(issued.value)
    if (day !== null) {
      const fresh = newInvoiceDates(day)
      due.value = fresh.due
      periodFrom.value = fresh.periodFrom
      periodTo.value = fresh.periodTo
    }
    fillLines()
  }

  function fillLines(): void {
    const day = parseCivilDate(issued.value)
    lines.value = day === null ? [] : plannedLines(expected.value, client.value, day).map((line) => ({ description: line.description, amount: amountText(line.amount) }))
    if (lines.value.length === 0) lines.value = [{ description: '', amount: '' }]
  }

  const issueDay = computed(() => parseCivilDate(issued.value))
  const settings = computed(() => workbook.value?.settings ?? null)
  const chosenClient = computed((): Client | null => workbook.value?.clients.find((candidate) => candidate.slug === client.value) ?? null)

  const suggestedNumber = computed(() => {
    const day = issueDay.value
    const terms = settings.value
    return day === null || terms === null || workbook.value === null ? '' : nextInvoiceNumber(terms.invoicing.numberPattern, day, workbook.value.invoices)
  })
  watch(
    suggestedNumber,
    (suggested) => {
      if (!numberTyped.value && mode.value.kind === 'new') number.value = suggested
    },
    { flush: 'sync' },
  )

  function typeNumber(text: string): void {
    number.value = text
    numberTyped.value = true
  }

  /** The due date and delivery period as typed, or null while one does not read as a date. */
  const dates = computed((): { due: CivilDate; period: DateRange } | null => {
    const dueDay = parseCivilDate(due.value)
    const from = parseCivilDate(periodFrom.value)
    const to = parseCivilDate(periodTo.value)
    return dueDay === null || from === null || to === null ? null : { due: dueDay, period: { from, to } }
  })

  const parsedLines = computed(() => linesOf(lines.value))
  const total = computed(() => linesTotal(parsedLines.value))

  const document = computed((): InvoiceDocument | null => {
    const terms = settings.value
    const day = issueDay.value
    const chosen = chosenClient.value
    if (terms === null || day === null || chosen === null || dates.value === null) return null
    return {
      number: number.value.trim(),
      issued: day,
      due: dates.value.due,
      deliveryPeriod: dates.value.period,
      issuer: terms.invoicing,
      recipient: recipientOf(chosen),
      lines: parsedLines.value,
      total: total.value,
      currency: terms.currency,
      numberLocale: terms.numberLocale,
    }
  })

  const path = computed(() => {
    const terms = settings.value
    const day = issueDay.value
    return terms === null || day === null ? null : filingPathOf(terms.invoicing.filePath, { issued: day, client: client.value, number: number.value })
  })

  const mail = computed((): InvoiceMail | null => {
    const terms = settings.value
    const chosen = chosenClient.value
    const day = issueDay.value
    if (terms === null || chosen === null || day === null) return null
    const values = {
      number: number.value.trim(),
      issued: day,
      language: chosen.invoicing.mailLanguage,
      client: chosen.name || chosen.slug,
      company: terms.invoicing.name,
      signatory: terms.invoicing.signatory,
    }
    return { to: chosen.invoicing.invoiceMail, subject: filledMail(terms.invoicing.mailSubject, values), body: filledMail(terms.invoicing.mailBody, values) }
  })

  const problems = computed((): string[] => {
    const terms = settings.value
    const current = workbook.value
    if (terms === null || current === null) return ['No workbook is open.']
    const found = invoiceProblems(terms.invoicing, chosenClient.value, parsedLines.value)
    if (issueDay.value === null) found.push('The issue date is a date such as 2026-10-21.')
    const typedDates = dates.value
    if (typedDates === null) found.push('The due date and the delivery period are dates such as 2026-10-31.')
    else if (typedDates.period.to < typedDates.period.from) found.push('The delivery period ends after it starts.')
    else if (issueDay.value !== null && typedDates.due < issueDay.value) found.push('The due date is not before the issue date.')
    if (number.value.trim() === '') found.push('The invoice needs a number.')
    else if (mode.value.kind === 'new' && numberTaken(number.value, current.invoices)) found.push(`Invoice ${number.value.trim()} is already on the invoices tab, and each number is used once.`)
    if (mailDraft.value && google.value && chosenClient.value !== null && chosenClient.value.invoicing.invoiceMail === '') {
      found.push(`Workbook, Clients needs the invoice mail for ${chosenClient.value.name || chosenClient.value.slug}, or leave the mail draft off.`)
    }
    return found
  })

  /** The PDF of the form as it stands, for the preview link, drawn again a moment after each change. */
  const previewUrl = shallowRef<string | null>(null)
  const previewError = ref<string | null>(null)
  let previewTimer: ReturnType<typeof setTimeout> | undefined
  let previewRound = 0
  watch(
    document,
    (current) => {
      clearTimeout(previewTimer)
      if (current === null) return
      previewTimer = setTimeout(() => {
        const round = (previewRound += 1)
        pdfOf(current).then(
          (pdf) => {
            if (round !== previewRound) return
            if (previewUrl.value !== null) URL.revokeObjectURL(previewUrl.value)
            previewUrl.value = URL.createObjectURL(new Blob([pdf as BlobPart], { type: 'application/pdf' }))
            previewError.value = null
          },
          (failure: unknown) => {
            previewError.value = `The PDF could not be drawn: ${failure instanceof Error ? failure.message : String(failure)}`
          },
        )
      }, 300)
    },
    { deep: true },
  )

  function dispose(): void {
    clearTimeout(previewTimer)
    if (previewUrl.value !== null) URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = null
  }

  async function pickInvoiceFolder(drive: InvoiceDrive): Promise<string | null> {
    const [picked] = await drive.pickFolders(null, 'Pick the folder to file invoices in. The app files each invoice in folders by year and month inside it.')
    if (picked === undefined) return null
    const rows = store.state.snapshot?.settings ?? []
    const row = rows.find((candidate) => String(candidate.cells.key ?? '').trim().toLowerCase() === 'invoice_folder_id')
    await store.changeSettings([{ key: 'invoice_folder_id', value: picked.id, expected: row === undefined ? null : (row.cells.value ?? '') }])
    return picked.id
  }

  /**
   * The checks before anything is written: a fresh read of the Sheet, the number free on the
   * register, the path's folders found, and no file of the name in view. Run it from a click,
   * since a Google token may need a popup.
   */
  async function check(): Promise<void> {
    stage.value = { kind: 'checking' }
    try {
      const drive = google.value ? await invoiceDrive() : null
      if (drive !== null) {
        await store.sync()
        if (store.state.status === 'syncing' || store.state.writing) {
          throw new Error('Another sync or change of the Sheet was running, so the register was not read again. Check again once it finishes.')
        }
        if (store.state.error !== null) throw new Error(`The Sheet could not be read again: ${store.state.error}`)
      }
      if (problems.value.length > 0 || document.value === null || path.value === null) {
        stage.value = { kind: 'edit', message: null }
        return
      }
      // The PDF prints this number, so a later sync must not move the register row to the next one.
      numberTyped.value = true
      const pdf = await pdfOf(document.value)
      if (drive === null) {
        stage.value = { kind: 'ready', target: null, pdf }
        return
      }
      const rootId = settings.value!.invoicing.folderId || (await pickInvoiceFolder(drive))
      if (rootId === null) {
        stage.value = { kind: 'edit', message: 'No folder was picked, so the invoice has nowhere to be filed.' }
        return
      }
      const found = await locateFiling(drive, rootId, path.value, creatable.value)
      if (found.kind === 'hidden') {
        stage.value = { kind: 'hidden', segment: found.segment, path: found.path }
        return
      }
      if (found.target.existing !== null && mode.value.kind === 'new') {
        stage.value = {
          kind: 'edit',
          message: `${pathInWords(path.value)} is already in the invoice folder, and the app does not overwrite an invoice. Delete it in Drive first, or use Re-export on the invoice it belongs to.`,
        }
        return
      }
      stage.value = { kind: 'ready', target: found.target, pdf }
    } catch (failure) {
      stage.value = { kind: 'edit', message: failure instanceof Error ? failure.message : String(failure) }
    }
  }

  /** The person chose to make the folder the app could not see, so the checks go on with it to be made. */
  function createHiddenFolder(): Promise<void> {
    const current = stage.value
    if (current.kind === 'hidden') creatable.value = new Set([...creatable.value, current.path])
    return check()
  }

  function registerChange(): TabRowsChange | null {
    const day = issueDay.value!
    const due = dates.value!.due
    const period = dates.value!.period
    const cells = invoiceCellsOf({
      number: number.value,
      client: client.value,
      item: registerItemOf(parsedLines.value),
      amount: total.value,
      issued: day,
      due,
      periodFrom: period.from,
      periodTo: period.to,
    })
    const current = mode.value
    if (current.kind === 'new') return { added: [cells], changed: [], removed: [] }
    const row = store.state.snapshot?.invoices.find((candidate) => candidate.sheetRow === current.sheetRow)
    if (row === undefined) return null
    const before = rowCellsOf(row, INVOICE_ROWS.columns)
    const after: RowCells = { ...before, item: cells.item!, amount: cells.amount! }
    return String(after.item) === String(before.item) && Number(after.amount) === Number(before.amount)
      ? null
      : { added: [], changed: [{ sheetRow: row.sheetRow, before, after }], removed: [] }
  }

  async function writeRegister(change: TabRowsChange): Promise<void> {
    await store.changeRows(INVOICE_ROWS, change)
  }

  /** Makes the invoice: the steps run in order, each once. Run it from a click, since the Gmail grant may need a popup. */
  async function make(): Promise<void> {
    const ready = stage.value
    if (ready.kind !== 'ready' && plan === null) return
    const wantsDraft = google.value && mailDraft.value
    stage.value = { kind: 'running' }
    let drafts = null
    let drive = null
    try {
      drafts = wantsDraft ? await invoiceDrafts() : null
      drive = google.value ? await invoiceDrive() : null
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : String(failure)
      const next = steps.value.find((step) => step.status !== 'done')
      if (plan !== null && next !== undefined) {
        next.status = 'failed'
        next.note = message
        stage.value = { kind: 'finished' }
      } else {
        stage.value = { kind: 'edit', message }
      }
      return
    }
    if (plan === null && ready.kind === 'ready') {
      plan = {
        pdf: ready.pdf,
        fileName: path.value!.fileName,
        filing: ready.target,
        replace: mode.value.kind === 'reexport',
        draft: wantsDraft ? mail.value : null,
        register: registerChange(),
      }
      steps.value = runStepsOf(plan)
    }
    await continueRun(plan!, steps.value, {
      drive,
      drafts,
      download: (pdf, fileName) => downloadFile(pdf as BlobPart, fileName, 'application/pdf'),
      writeRegister,
    })
    stage.value = { kind: 'finished' }
  }

  function back(): void {
    stage.value = { kind: 'edit', message: null }
  }

  const failed = computed(() => steps.value.some((step) => step.status === 'failed'))

  function downloadPdf(): void {
    if (plan !== null) downloadFile(plan.pdf as BlobPart, plan.fileName, 'application/pdf')
  }

  const composeUrl = computed(() => (mail.value === null ? null : gmailComposeUrl(mail.value)))

  /** One line for the whole amount, named as the client's last invoice was, as the invoices so far have been made. */
  function mergeLines(): void {
    const previous = [...(workbook.value?.invoices ?? [])].filter((invoice) => invoice.client === client.value).sort((upper, lower) => lower.issued.localeCompare(upper.issued))[0]
    const description = previous?.item || lines.value[0]?.description || ''
    lines.value = [{ description, amount: amountText(total.value) }]
  }

  return {
    google,
    client,
    issued,
    number,
    due,
    periodFrom,
    periodTo,
    lines,
    mailDraft,
    stage,
    steps,
    reexported,
    suggestedNumber,
    dates,
    total,
    path,
    mail,
    problems,
    previewUrl,
    previewError,
    failed,
    composeUrl,
    reset,
    fillLines,
    issueChanged,
    typeNumber,
    mergeLines,
    check,
    createHiddenFolder,
    back,
    make,
    downloadPdf,
    dispose,
  }
}
