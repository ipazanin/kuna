import type { DriveEntry, FilingDrive } from '../../application/driveFiling'

/** The folder the fake build's Picker offers in My Drive, which invoices and travel orders are filed in. */
export const FAKE_INVOICE_FOLDER: DriveEntry = { id: 'fake-invoice-folder', name: 'invoices', folder: true }

export interface FakeNode extends DriveEntry {
  readonly parentId: string | null
  /** Whether the app's token can see it: made by the app or picked once. */
  visible: boolean
  content?: Uint8Array
}

export interface FakeFilingDrive {
  readonly drive: FilingDrive
  readonly nodes: readonly FakeNode[]
}

/**
 * A Drive held in memory. The invoice folder holds a folder for this year and last year with every
 * month inside, made by another app, so the app's token cannot see them until they are picked, as
 * with folders the invoice generator made. `pick` plays the Picker: it gets the folders a person
 * would see and returns what they pick, or nothing on a cancel.
 */
export function createFakeFilingDrive(pick: (title: string, offered: readonly DriveEntry[]) => readonly DriveEntry[], thisYear: number): FakeFilingDrive {
  const nodes: FakeNode[] = [{ ...FAKE_INVOICE_FOLDER, parentId: null, visible: false }]
  for (const year of [thisYear - 1, thisYear]) {
    const yearId = `fake-folder-${year}`
    nodes.push({ id: yearId, name: String(year), folder: true, parentId: FAKE_INVOICE_FOLDER.id, visible: false })
    for (let month = 1; month <= 12; month += 1) {
      const name = `${year}-${String(month).padStart(2, '0')}`
      nodes.push({ id: `fake-folder-${name}`, name, folder: true, parentId: yearId, visible: false })
    }
  }
  let made = 0
  const entryOf = (node: FakeNode): DriveEntry => ({ id: node.id, name: node.name, folder: node.folder })
  const add = (parentId: string, name: string, folder: boolean, content?: Uint8Array): DriveEntry => {
    made += 1
    const node: FakeNode = { id: `fake-made-${made}`, name, folder, parentId, visible: true, ...(content === undefined ? {} : { content }) }
    nodes.push(node)
    return entryOf(node)
  }
  const requireVisible = (id: string): FakeNode => {
    const node = nodes.find((candidate) => candidate.id === id)
    if (node === undefined || !node.visible) throw new Error(`404 from the fake Drive: File not found: ${id}.`)
    return node
  }

  const drive: FilingDrive = {
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
    async createFile(folderId, name, content) {
      requireVisible(folderId)
      return add(folderId, name, false, content)
    },
    async replaceFile(fileId, content) {
      requireVisible(fileId).content = content
    },
  }

  return { drive, nodes }
}

let session: FakeFilingDrive | null = null

/**
 * The fake build's Drive, the same until the page reloads. Its Picker is the browser's confirm
 * dialog: OK picks every folder offered, Cancel picks none.
 */
export function fakeFilingDriveSession(): FakeFilingDrive {
  session ??= createFakeFilingDrive(
    (title, offered) => (window.confirm(`Fake Google Picker\n\n${title}\n\nOK picks every folder shown, Cancel closes the Picker.`) ? offered : []),
    new Date().getFullYear(),
  )
  return session
}
