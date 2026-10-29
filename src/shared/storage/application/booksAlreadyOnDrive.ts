/** The app makes no second books file, since Drive already holds the one it marked as its books. Nothing was made. */
export class BooksAlreadyOnDrive extends Error {
  constructor(fileName: string) {
    super(`Drive already holds ${fileName}, so the app does not make a second one. Open that file, or trash it in Drive first.`)
    this.name = 'BooksAlreadyOnDrive'
  }
}
