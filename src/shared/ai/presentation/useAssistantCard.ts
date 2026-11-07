import { computed, ref, watch } from 'vue'

import { PAGE_SECRET_STORE, useSecretsChanged } from '../../secrets/presentation/pageSecrets'
import { useSecretRows } from '../../secrets/presentation/useSecretRows'
import { words as secretWords } from '../../secrets/presentation/words'
import { listInWords } from '../../text/listInWords'
import { modelOf, pickModel } from '../application/assistSettings'
import { testProviderKey } from '../application/modelAccess'
import { PROVIDER_PRESETS, presetOf } from '../domain/providerPresets'
import type { KeyTest, ProviderId, ProviderPreset } from '../domain/providerPresets'
import { providerInUse, switchProvider } from './useAiTask'
import { words } from './words'

/** Says a key was removed or replaced, with what puts it back. */
type AnnounceKeyChange = (title: string, undo: () => void) => void

function testLineOf(preset: ProviderPreset, test: KeyTest): string {
  if (test.kind === 'works') return words.card.accepted(preset.name)
  return test.kind === 'refused' ? words.card.refused(preset.name) : words.card.testFailed(test.reason)
}

/**
 * The rules of the assistant's key, on Kuna settings' card and in the welcome's walk-through. The provider changes only by a person's act on the select: saving a key, a Test, a
 * fetch from Google, a sync and an Undo never move it. A company with a key takes over at once. One with no key changes
 * nothing while another key is in use, so a person who is only looking keeps the assistant they had. A key the company
 * refuses is never kept, so it cannot take over and cannot push out a working key.
 */
