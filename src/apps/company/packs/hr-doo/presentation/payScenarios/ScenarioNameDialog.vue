<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'

import { recordsOfKindIn } from '../../../../workbook/domain/readWorkbook'
import { NO_RECORDS, recordWithId } from '../../../../../../shared/storage/domain/recordsRead'
import { SCENARIO_RECORDS } from '../../domain/hrDooKinds'
import { useWorkbook } from '../../../../workbook/application/workbookStore'
import type { OwnerPayScenario } from '../../domain/scenarios/ownerPayScenarios'
import { scenarioName } from '../../domain/scenarios/startingScenarios'
import { slugProblem } from '../../../../workbook/domain/slug'
import { useRecordWrites } from '../../../../../../shared/storage/presentation/useRecordWrites'
import AppDialog from '../../../../../../shared/ui/AppDialog.vue'
import { copyScenario, renameScenario } from '../../application/scenarioWrites'
import { SCENARIO_WRITES } from '../../domain/hrDooWrites'
import type { ScenarioRow } from '../../domain/scenarios/scenariosReading'
import { words } from './words'

/** Renames a scenario, or copies it under a new name, every row of it in one write. */
const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  scenario: OwnerPayScenario
  mode: 'rename' | 'copy'
  /** Every scenario name the tab uses, of any year. */
  taken: readonly string[]
}>()

const store = useWorkbook()
const writes = useRecordWrites(store)

const name = ref('')
const label = ref('')
const tried = ref(false)

watch(
  open,
  (opened) => {
    if (!opened) return
    name.value = props.mode === 'copy' ? `${props.scenario.slug}-copy` : props.scenario.slug
    label.value = props.mode === 'copy' ? words.nameDialog.copyLabel(scenarioName(props.scenario)) : props.scenario.label === '' ? '' : scenarioName(props.scenario)
    tried.value = false
  },
  { immediate: true },
)

const nameError = computed(() => {
  const slug = name.value.trim()
  const format = slugProblem(slug, 'scenario')
  if (format !== null) return format
  return slug !== props.scenario.slug && props.taken.includes(slug) ? words.nameDialog.taken(slug) : props.mode === 'copy' && slug === props.scenario.slug ? words.nameDialog.copyNeedsName : null
})

/** The scenario's records as the app read them. */
function storedRows(): ScenarioRow[] {
  const read = store.state.records === null ? NO_RECORDS : recordsOfKindIn(store.state.records, SCENARIO_RECORDS)
  return props.scenario.components.flatMap((component) => recordWithId(read, component.id)?.record ?? [])
}

async function save(): Promise<void> {
  tried.value = true
  if (nameError.value !== null) return
  const slug = name.value.trim()
  // A label left as the screen shows it keeps the stored one, so a label Kuna wrote still shows in either language.
  const typed = label.value.trim()
  const kept = props.mode === 'rename' && typed === scenarioName(props.scenario) ? props.scenario.label : typed
  const written =
    props.mode === 'copy'
      ? await writes.write(words.nameDialog.copied, (unit) => copyScenario(unit.of(SCENARIO_WRITES), storedRows(), slug, typed), { failedTitle: words.nameDialog.notCopied })
      : await writes.write(words.nameDialog.renamed, (unit) => renameScenario(unit.of(SCENARIO_WRITES), storedRows(), slug, kept), { failedTitle: words.nameDialog.notRenamed })
  if (written) open.value = false
}
</script>

<template>
  <AppDialog
    v-model:open="open"
    :title="mode === 'copy' ? words.nameDialog.copyTitle : words.nameDialog.renameTitle"
    :description="mode === 'copy' ? words.nameDialog.copyDescription(scenarioName(scenario)) : words.nameDialog.renameDescription"
  >
    <form id="scenario-name" class="grid gap-4" data-testid="scenario-name-form" @submit.prevent="save">
      <UFormField :label="words.nameDialog.shortName" :error="(tried && nameError) || false" :help="words.nameDialog.shortNameHelp">
        <UInput v-model="name" class="w-full" data-testid="scenario-slug" />
      </UFormField>
      <UFormField :label="words.nameDialog.label" :help="words.nameDialog.optional">
        <UInput v-model="label" class="w-full" data-testid="scenario-label" />
      </UFormField>
    </form>
    <template #end>
      <UButton :label="words.nameDialog.cancel" color="neutral" variant="ghost" :disabled="writes.busy.value" @click="open = false" />
      <UButton
        type="submit"
        form="scenario-name"
        :label="mode === 'copy' ? words.nameDialog.copyButton : words.nameDialog.renameButton"
        :icon="mode === 'copy' ? 'i-lucide-copy' : 'i-lucide-pencil'"
        :loading="writes.busy.value"
        :disabled="writes.busy.value"
        data-testid="scenario-name-save"
      />
    </template>
  </AppDialog>
</template>
