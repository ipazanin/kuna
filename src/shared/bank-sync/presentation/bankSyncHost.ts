import type { BankUsage } from '../domain/bankLink'
import type { UnitOfWork } from '../../storage/application/repository'
import type { RecordWrites } from '../../storage/presentation/useRecordWrites'

/** What the shared bank sync cards read and write in the book of the app that shows them. */
export interface BankSyncHost {
  /** The login the app links and reads. */
  readonly usage: BankUsage
  /** What the book calls the application setting, which the key form's field shows. */
  readonly applicationLabel: string
  /** The application the book's bank sync uses, blank before it is set up, or null while no file is open. */
  applicationId(): string | null
  readonly writes: Pick<RecordWrites, 'write' | 'refused'>
  /** Keeps the application in the book, which every device reads to fetch its key. */
  saveApplication(unit: UnitOfWork, applicationId: string): void
  /** Turns the book's bank sync off: no application and no bank link. */
  forgetBankSync(unit: UnitOfWork): void
}
