import { words } from './words'

/** A path of folder names from My Drive as a person reads it, such as `My Drive › work › statements`. */
export function folderTrail(path: readonly string[]): string {
  return [words.myDrive, ...path].join(' › ')
}
