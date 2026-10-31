import { words } from './words'

/** The first name of a path that starts at the folder the books file is in, as in `./statements`, rather than at My Drive. */
export const BOOKS_FOLDER = '.'

/** The folder names of a Drive path such as `work/statements`, from My Drive down, with blank ones and the spaces around each name left out. */
export function folderPathOf(path: string): string[] {
  return path
    .split('/')
    .map((name) => name.trim())
    .filter((name) => name !== '')
}

/** Whether the path starts at the folder the books file is in, such as `./statements`, which the app made, instead of at My Drive. */
export function startsAtBooksFolder(path: readonly string[]): boolean {
  return path[0] === BOOKS_FOLDER
}

/** A path of folder names from My Drive as a person reads it, such as `My Drive › work › statements`. */
export function folderTrail(path: readonly string[]): string {
  return [words.myDrive, ...path].join(' › ')
}
