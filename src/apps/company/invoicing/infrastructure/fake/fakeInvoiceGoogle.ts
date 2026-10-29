import type { DriveEntry, InvoiceDrive, MailDrafts } from '../../application/invoiceRun'
import type { InvoiceMail } from '../../domain/invoiceMail'

/** The folder the fake build's Picker offers as the invoice folder. */
export const FAKE_INVOICE_FOLDER: DriveEntry = { id: 'fake-invoice-folder', name: 'invoices', folder: true }

interface FakeNode extends DriveEntry {
  readonly parentId: string | null
  /** Whether the app's token can see it: made by the app or picked once. */
  visible: boolean
  pdf?: Uint8Array
}

export interface FakeInvoiceGoogle {
  readonly drive: InvoiceDrive
  readonly drafts: MailDrafts
  readonly nodes: readonly FakeNode[]
  readonly savedDrafts: readonly { readonly mail: InvoiceMail; readonly fileName: string }[]
}

/**
 * A Drive and a Gmail held in memory. The invoice folder holds a folder for this year and last
 * year with every month inside, made by another app, so the app's token cannot see them until
 * they are picked, as with folders the invoice generator made. `pick` plays the Picker: it gets
 * the folders a person would see and returns what they pick, or nothing on a cancel.
 */
export function createFakeInvoiceGoogle(pick: (title: string, offered: readonly DriveEntry[]) => readonly DriveEntry[], thisYear: number): FakeInvoiceGoogle {
  const nodes: FakeNode[] = [{ ...FAKE_INVOICE_FOLDER, parentId: null, visible: false }]
  for (const year of [thisYear - 1, thisYear]) {
    const yearId = `fake-folder-${year}`
    nodes.push({ id: yearId, name: String(year), folder: true, parentId: FAKE_INVOICE_FOLDER.id, visible: false })
    for (let month = 1; month <= 12; month += 1) {
      const name = `${year}-${String(month).padStart(2, '0')}`
      nodes.push({ id: `fake-folder-${name}`, name, folder: true, parentId: yearId, visible: false })
    }
  }
  const savedDrafts: { mail: InvoiceMail; fileName: string }[] = []
  let made = 0
  const entryOf = (node: FakeNode): DriveEntry => ({ id: node.id, name: node.name, folder: node.folder })
  const add = (parentId: string, name: string, folder: boolean, pdf?: Uint8Array): DriveEntry => {
    made += 1
    const node: FakeNode = { id: `fake-made-${made}`, name, folder, parentId, visible: true, ...(pdf === undefined ? {} : { pdf }) }
    nodes.push(node)
    return entryOf(node)
  }
  const requireVisible = (id: string): FakeNode => {
    const node = nodes.find((candidate) => candidate.id === id)
    if (node === undefined || !node.visible) throw new Error(`404 from the fake Drive: File not found: ${id}.`)
    return node
  }

  const drive: InvoiceDrive = {
    async children(folderId) {
      requireVisible(folderId)
      return nodes.filter((node) => node.parentId === folderId && node.visible).map(entryOf)
    },
    async pickFolders(parentId, title) {
      const offered = nodes.filter((node) => node.folder && node.parentId === parentId)
      const picked = pick(title, offered.map(entryOf))
      for (const entry of picked) {
        const node = nodes.find((candidate) => candidate.id === entry.id)
        if (node !== undefined) node.visible = true
      }
      return picked
    },
    async createFolder(parentId, name) {
      requireVisible(parentId)
      return add(parentId, name, true)
    },
    async createPdf(folderId, name, pdf) {
      requireVisible(folderId)
      return add(folderId, name, false, pdf)
    },
    async replacePdf(fileId, pdf) {
      requireVisible(fileId).pdf = pdf
    },
  }

  const drafts: MailDrafts = {
    async create(mail, attachment) {
      savedDrafts.push({ mail, fileName: attachment.fileName })
    },
  }

  return { drive, drafts, nodes, savedDrafts }
}

let session: FakeInvoiceGoogle | null = null

/**
 * The fake build's Drive and Gmail, the same until the page reloads. Its Picker is the browser's
 * confirm dialog: OK picks every folder offered, Cancel picks none.
 */
export function fakeInvoiceGoogleSession(): FakeInvoiceGoogle {
  session ??= createFakeInvoiceGoogle(
    (title, offered) => (window.confirm(`Fake Google Picker\n\n${title}\n\nOK picks every folder shown, Cancel closes the Picker.`) ? offered : []),
    new Date().getFullYear(),
  )
  return session
}
