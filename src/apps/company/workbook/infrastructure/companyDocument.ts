import { installedPack } from '../../packs/packContribution'
import { codecOfKind } from '../application/recordCodecs'
import { readWorkbook, workbookRecordsOf } from '../domain/readWorkbook'
import type { CompanyBooks, WorkbookIdentity, WorkbookRecords } from '../domain/readWorkbook'
import type { WorkbookDocument } from '../../../../shared/storage/infrastructure/documentFormat'
import { recordsOfDocument } from '../../../../shared/storage/infrastructure/documentRecordStorage'
import type { AppDocument } from '../../../../shared/storage/infrastructure/documentStorePorts'

/** The app of the hub whose books this store keeps. */
export const COMPANY_APP = 'company'

/** The contributor that stores core's kinds. */
const CORE = 'core'
const CORE_SCHEMA_VERSION = 1

/** The schema version each contributor of this app writes: core, and the installed pack. */
export function installedSchema(): WorkbookDocument['schema'] {
  const pack = installedPack().workbook
  return pack === null ? { [CORE]: CORE_SCHEMA_VERSION } : { [CORE]: CORE_SCHEMA_VERSION, [pack.key.name]: pack.schemaVersion }
}

/** The records a document holds of every kind, core's and the installed pack's. */
function workbookRecordsOfDocument(document: WorkbookDocument): WorkbookRecords {
  return workbookRecordsOf((kind) => recordsOfDocument(document, kind, codecOfKind), installedPack().workbook)
}

/** A document's records and the workbook they make. */
export function readDocument(identity: WorkbookIdentity, document: WorkbookDocument): CompanyBooks {
  const records = workbookRecordsOfDocument(document)
  return { records, workbook: readWorkbook(identity, records, installedPack().workbook) }
}

/** The company's document as the store reads and writes it. */
export const COMPANY_DOCUMENT: AppDocument<CompanyBooks> = {
  schema: installedSchema,
  codecOf: codecOfKind,
  read(copy) {
    const { id, source, title, syncedAt } = copy.meta
    return readDocument({ id, source, title, syncedAt }, copy.document)
  },
}
