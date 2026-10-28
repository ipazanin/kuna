/** A write the app will not make, with the reason in words a person can act on. Nothing was written. */
export class WorkbookWriteRefused extends Error {
  constructor(reason: string) {
    super(reason)
    this.name = 'WorkbookWriteRefused'
  }
}

/** Refuses a write with every reason given, or lets it go ahead when there are none. */
export function refuseOn(refusals: readonly string[]): void {
  if (refusals.length > 0) {
    throw new WorkbookWriteRefused(`Nothing was written. ${refusals.join(' ')}`)
  }
}