export function useAssistantCard(announce: AnnounceKeyChange) {
  const keys = useSecretRows(
    PROVIDER_PRESETS.map((preset) => ({ ...preset, needsKey: true })),
    PAGE_SECRET_STORE,
    (preset, key): Promise<KeyTest> => testProviderKey(preset, key ?? ''),
  )
  const kept = (id: ProviderId): boolean => keys.rows[id]!.kept

  const shownId = ref<ProviderId>(providerInUse()?.id ?? PROVIDER_PRESETS[0]!.id)
  const shown = computed(() => presetOf(shownId.value))
  const row = computed(() => keys.rows[shownId.value]!)
  const inUse = computed(() => providerInUse())

  /** What is typed in the key field, which goes nowhere until Save. */
  const typed = ref('')
  const replacing = ref(false)
  /** Whether Save is testing what was typed, before it keeps it. */
  const trying = ref(false)
  /** The company that refused what was typed, which nothing kept. */
  const typedRefusedBy = ref<ProviderId | null>(null)
  /** A company whose key was saved while another stayed in use, so the card went back to the one in use. */
  const savedAside = ref<ProviderId | null>(null)
  /** The last pick on the select that moved the assistant, for the lines that say what it did. */
  const moved = ref<{ readonly to: ProviderId; readonly from: ProviderId | null; readonly anonymiseBack: boolean } | null>(null)
  const fetching = ref(false)
  const fetchLine = ref<string | null>(null)
  /** What the model field holds while it has focus, which may be empty while the stored model falls back to the default. */
  const modelDraft = ref<string | null>(null)

  const tested = computed(() => (row.value.test === null || row.value.test === 'testing' ? null : row.value.test))
  const typedRefused = computed(() => typedRefusedBy.value === shownId.value)
  const testWorks = computed(() => tested.value?.kind === 'works' && !typedRefused.value)
  const fieldOpen = computed(() => !row.value.kept || replacing.value || tested.value?.kind === 'refused')
  const testLine = computed(() => {
    if (typedRefused.value) return words.card.refused(shown.value.name)
    return tested.value === null ? null : testLineOf(shown.value, tested.value)
  })
  const companies = computed(() =>
    PROVIDER_PRESETS.map((preset) => ({
      label: preset.name,
      value: preset.id,
      description: kept(preset.id) ? `${words.card.about[preset.id]}. ${words.card.keySaved}` : words.card.about[preset.id],
    })),
  )
  const keepsUsing = computed(() => {
    const current = inUse.value
    return !row.value.kept && current !== null && current.id !== shownId.value && kept(current.id) ? words.card.keepsUsing(current.name, shown.value.name) : null
  })
  const movedHere = computed(() => (moved.value?.to === shownId.value && row.value.kept ? moved.value : null))
  const otherKept = computed(() => {
    const from = movedHere.value?.from ?? null
    return from !== null && kept(from) ? presetOf(from) : null
  })
  const savedAsideLines = computed(() => {
    const aside = savedAside.value
    const current = inUse.value
    if (aside === null || current === null || aside === current.id || current.id !== shownId.value || !kept(aside)) return []
    const test = keys.rows[aside]!.test
    return [...(test === null || test === 'testing' ? [] : [testLineOf(presetOf(aside), test)]), words.card.savedKeepsUsing(presetOf(aside).name, current.name)]
  })

  const model = computed(() => modelOf(shownId.value))
  const modelText = computed(() => modelDraft.value ?? model.value.id)
  const modelNote = computed(() => {
    if (model.value.price === null) return words.card.typedModel[shownId.value]
    return model.value.id === shown.value.defaultModel ? words.card.defaultModel(model.value.name) : model.value.name
  })

  watch(shownId, () => {
    typed.value = ''
    replacing.value = false
    modelDraft.value = null
    fetchLine.value = null
  })

  // The card follows the assistant as a pick here or in another tab moves it.
  watch(
    () => inUse.value?.id,
    (id) => {
      if (id !== undefined) shownId.value = id
    },
  )

  watch(useSecretsChanged(), () => {
    keys.reread()
    // A key a sync brought for the company on screen is not a pick, so the card goes back to the one in use.
    if (row.value.kept && row.value.test === null && inUse.value !== null) shownId.value = inUse.value.id
  })

  /** A person's act on the select, the one thing that moves the assistant. A company with no key moves it only while it has no key to lose. */
  function pick(id: ProviderId): void {
    shownId.value = id
    const before = inUse.value
    const keyInUse = before !== null && kept(before.id)
    if (!kept(id) && keyInUse) return
    const anonymiseBack = switchProvider(id)
    if (before?.id !== id) moved.value = { to: id, from: keyInUse ? before.id : null, anonymiseBack }
  }

  /** Tests what was typed and keeps it unless the company refuses it, since a Test can also fail for being offline. It moves nothing. */
  async function save(): Promise<void> {
    const id = shownId.value
    const key = typed.value.trim()
    if (key === '') return
    const hadKey = kept(id)
    trying.value = true
    typedRefusedBy.value = null
    let test: KeyTest
    try {
      test = await testProviderKey(presetOf(id), key)
    } finally {
      trying.value = false
    }
    if (shownId.value === id) typed.value = ''
    if (test.kind === 'refused') {
      typedRefusedBy.value = id
      return
    }
    const undo = keys.save(id, key, test)
    if (undo !== null && hadKey) announce(secretWords.keyRow.replaced, undo)
    if (shownId.value !== id) return
    replacing.value = false
    const current = inUse.value
    if (current !== null && current.id !== id && kept(current.id)) {
      savedAside.value = id
      shownId.value = current.id
    }
  }

  function stopReplacing(): void {
    replacing.value = false
    typedRefusedBy.value = null
  }

  /** Removes a key at once with Undo. The assistant stays on the company it was on, even with another key saved. */
  function remove(id: ProviderId): void {
    announce(secretWords.keyRow.removed, keys.forget(id))
  }

  /**
   * Takes the keys another browser saved, which `fetchKeys` asks Google for, answering why they could not be read or null.
   * It moves nothing, and says what it found when that is not a key for the company on screen.
   */
  async function fetchKey(fetchKeys: () => Promise<string | null>): Promise<void> {
    const keptBefore = PROVIDER_PRESETS.filter((preset) => kept(preset.id))
    fetching.value = true
    fetchLine.value = null
    try {
      const refusal = await fetchKeys()
      keys.reread()
      const brought = PROVIDER_PRESETS.filter((preset) => kept(preset.id) && !keptBefore.includes(preset))
      if (refusal !== null) fetchLine.value = refusal
      else if (!row.value.kept) fetchLine.value = brought.length > 0 ? words.card.fetchedOther(listInWords(brought.map((preset) => preset.name))) : words.card.fetchNone(shown.value.name)
    } catch (failure) {
      fetchLine.value = words.card.fetchFailed(failure instanceof Error ? failure.message : String(failure))
    } finally {
      fetching.value = false
    }
  }

  function typeModel(text: string): void {
    modelDraft.value = text
    pickModel(shownId.value, text)
  }

  return {
    keys,
    shownId,
    shown,
    inUse,
    row,
    tested,
    typed,
    replacing,
    trying,
    typedRefused,
    testWorks,
    fieldOpen,
    testLine,
    companies,
    keepsUsing,
    movedHere,
    otherKept,
    savedAsideLines,
    modelDraft,
    modelText,
    modelNote,
    fetching,
    fetchLine,
    pick,
    save,
    stopReplacing,
    remove,
    fetchKey,
    typeModel,
    testKey: (preset: ProviderPreset) => keys.test({ ...preset, needsKey: true }),
  }
}

export type AssistantCard = ReturnType<typeof useAssistantCard>
