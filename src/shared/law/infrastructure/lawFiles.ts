import type { LawSource } from '../domain/lawSections'

/** Every file of `docs/law` as raw text, each in a chunk of its own that loads when it is first read. The only code that reads outside `src`. */
const LAW_FILES = import.meta.glob<string>('../../../../docs/law/*/*.md', { query: '?raw', import: 'default' })

/** The law files of one folder of `docs/law`, such as `investments`, by name. */
export function lawFilesIn(folder: string): readonly LawSource[] {
  const prefix = `../../../../docs/law/${folder}/`
  return Object.entries(LAW_FILES)
    .filter(([path]) => path.startsWith(prefix))
    .map(([path, load]) => ({ name: path.slice(prefix.length, -'.md'.length), load }))
    .sort((first, second) => first.name.localeCompare(second.name))
}
