import { computed, ref, shallowRef, watch } from 'vue'
import type { Ref } from 'vue'

import { parseCivilDate, today } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { DateRange } from '../../../../shared/calendar/dateRange'
import { downloadFile } from '../../../../shared/files/downloadFile'
import { expectedInvoices } from '../../billingPlan/domain/expectedInvoices'
import { INVOICE_WRITES } from '../../receivables/application/invoiceWrites'
import { setSettings } from '../../settings/application/settingWrites'
import { NO_RECORDS, recordWithId } from '../../../../shared/storage/domain/recordsRead'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { useWorkbook } from '../../workbook/application/workbookStore'
import { NO_CLIENT_INVOICING } from '../../workbook/domain/workbook'
import type { Client, Invoice } from '../../workbook/domain/workbook'
import { filingDrive } from '../../documents/application/filingDrive'
import { locateFiling } from '../../documents/application/driveFiling'
import type { FilingDrive, FilingTarget } from '../../documents/application/driveFiling'
import { pathInWords } from '../../documents/domain/filingPath'
import { invoiceDrafts } from '../application/invoiceGoogle'
import { continueRun, runStepsOf } from '../application/invoiceRun'
import type { RegisterChange, RunPlan, RunStep } from '../application/invoiceRun'
import { newInvoiceDates } from '../domain/invoiceDates'
import { invoiceProblems, recipientOf } from '../domain/invoiceDocument'
import type { InvoiceDocument } from '../domain/invoiceDocument'
import { filingPathOf } from '../domain/invoiceFiling'
import { filledMail, gmailComposeUrl } from '../domain/invoiceMail'
import type { InvoiceMail } from '../domain/invoiceMail'
import { lineProblems, linesTotal } from '../domain/invoiceLine'
import { mergedLine, startingLines } from '../domain/invoiceLines'
import { invoiceLinesOf, registerInvoiceOf, reexportedInvoice } from '../domain/registerInvoice'
import { blankLine, draftOf, linesOf } from './lineDrafts'
import type { LineDraft } from './lineDrafts'
import { nextYearlyNumber, numberTaken } from '../../documents/domain/yearlyNumber'
import { mailDraftsOn, switchMailDrafts } from '../infrastructure/mailDraftSwitch'
import { invoiceDatesProblems } from '../../receivables/domain/invoiceGuards'
import { words as receivablesWords } from '../../receivables/domain/words'
import { words as receivablesScreenWords } from '../../receivables/presentation/words'
import { lineProblemsInWords } from '../domain/words'
import { words } from './words'

/** A new invoice, or the PDF and draft of one on the register made again. */
export type InvoiceRunMode = { readonly kind: 'new'; readonly client: string | null } | { readonly kind: 'reexport'; readonly id: RecordId }

export type RunStage =
  | { readonly kind: 'edit'; readonly message: string | null }
  | { readonly kind: 'checking' }
  /** A path folder is not in view and the person did not pick it: pick again, or make it. */
  | { readonly kind: 'hidden'; readonly segment: string; readonly path: string }
  | { readonly kind: 'ready'; readonly target: FilingTarget | null; readonly pdf: Uint8Array }
  | { readonly kind: 'running' }
  | { readonly kind: 'finished' }

async function pdfOf(document: InvoiceDocument): Promise<Uint8Array> {
  const [{ renderInvoicePdf }, { documentFonts }] = await Promise.all([import('../infrastructure/invoicePdf'), import('../../documents/infrastructure/documentFonts')])
  return renderInvoicePdf(document, await documentFonts())
}

/**
 * The invoice dialog's state and its run: the form, the preview PDF, the checks before anything
 * is written, and the steps that file the PDF, save the draft and write the register row.
 */
