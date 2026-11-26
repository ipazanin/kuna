import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { chatCovers, chatReach, screenWrites, writeGraph } from './support/writePaths'

const NOTES = 'src/apps/notes/notes/application/notes.ts'
const SAVE_NOTE = `${NOTES}#saveNote`
const made: string[] = []

/**
 * A small app whose notes module holds a write and a read beside each other and an object of both, which the app's index
 * re-exports through a renamed export and a star export. A screen saves notes, and the operation is the body given.
 */
function notesApp(operation: string): string {
  const root = mkdtempSync(join(tmpdir(), 'kuna-write-paths-spec-'))
  made.push(root)
  const files: Record<string, string> = {
    'src/apps/notes/notes/domain/noteWrites.ts': 'export const NOTE_WRITES: WriteRules<Note> = rulesOf()\n',
    [NOTES]: [
      "import { NOTE_WRITES } from '../domain/noteWrites'",
      'export function readNote(id) { return id }',
      "export function saveNote(unit) { unit.of(NOTE_WRITES).add({ id: '1' }) }",
      'export const NOTE_STORE = { read: readNote, save: saveNote }',
    ].join('\n'),
    'src/apps/notes/notes/index.ts': "export { readNote as noteOf, NOTE_STORE } from './application/notes'\n",
    'src/apps/notes/index.ts': "export * from './notes'\n",
    'src/apps/notes/notes/presentation/noteForm.ts': "import { saveNote } from '../application/notes'\nexport function submit(unit) { saveNote(unit) }\n",
    'src/apps/notes/assistant/operations/noteOperations.ts': [
      "import { noteOf, NOTE_STORE } from '../..'",
      "import { saveNote } from '../../notes/application/notes'",
      `export function planned(unit, held) { ${operation} }`,
    ].join('\n'),
  }
  for (const [file, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, file)), { recursive: true })
    writeFileSync(join(root, file), text)
  }
  return root
}

/**
 * The notes app with a page sync whose one step is made from the notes store and a file id. The step's stop saves a note, and its run
 * is the body given. The chat's operation runs the sync and nothing else.
 */
function syncedNotesApp(run: string): string {
  const root = notesApp('')
  const files: Record<string, string> = {
    'src/shared/sync/presentation/pageSync.ts': [
      'export function usePageSync() { return { syncNow() {} } }',
      'function booksStep(group) { const { store } = group\nreturn { run() { return store.sync() } } }',
    ].join('\n'),
    'src/apps/notes/app.ts': "import { notesSyncGroup } from './sync/presentation/notesSyncGroup'\nexport const NOTES_APP = { syncGroup: notesSyncGroup }\n",
    'src/apps/notes/sync/presentation/notesSyncGroup.ts': [
      "import { NOTE_STORE } from '../../notes/application/notes'",
      "import { noteStep } from './noteStep'",
      "export function notesSyncGroup() { const step = noteStep(NOTE_STORE, () => '1')\nreturn { steps: () => [step] } }",
    ].join('\n'),
    'src/apps/notes/sync/presentation/noteStep.ts': `export function noteStep(notes, fileId) { function stop(unit) { notes.save(unit) }\nreturn { readsMail: { stop }, run(unit) { ${run} } } }\n`,
    'src/apps/notes/assistant/operations/noteOperations.ts': [
      "import { usePageSync } from '../../../../shared/sync/presentation/pageSync'",
      'export function planned() { usePageSync().syncNow() }',
    ].join('\n'),
  }
  for (const [file, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, file)), { recursive: true })
    writeFileSync(join(root, file), text)
  }
  return root
}

function chatSavesNotes(operation: string): boolean {
  const graph = writeGraph(notesApp(operation))
  expect([...screenWrites(graph).keys()]).toEqual([SAVE_NOTE])
  return chatCovers(graph, chatReach(graph), SAVE_NOTE)
}

afterEach(() => {
  for (const folder of made.splice(0)) rmSync(folder, { recursive: true, force: true })
})

describe('the write graph', () => {
  it('reaches the function an operation calls and not the one beside it in the same module', () => {
    const graph = writeGraph(notesApp("return noteOf('1')"))
    const reach = chatReach(graph).get('notes')!

    expect([...reach.symbols]).toContain(`${NOTES}#readNote`)
    expect([...reach.symbols]).not.toContain(SAVE_NOTE)
    expect(chatCovers(graph, chatReach(graph), SAVE_NOTE)).toBe(false)
  })

  it('follows a renamed re-export and a star export to the declaration', () => {
    const graph = writeGraph(notesApp(''))

    expect(graph.declaredAt('src/apps/notes/index.ts', 'noteOf')).toBe(`${NOTES}#readNote`)
    expect(graph.declaredAt('src/apps/notes/index.ts', 'NOTE_STORE')).toBe(`${NOTES}#NOTE_STORE`)
  })

  it('reaches the write an operation calls through a re-export chain', () => {
    expect(chatSavesNotes('saveNote(unit)')).toBe(true)
  })

  it('reaches only the member of an object an operation reads', () => {
    expect(chatSavesNotes("return NOTE_STORE.read('1')")).toBe(false)
    expect(chatSavesNotes('NOTE_STORE.save(unit)')).toBe(true)
  })

  it('reaches every member of an object an operation hands on whole', () => {
    expect(chatSavesNotes('return held(NOTE_STORE)')).toBe(true)
  })

  it('does not take a parameter for the import it hides', () => {
    expect(chatSavesNotes('return [unit].map((saveNote) => saveNote)')).toBe(false)
  })

  it("reaches what a sync step's run does with a value its group hands the step, and not what the rest of the step does", () => {
    const stopOnly = writeGraph(syncedNotesApp('return fileId()'))
    const runSaves = writeGraph(syncedNotesApp('notes.save(unit)'))

    expect([...chatReach(stopOnly).get('notes')!.symbols]).not.toContain(SAVE_NOTE)
    expect(chatCovers(stopOnly, chatReach(stopOnly), SAVE_NOTE)).toBe(false)
    expect(chatCovers(runSaves, chatReach(runSaves), SAVE_NOTE)).toBe(true)
  })
})
