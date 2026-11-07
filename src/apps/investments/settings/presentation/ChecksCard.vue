<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import USwitch from '@nuxt/ui/components/Switch.vue'

import { writeCheck } from '../../overview/application/checkWrites'
import { thresholdText } from '../../overview/presentation/checkLines'
import { words as overviewWords } from '../../overview/presentation/words'
import { useInvestmentsBooks } from '../../workbook/application/investmentsStore'
import { CHECKS, CHECK_DEFAULTS } from '../../workbook/domain/checkSetting'
import type { CheckName, CheckSetting } from '../../workbook/domain/checkSetting'
import { HUNDRED_PERCENT } from '../../workbook/domain/investmentFields'
import { words } from './words'
import { DECIMAL_ZERO, decimalShown, typedDecimal } from '../../../../shared/money/decimal'
import type { Decimal } from '../../../../shared/money/decimal'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import AppCard from '../../../../shared/ui/AppCard.vue'
import FormGrid from '../../../../shared/ui/FormGrid.vue'

/**
 * Each portfolio check's threshold and switch, written when a field is left or a switch turns, with Undo. The switch sits
 * in the field's hint and comes first, so the field's label names the threshold, which takes the field's id last.
 */
const store = useInvestmentsBooks()
const { state } = store
const writes = useRecordWrites(store)
const text = words.checks
const labels = overviewWords.checks.labels

const settings = computed((): readonly CheckSetting[] => state.workbook?.book.checks ?? [])
const heldOf = (check: CheckName): CheckSetting | null => settings.value.find((setting) => setting.check === check) ?? null
const thresholdOf = (check: CheckName): Decimal => heldOf(check)?.threshold ?? CHECK_DEFAULTS[check]

const shown = computed(() => Object.fromEntries(CHECKS.map((check) => [check, decimalShown(thresholdOf(check))])) as Record<CheckName, string>)

/** A write or an Undo resets only the field of the check it changed, so what another field holds stays. */
const typed = ref<Record<CheckName, string>>({ ...shown.value })
watch(shown, (now, before) => {
  for (const check of CHECKS) {
    if (now[check] !== before[check]) typed.value[check] = now[check]
  }
})

function typedThreshold(check: CheckName): Decimal | null {
  const threshold = typedDecimal(typed.value[check])
  return threshold === null || threshold <= DECIMAL_ZERO || threshold > HUNDRED_PERCENT ? null : threshold
}

async function commit(check: CheckName): Promise<void> {
  const threshold = typedThreshold(check)
  if (threshold === null || threshold === thresholdOf(check)) return
  await writes.write(text.changed(labels[check]), (unit) => writeCheck(unit, heldOf(check), check, threshold, heldOf(check)?.off !== true), {
    key: check,
    failedTitle: text.notChanged,
    shownAtOnce: true,
  })
}

async function switchTo(check: CheckName, on: boolean): Promise<void> {
  await writes.write(on ? text.switchedOn(labels[check]) : text.switchedOff(labels[check]), (unit) => writeCheck(unit, heldOf(check), check, thresholdOf(check), on), {
    key: `on-${check}`,
    failedTitle: text.notChanged,
    shownAtOnce: true,
  })
}
</script>

<template>
  <AppCard v-if="state.workbook !== null" :title="text.title" :subtitle="text.subtitle" data-testid="investments-checks">
    <FormGrid class="px-4 pt-1 pb-4 sm:px-5">
      <UFormField
        v-for="check in CHECKS"
        :key="check"
        :label="labels[check]"
        :help="text.standard(thresholdText(check, CHECK_DEFAULTS[check]))"
        :error="typedThreshold(check) === null ? text.error : false"
        :data-check="check"
        data-testid="check-setting"
      >
        <template #hint>
          <USwitch
            :id="`check-on-${check}`"
            :model-value="heldOf(check)?.off !== true"
            :loading="writes.saving(`on-${check}`)"
            :label="text.on"
            :aria-label="`${labels[check]}, ${text.on}`"
            data-testid="check-on"
            @update:model-value="switchTo(check, $event)"
          />
        </template>
        <UInput :id="`check-threshold-${check}`" v-model="typed[check]" inputmode="decimal" class="w-28" :loading="writes.saving(check)" data-testid="check-threshold" @change="commit(check)">
          <template v-if="check !== 'target-gap'" #trailing><span class="text-muted">%</span></template>
        </UInput>
      </UFormField>
    </FormGrid>
  </AppCard>
</template>
