/** Drive refused the bin for a reason a second try cannot change, such as a file only its owner can bin. */
export class DriveTrashRefused extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DriveTrashRefused'
  }
}
