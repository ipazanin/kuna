import { globSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse } from 'vue/compiler-sfc'

const root = join(import.meta.dirname, '..')

const documents = globSync('src/apps/*/workbook/infrastructure/*.ts', { cwd: root }).flatMap((file) => {
  const declared = /export const (\w+): AppDocument</.exec(readFileSync(join(root, file), 'utf8'))
  return declared === null ? [] : [{ app: file.split('/')[2]! }]
})

/** The dialogs that save nothing to an app's file. A dialog not named here counts as one that does, so it takes `changes`. */
const DIALOGS_THAT_SAVE_NOTHING: Readonly<Record<string, string>> = {
  'src/shell/ui/QuickJump.vue': 'jumps to a page',
  'src/shell/settings/DeleteDataCard.vue': 'deletes an app and its file',
  'src/shell/settings/DeleteKunaDialog.vue': 'deletes every app and its file',
  'src/shared/storage/presentation/DeleteAppDataDialog.vue': 'deletes an app and its file',
  'src/shared/storage/presentation/MoveIntoKunaDialog.vue': 'moves the file on Drive',
  'src/shared/ai/presentation/AiAssistCard.vue': 'keeps a key on this device',
  'src/apps/company/data-source/presentation/SwitchSourceDialog.vue': 'chooses where the file is kept',
  'src/apps/company/owner-share/presentation/ShareFillDialog.vue': 'reads the owner share before its form opens',
  'src/apps/company/packs/hr-doo/presentation/FigureDialog.vue': 'explains a figure',
  'src/apps/company/packs/hr-doo/presentation/payScenarios/PayPanel.vue': 'reads a pay scenario',
  'src/apps/company/onboarding/presentation/MadeStep.vue': 'ends the first run',
  'src/apps/investments/compare/presentation/CompareWith.vue': 'picks what to compare with',
  'src/shell/gallery/DialogSpecimens.vue': 'the gallery shows dialogs',
}

interface TemplateElement {
  readonly tag?: string
  readonly props?: readonly { readonly name: string; readonly arg?: { readonly content?: string } }[]
  readonly children?: readonly TemplateElement[]
}

function dialogsOf(element: TemplateElement): { readonly changes: boolean }[] {
  const own = element.tag === 'AppDialog' ? [{ changes: (element.props ?? []).some((prop) => prop.name === 'changes') }] : []
  return [...own, ...(element.children ?? []).flatMap((child) => (typeof child === 'object' ? dialogsOf(child) : []))]
}

const dialogFiles = globSync('src/**/*.vue', { cwd: root }).flatMap((file) => {
  const descriptor = parse(readFileSync(join(root, file), 'utf8')).descriptor
  const dialogs = descriptor.template === null ? [] : dialogsOf(descriptor.template.ast as unknown as TemplateElement)
  return dialogs.length === 0 ? [] : [{ file, dialogs }]
})

describe('the notice that a newer Kuna saved the file', () => {
  it('finds the document of every app that keeps one', () => {
    expect(documents.map((document) => document.app).sort()).toEqual(['assets', 'company', 'investments', 'loans', 'spending'])
  })

  it('shows above every screen of the app on screen, through the store its sync group hands the shell', () => {
    const shell = readFileSync(join(root, 'src/shell/App.vue'), 'utf8')

    expect(shell).toContain('<NewerFileNotice v-if="newerFileOnScreen"')
    expect(shell).toContain('group.app === appOnScreen.value?.id')
    expect(shell).toContain('.store.savedByNewerApp()')
    expect(shell).toContain('@reload="applyUpdate"')
  })

  it('keeps a running write and a refused file apart, so a Save spins only for its own write and is disabled for both', () => {
    const writes = readFileSync(join(root, 'src/shared/storage/presentation/useRecordWrites.ts'), 'utf8')
    const sources = globSync('src/**/*.{vue,ts}', { cwd: root }).map((file) => ({ file, text: readFileSync(join(root, file), 'utf8') }))
    const passedOn = sources.filter(
      ({ file, text }) =>
        file !== 'src/shared/storage/presentation/useRecordWrites.ts' &&
        /(:loading|:saving)="[^"]*\b\w*[wW]rites\.busy|const \w+ = computed\(\(\) => \w*[wW]rites\.busy\.value\)|saving: \w*[wW]rites\.busy\b/.test(text),
    )

    expect(writes).toContain('store.savedByNewerApp()')
    expect(writes).toContain('const busy = computed(() => running.value > 0)')
    expect(passedOn.map(({ file }) => file)).toEqual([])
  })

  it('gives every dialog the reason in its body through the one frame all dialogs share', () => {
    const shell = readFileSync(join(root, 'src/shell/App.vue'), 'utf8')
    const frame = readFileSync(join(root, 'src/shared/ui/AppDialog.vue'), 'utf8')

    expect(shell).toContain('CHANGES_REFUSED')
    expect(frame).toContain('inject(CHANGES_REFUSED')
    expect(frame).toContain('data-testid="dialog-changes-refused"')
    expect(frame).toContain('<UModal v-model:open="open"')
  })

  it('marks every dialog with changes unless it is named as one that saves nothing', () => {
    const unmarked = dialogFiles.filter(({ file, dialogs }) => !(file in DIALOGS_THAT_SAVE_NOTHING) && dialogs.some((dialog) => !dialog.changes)).map(({ file }) => file)
    const named = Object.keys(DIALOGS_THAT_SAVE_NOTHING)

    expect(unmarked).toEqual([])
    expect(dialogFiles.filter(({ dialogs }) => dialogs.some((dialog) => dialog.changes)).length).toBeGreaterThan(40)
    const saveStaysOn = dialogFiles
      .filter(({ file, dialogs }) => dialogs.some((dialog) => dialog.changes) && !/\.refused\b|[a-z]Refused\b/.test(readFileSync(join(root, file), 'utf8')))
      .map(({ file }) => file)
    expect(saveStaysOn).toEqual([])
    expect(named.filter((file) => !dialogFiles.some((held) => held.file === file))).toEqual([])
    expect(
      dialogFiles.filter(({ file, dialogs }) => named.includes(file) && file !== 'src/shell/gallery/DialogSpecimens.vue' && dialogs.every((dialog) => dialog.changes)).map(({ file }) => file),
    ).toEqual([])
  })
})
