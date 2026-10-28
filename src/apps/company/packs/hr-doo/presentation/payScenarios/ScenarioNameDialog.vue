<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import UModal from '@nuxt/ui/components/Modal.vue'

import { recordsOfKindIn } from '../../../../workbook/domain/readWorkbook'
import { NO_RECORDS, recordWithId } from '../../../../../../shared/storage/domain/recordsRead'
import { SCENARIO_RECORDS } from '../../domain/hrDooKinds'
import { useWorkbook } from '../../../../workbook/application/workbookStore'
import type { OwnerPayScenario } from '../../domain/scenarios/ownerPayScenarios'
import { slugProblem } from '../../../../workbook/domain/slug'
import { useRecordWrites } from '../../../../workbook/presentation/useRecordWrites'
import { usePhoneLayout } from '../../../../../../shared/layout/viewport'
import { copyScenario, renameScenario } from '../../application/scenarioWrites'
import { SCENARIO_WRITES } from '../../domain/hrDooWrites'
import type { ScenarioRow } from '../../domain/scenarios/scenariosReading'

/** Renames a scenario, or copies it under a new name, every row of it in one write. */
const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  scenario: OwnerPayScenario
  mode: 'rename' | 'copy'
  /** Every scenario name the tab uses, of any year. */
  taken: readonly string[]
}>()

const store = useWorkbook()
const writes = useRecordWrites()
const phone = usePhoneLayout()

const name = ref('')
const label = ref('')
const tried = ref(false)

watch(open, (opened) => {
  if (!opened) return
  name.value = props.mode === 'copy' ? `${props.scenario.slug}-copy` : props.scenario.slug
  label.value = props.mode === 'copy' ? `${props.scenario.label || props.scenario.slug}, copy` : props.scenario.label
  tried.value = false
}, { immediate: true })

const nameError = computed(() => {
  const slug = name.value.trim()
  const format = slugProblem(slug, 'scenario')
  if (format !== null) return format
  return slug !== props.scenario.slug && props.taken.includes(slug) ? `${slug} is already a scenario` : props.mode === 'copy' && slug === props.scenario.slug ? 'A copy needs a name of its own' : null
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
  const written =
    props.mode === 'copy'
      ? await writes.write('Scenario copied', (unit) => copyScenario(unit.of(SCENARIO_WRITES), storedRows(), slug, label.value.trim()), { failedTitle: 'Not copied' })
      : await writes.write('Scenario renamed', (unit) => renameScenario(unit.of(SCENARIO_WRITES), storedRows(), slug, label.value.trim()), { failedTitle: 'Not renamed' })
  if (written) open.value = false
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="mode === 'copy' ? 'Copy the scenario' : 'Rename the scenario'"
    :description="mode === 'copy' ? `Every row of ${scenario.label || scenario.slug}, added below the last row under a new name.` : 'Every row of the scenario takes the new name.'"
    :fullscreen="phone"
    :ui="{ header: 'pe-16 sm:pe-6' }"
  >
    <template #body>
      <form id="scenario-name" class="grid gap-4" data-testid="scenario-name-form" @submit.prevent="save">
        <UFormField label="Short name" :error="(tried && nameError) || false" help="Lower-case letters and digits with single hyphens. The plan tab names a scenario by it.">
          <UInput v-model="name" class="w-full" data-testid="scenario-slug" />
        </UFormField>
        <UFormField label="What the screens call it" help="Optional.">
          <UInput v-model="label" class="w-full" data-testid="scenario-label" />
        </UFormField>
      </form>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton label="Cancel" color="neutral" variant="ghost" :disabled="writes.busy.value" @click="open = false" />
        <UButton
          type="submit"
          form="scenario-name"
          :label="mode === 'copy' ? 'Copy scenario' : 'Rename scenario'"
          :icon="mode === 'copy' ? 'i-lucide-copy' : 'i-lucide-pencil'"
          :loading="writes.busy.value"
          :disabled="writes.busy.value"
          data-testid="scenario-name-save"
        />
      </div>
    </template>
  </UModal>
</template>
