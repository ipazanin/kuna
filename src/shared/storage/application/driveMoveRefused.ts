import { words } from './words'

/** Drive refused to move the file itself, the first request of a move, so nothing else was tried and everything stays where it was. */
export class DriveMoveRefused extends Error {
  constructor(reason: string) {
    super(words.moveRefused(reason))
    this.name = 'DriveMoveRefused'
  }
}
