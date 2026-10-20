<script setup lang="ts">
import { computed, ref } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import AppCard from '../../../../shared/ui/AppCard.vue'
import { useWorkbook } from '../../../../features/workbook/application/workbookStore'
import type { Grant } from '../../../../features/workbook/domain/grants'
import type { OwnerPayScenario, ScenarioComponent } from '../../../../features/workbook/domain/ownerPayScenarios'
import ComponentDialog from './ComponentDialog.vue'
import ScenarioNameDialog from './ScenarioNameDialog.vue'
import StartingScenariosDialog from './StartingScenariosDialog.vue'
import { componentText, spanText } from './scenarioWording'

/** The year's scenarios as their rows: add, edit and delete a component, rename or copy a scenario, or add the starting four. */
const props = defineProps<{
  year: number
  scenarios: readonly OwnerPayScenario[]
  /** Why a scenario cannot be worked out, by its name. */
  refusals: ReadonlyMap<string, readonly string[]>
  grants: readonly Grant[]
  tabMissing: boolean
  /** Every scenario name the tab uses, of any year. */
  taken: readonly string[]
}>()

const store = useWorkbook()

const editing = ref<{ readonly scenario: OwnerPayScenario; readonly component: ScenarioComponent | null } | null>(null)
const componentOpen = ref(false)
const naming = ref<{ readonly scenario: OwnerPayScenario; readonly mode: 'rename' | 'copy' } | null>(null)
const nameOpen = ref(false)
const startingOpen = ref(false)

const startingTaken = computed(() => props.taken.includes(`floor-salary-${props.year}`))

function editComponent(scenario: OwnerPayScenario, component: ScenarioComponent | null): void {
  editing.value = { scenario, component }
  componentOpen.value = true
}

function name(scenario: OwnerPayScenario, mode: 'rename' | 'copy'): void {
  naming.value = { scenario, mode }
  nameOpen.value = true
}
</script>

<template>
  <AppCard
    :title="`Scenarios for ${year}`"
    subtitle="Rows of the scenarios tab. A change is written at once, with Undo in the toast."
    collapse-id="pay-scenarios.editor"
    :summary="scenarios.length === 0 ? 'No scenario yet' : scenarios.map((scenario) => scenario.label || scenario.slug).join(', ')"
    data-testid="scenario-editor"
  >
    <template v-if="!startingTaken" #actions>
      <UButton
        label="Add the starting scenarios"
        icon="i-lucide-list-plus"
        color="neutral"
        variant="outline"
        size="sm"
        :disabled="store.state.writing"
        data-testid="add-starting-scenarios"
        @click="startingOpen = true"
      />
    </template>
    <div class="flex flex-col gap-3 px-4 pt-3 pb-4 sm:px-5">
      <p v-if="scenarios.length === 0" class="py-4 text-sm text-muted">No scenario is for {{ year }} yet. The starting scenarios give four to compare, all editable.</p>
      <article v-for="scenario in scenarios" :key="scenario.slug" class="scenario-card" :data-scenario="scenario.slug">
        <header class="flex flex-wrap items-start justify-between gap-2">
          <div class="min-w-0">
            <h3 class="text-sm font-medium text-highlighted">{{ scenario.label || scenario.slug }}</h3>
            <p class="identifier text-xs text-muted">{{ scenario.slug }}</p>
          </div>
          <div class="flex flex-wrap gap-1">
            <UButton label="Rename" icon="i-lucide-pencil" color="neutral" variant="ghost" size="sm" :disabled="store.state.writing" data-testid="scenario-rename" @click="name(scenario, 'rename')" />
            <UButton label="Copy" icon="i-lucide-copy" color="neutral" variant="ghost" size="sm" :disabled="store.state.writing" data-testid="scenario-copy" @click="name(scenario, 'copy')" />
          </div>
        </header>
        <ul v-if="refusals.get(scenario.slug)" class="mt-2 flex flex-col gap-1" role="alert">
          <li v-for="reason in refusals.get(scenario.slug)" :key="reason" class="flex items-start gap-2 text-sm text-toned">
            <UIcon name="i-lucide-octagon-x" class="mt-0.5 size-4 shrink-0 text-error" aria-hidden="true" />
            <span>{{ reason }}</span>
          </li>
        </ul>
        <ul class="mt-2 flex flex-col">
          <li v-for="component in scenario.components" :key="component.sheetRow">
            <button type="button" class="component-row" :aria-label="`${componentText(component)}, ${spanText(component)}, row ${component.sheetRow}: edit`" data-testid="scenario-component" @click="editComponent(scenario, component)">
              <span class="min-w-0 text-start">
                <span class="block text-sm text-toned">{{ componentText(component) }}</span>
                <span class="block text-xs text-muted">{{ spanText(component) }}, row {{ component.sheetRow }}</span>
              </span>
              <UIcon name="i-lucide-pencil" class="size-4 shrink-0 text-dimmed" aria-hidden="true" />
            </button>
          </li>
        </ul>
        <UButton label="Add a component" icon="i-lucide-plus" color="neutral" variant="link" size="sm" class="mt-1 px-0" :disabled="store.state.writing" data-testid="scenario-add-component" @click="editComponent(scenario, null)" />
      </article>
    </div>
    <ComponentDialog v-if="editing" v-model:open="componentOpen" :scenario="editing.scenario" :component="editing.component" />
    <ScenarioNameDialog v-if="naming" v-model:open="nameOpen" :scenario="naming.scenario" :mode="naming.mode" :taken="taken" />
    <StartingScenariosDialog v-model:open="startingOpen" :year="year" :grants="grants" :tab-missing="tabMissing" :taken="taken" />
  </AppCard>
</template>

<style scoped>
.scenario-card {
  border: 1px solid var(--border-default);
  border-radius: var(--radius-control);
  padding: 0.75rem;
}

.component-row {
  display: flex;
  width: 100%;
  min-height: 2.75rem;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.25rem 0.25rem;
  border-radius: var(--radius-control);
}

.component-row:hover {
  background: var(--surface-elevated);
}

li + li > .component-row {
  border-top: 1px solid var(--border-default);
}
</style>
