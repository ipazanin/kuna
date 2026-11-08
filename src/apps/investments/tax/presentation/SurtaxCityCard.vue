<script setup lang="ts">
import { computed } from 'vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import USelectMenu from '@nuxt/ui/components/SelectMenu.vue'

import { CITY_WITHOUT_SURTAX, cityOfValue } from '../domain/citySurtax'
import type { YearSurtax } from '../domain/citySurtax'
import { SURTAX_CITIES_2023 } from '../domain/surtaxRates2023'
import { spelledOut, surtaxCityChoices } from './surtaxCityChoices'
import { words } from './words'
import { SETTING_WRITES } from '../../workbook/application/settingWrites'
import { useInvestmentsBooks } from '../../workbook/application/investmentsStore'
import { SURTAX_CITY_2023_KEY } from '../../workbook/domain/investmentSettings'
import { percentText } from '../../../../shared/money/percent'
import { setSetting } from '../../../../shared/storage/application/settingWrites'
import { recordsOf } from '../../../../shared/storage/domain/recordsRead'
import { settingValue } from '../../../../shared/storage/domain/settingRows'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import AppCard from '../../../../shared/ui/AppCard.vue'
import FormGrid from '../../../../shared/ui/FormGrid.vue'

/** Asks once where the owner lived in 2023, from Porezna's table of that year, and keeps the answer in the Investments file. */
const props = defineProps<{
  surtax: YearSurtax
}>()

const store = useInvestmentsBooks()
const writes = useRecordWrites(store)
const text = words.surtaxCity

/** Stands in for no answer, since the list takes no blank value. */
const NOT_CHOSEN = '-'

const items = [
  { label: text.notChosen, value: NOT_CHOSEN },
  ...surtaxCityChoices(SURTAX_CITIES_2023).map(({ city, kind, place, spelled }) => ({ label: spelled, value: city.code, description: text.place(text.kinds[kind], spelledOut(city.office)), place })),
  { label: text.unlisted, value: CITY_WITHOUT_SURTAX },
]

/** The rows as stored, a value the reader refused among them, so a choice changes or clears it. */
const rows = computed(() => (store.state.records === null ? [] : recordsOf(store.state.records.settings)))
const stored = computed(() => settingValue(rows.value, SURTAX_CITY_2023_KEY))
const chosen = computed(() => (cityOfValue(stored.value) === null ? NOT_CHOSEN : stored.value))

const help = computed(() => {
  const { surtax } = props
  if (surtax.kind !== 'due') return text.help
  return surtax.city.kind === 'listed' ? text.listed(percentText(surtax.rate)) : text.unlistedHelp
})

/** The one line the card folds to once a city is known. */
const summary = computed(() => {
  const { surtax } = props
  if (surtax.kind !== 'due') return undefined
  return surtax.city.kind === 'listed' ? text.summary(spelledOut(surtax.city.city.name), percentText(surtax.rate)) : text.unlisted
})

async function choose(value: string): Promise<void> {
  const saved = value === NOT_CHOSEN ? '' : value
  if (saved === stored.value) return
  const held = rows.value
  await writes.write(saved === '' ? text.cleared : text.chosen, (unit) => setSetting(unit, SETTING_WRITES, held, SURTAX_CITY_2023_KEY, saved), {
    failedTitle: text.notSaved,
    key: SURTAX_CITY_2023_KEY,
    shownAtOnce: true,
  })
}
</script>

<template>
  <AppCard :title="text.title" :subtitle="text.subtitle" collapse-id="investments.tax.surtax-city" :summary="summary" :start-collapsed="chosen !== NOT_CHOSEN" data-testid="tax-surtax-city">
    <div class="px-4 pt-3 pb-4 sm:px-5">
      <FormGrid>
        <UFormField :label="text.field" :help="help">
          <USelectMenu
            :model-value="chosen"
            :items="items"
            value-key="value"
            :filter-fields="['label', 'place']"
            :loading="writes.saving(SURTAX_CITY_2023_KEY)"
            :disabled="writes.saving(SURTAX_CITY_2023_KEY)"
            class="w-full"
            data-testid="tax-surtax-city-choice"
            @update:model-value="choose(String($event))"
          />
        </UFormField>
      </FormGrid>
    </div>
  </AppCard>
</template>
