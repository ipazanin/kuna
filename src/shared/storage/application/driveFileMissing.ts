import { words } from './words'

/** The chosen Drive file is in the bin, or Drive no longer has it or no longer lets the app open it, so the app neither reads nor saves it. */
export class DriveFileMissing extends Error {
  constructor(inBin: boolean) {
    super(inBin ? words.inBin : words.goneFromDrive)
    this.name = 'DriveFileMissing'
  }
}
