/** A write the app will not make, with the reason in words a person can act on. Nothing was written. */
export class WorkbookWriteRefused extends Error {
  constructor(reason: string) {
    super(reason)
    this.name = 'WorkbookWriteRefused'
  }
}
