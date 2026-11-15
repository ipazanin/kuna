import { fileOnDrive } from '../../documents/application/driveFiling'
import type { FilingDrive, FilingTarget } from '../../documents/application/driveFiling'
import type { Invoice } from '../../workbook/domain/workbook'
import type { InvoiceMail } from '../domain/invoiceMail'
import { words } from './words'

export interface MailDrafts {
  /** Saves a draft with the PDF attached. It is never sent. */
  create(mail: InvoiceMail, attachment: { readonly fileName: string; readonly pdf: Uint8Array }): Promise<void>
}

export type RunStepKind = 'file' | 'download' | 'draft' | 'register'

export interface RunStep {
  readonly kind: RunStepKind
  status: 'waiting' | 'done' | 'failed'
  /** What the step did or why it failed, for the person. */
  note: string
}

/** What the run writes to the register: a new invoice, or one changed from what the app read. */
export interface RegisterChange {
  /** Null for a new invoice. */
  readonly before: Invoice | null
  readonly after: Invoice
}

/** What one run writes, worked out before anything is written. */
export interface RunPlan {
  readonly pdf: Uint8Array
  readonly fileName: string
  /** Null when there is no Drive to file in, as with a workbook kept in this browser. */
  filing: FilingTarget | null
  /** A re-export gives the PDF of the same name new contents. */
  readonly replace: boolean
  /** The draft's mail. Null when the person left the draft off. */
  readonly draft: InvoiceMail | null
  /** The register change, or null when a re-export changed nothing the register holds. */
  readonly register: RegisterChange | null
}

export interface RunPorts {
  readonly drive: FilingDrive | null
  readonly drafts: MailDrafts | null
  download(pdf: Uint8Array, fileName: string): void
  writeRegister(change: RegisterChange): Promise<void>
}

/**
 * The steps in the order they run: file the PDF, or hand it to the browser to save, then the draft,
 * then the register row. Without the draft the PDF is also saved, so it can be attached by hand.
 */
export function runStepsOf(plan: RunPlan): RunStep[] {
  const kinds: RunStepKind[] = [
    ...(plan.filing === null ? [] : ['file' as const]),
    ...(plan.filing === null || plan.draft === null ? ['download' as const] : []),
    ...(plan.draft === null ? [] : ['draft' as const]),
    ...(plan.register === null ? [] : ['register' as const]),
  ]
  return kinds.map((kind) => ({ kind, status: 'waiting', note: '' }))
}

const PDF_MIME_TYPE = 'application/pdf'

async function fileThePdf(plan: RunPlan, drive: FilingDrive): Promise<string> {
  // The folders made so far stay in the plan, so a retry does not make them again.
  const filing = { target: plan.filing! }
  try {
    const filed = await fileOnDrive(drive, filing, { name: plan.fileName, content: plan.pdf, mimeType: PDF_MIME_TYPE }, plan.replace)
    switch (filed) {
      case 'refused':
        throw new Error(words.steps.alreadyFiled(plan.fileName))
      case 'replaced':
        return words.steps.replaced(plan.fileName)
      case 'filed-over-unseen':
        return words.steps.filedOverUnseen(plan.fileName)
      case 'filed':
        return words.steps.filed(plan.fileName)
    }
  } finally {
    plan.filing = filing.target
  }
}

/**
 * Runs every step not done yet, in order, and stops at the first that fails, which keeps its
 * reason. Calling it again retries from there, so a step that went through is never repeated.
 */
export async function continueRun(plan: RunPlan, steps: RunStep[], ports: RunPorts): Promise<void> {
  for (const step of steps) {
    if (step.status === 'done') continue
    try {
      step.note = await runStep(step.kind, plan, ports)
      step.status = 'done'
    } catch (failure) {
      step.status = 'failed'
      step.note = failure instanceof Error ? failure.message : String(failure)
      return
    }
  }
}

async function runStep(kind: RunStepKind, plan: RunPlan, ports: RunPorts): Promise<string> {
  switch (kind) {
    case 'file':
      if (ports.drive === null) throw new Error(words.steps.noDrive)
      return fileThePdf(plan, ports.drive)
    case 'download':
      ports.download(plan.pdf, plan.fileName)
      return words.steps.downloaded(plan.fileName)
    case 'draft':
      if (ports.drafts === null || plan.draft === null) throw new Error(words.steps.noGmail)
      await ports.drafts.create(plan.draft, { fileName: plan.fileName, pdf: plan.pdf })
      return `${words.steps.draftSaved(plan.draft.to)}${plan.replace ? words.steps.deleteEarlierDraft : ''}`
    case 'register':
      await ports.writeRegister(plan.register!)
      return plan.replace ? words.steps.registerChanged : words.steps.registerAdded
  }
}