export function useInvoiceRun(mode: Ref<InvoiceRunMode>) {
  const store = useWorkbook()
  const workbook = computed(() => store.state.workbook)
  const google = computed(() => workbook.value?.source === 'drive')

  const client = ref('')
  const issued = ref('')
  const number = ref('')
  const numberTyped = ref(false)
  const due = ref('')
  const periodFrom = ref('')
  const periodTo = ref('')
  const lines = ref<LineDraft[]>([])
  const mailDraft = computed({ get: () => mailDraftsOn.value, set: switchMailDrafts })
  const stage = ref<RunStage>({ kind: 'edit', message: null })
  /** Whether Check was pressed since the form started, so each field's problem shows under it. */
  const tried = ref(false)
  const steps = ref<RunStep[]>([])
  const creatable = ref(new Set<string>())
  let plan: RunPlan | null = null

  const reexported = computed((): Invoice | null => {
    const current = mode.value
    return current.kind === 'reexport' ? (workbook.value?.invoices.find((invoice) => invoice.id === current.id) ?? null) : null
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
    tried.value = false
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
      lines.value = invoiceLinesOf(invoice).map(draftOf)
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
    const invoicing = chosenClient.value?.invoicing ?? NO_CLIENT_INVOICING
    lines.value = day === null ? [] : startingLines(expected.value, { slug: client.value, invoicing }, day).map(draftOf)
    if (lines.value.length === 0) lines.value = [blankLine()]
  }

  const issueDay = computed(() => parseCivilDate(issued.value))
  const settings = computed(() => workbook.value?.settings ?? null)
  const chosenClient = computed((): Client | null => workbook.value?.clients.find((candidate) => candidate.slug === client.value) ?? null)
  const templated = computed(() => (chosenClient.value?.invoicing.lines?.length ?? 0) > 0)

  const suggestedNumber = computed(() => {
    const day = issueDay.value
    const terms = settings.value
    return day === null || terms === null || workbook.value === null ? '' : nextYearlyNumber(terms.invoicing.numberPattern, day, workbook.value.invoices)
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
  const total = computed(() => linesTotal(parsedLines.value.filter((line) => !Number.isNaN(line.amount))))

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
      // A client reads the invoice, so a blank setting keeps the en-GB amounts rather than the language on this screen.
      numberLocale: terms.numberLocale || 'en-GB',
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

  /** What stops the invoice that is fixed on Invoicing, Clients or the invoice terms, listed above the form as it stands. */
  const problems = computed((): string[] => {
    const terms = settings.value
    if (terms === null || workbook.value === null) return [words.run.noWorkbook]
    const found = invoiceProblems(terms.invoicing, chosenClient.value)
    if (mailDraft.value && google.value && chosenClient.value !== null && chosenClient.value.invoicing.invoiceMail === '') {
      found.push(words.run.needsMail(chosenClient.value.name || chosenClient.value.slug))
    }
    return found
  })

  /** What is wrong with each field of the form, fixed on the form itself, or null. */
  const errors = computed(() => {
    const dueDay = parseCivilDate(due.value)
    const from = parseCivilDate(periodFrom.value)
    const to = parseCivilDate(periodTo.value)
    const order = invoiceDatesProblems(issueDay.value, dueDay, from, to)
    const typedNumber = number.value.trim()
    const taken = mode.value.kind === 'new' && numberTaken(number.value, workbook.value?.invoices ?? [])
    return {
      client: chosenClient.value === null ? receivablesScreenWords.dialog.clientError : null,
      issued: issueDay.value === null ? receivablesScreenWords.dialog.issuedError : null,
      number: typedNumber === '' ? words.run.numberError : taken ? receivablesWords.numberTaken(typedNumber) : null,
      due: dueDay === null ? receivablesScreenWords.dialog.issuedError : order.due === 'before-issue' ? receivablesScreenWords.dialog.dueBeforeIssue : null,
      period: from === null || to === null ? receivablesScreenWords.dialog.periodError : order.period === 'order' ? receivablesScreenWords.dialog.periodOrder : null,
      lines: lineProblemsInWords(lineProblems(parsedLines.value)).join(' ') || null,
    }
  })
  const fieldsValid = computed(() => Object.values(errors.value).every((error) => error === null))

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
            previewError.value = words.run.pdfFailed(failure instanceof Error ? failure.message : String(failure))
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

  async function pickInvoiceFolder(drive: FilingDrive): Promise<string | null> {
    const [picked] = await drive.pickFolders(null, words.run.pickRoot)
    if (picked === undefined) return null
    await store.write(words.run.folderSaved, (unit) => setSettings(unit, store.state.records?.settings ?? NO_RECORDS, [{ key: 'invoice_folder_id', value: picked.id }]))
    return picked.id
  }

  /** Why the store would refuse the register row now, as a newer file would, or null. Asked before the PDF or the draft is filed, so a refused run files nothing. */
  async function refusalOfChanges(): Promise<string | null> {
    const asked = await store.check(words.run.added, () => {})
    return asked.status === 'refused' ? asked.reason : null
  }

  /**
   * The checks before anything is written: a fresh read of the file, the number free on the
   * register, the path's folders found, and no file of the name in view. Run it from a click,
   * since a Google token may need a popup.
   */
  async function check(): Promise<void> {
    tried.value = true
    if (!fieldsValid.value) return
    stage.value = { kind: 'checking' }
    try {
      const refusedAtFirst = await refusalOfChanges()
      if (refusedAtFirst !== null) {
        stage.value = { kind: 'edit', message: refusedAtFirst }
        return
      }
      const drive = google.value ? await filingDrive() : null
      if (drive !== null) {
        await store.sync()
        if (store.state.error !== null) throw new Error(words.run.unreadable(store.state.error))
      }
      // A fresh read may have filed the number meanwhile, so the fields are checked again after it.
      if (problems.value.length > 0 || !fieldsValid.value || document.value === null || path.value === null) {
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
        stage.value = { kind: 'edit', message: words.run.noFolder }
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
          message: words.run.alreadyFiled(pathInWords(path.value)),
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

  function registerChange(): RegisterChange | null {
    const typed = registerInvoiceOf({ number: number.value, client: client.value, issued: issueDay.value!, due: dates.value!.due, deliveryPeriod: dates.value!.period, lines: parsedLines.value })
    const current = mode.value
    if (current.kind === 'new') return { before: null, after: typed }
    const before = recordWithId(store.state.records?.invoices ?? NO_RECORDS, current.id)?.record
    if (before === undefined) return null
    const after = reexportedInvoice(before, typed)
    return after === null ? null : { before, after }
  }

  async function writeRegister({ before, after }: RegisterChange): Promise<void> {
    await store.write(before === null ? words.run.added : words.run.saved, (unit) => (before === null ? unit.of(INVOICE_WRITES).add(after) : unit.of(INVOICE_WRITES).change(before, after)))
  }

  /** Makes the invoice: the steps run in order, each once. Run it from a click, since the Gmail grant may need a popup. */
  async function make(): Promise<void> {
    const ready = stage.value
    if (ready.kind !== 'ready' && plan === null) return
    if (plan === null) {
      const refused = await refusalOfChanges()
      if (refused !== null) {
        stage.value = { kind: 'edit', message: refused }
        return
      }
    }
    const wantsDraft = google.value && mailDraft.value
    stage.value = { kind: 'running' }
    let drafts = null
    let drive = null
    try {
      drafts = wantsDraft ? await invoiceDrafts() : null
      drive = google.value ? await filingDrive() : null
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

  /** One line for the whole amount, as the invoices so far have been made. */
  function mergeLines(): void {
    lines.value = [
      draftOf(
        mergedLine(
          parsedLines.value.filter((line) => !Number.isNaN(line.amount)),
          workbook.value?.invoices ?? [],
          client.value,
        ),
      ),
    ]
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
    templated,
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
    tried,
    errors,
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
