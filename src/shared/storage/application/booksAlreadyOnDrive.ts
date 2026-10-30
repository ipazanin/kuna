import { words } from './words'

/** The app makes no second books file, since Drive already holds the one it marked as its books. Nothing was made. */
export class BooksAlreadyOnDrive extends Error {
  constructor(fileName: string) {
    super(words.alreadyOnDrive(fileName))
    this.name = 'BooksAlreadyOnDrive'
  }
}
