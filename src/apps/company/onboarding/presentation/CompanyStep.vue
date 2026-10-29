<script setup lang="ts">
import { computed, ref } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import URadioGroup from '@nuxt/ui/components/RadioGroup.vue'
import USelect from '@nuxt/ui/components/Select.vue'
import USelectMenu from '@nuxt/ui/components/SelectMenu.vue'

import { installedPack } from '../../packs/packContribution'
import { setSettings } from '../../settings/application/settingWrites'
import { currencyProblem, flagText } from '../../settings/domain/settings'
import { CURRENCY_ITEMS, FOLLOW_LANGUAGE, numberStyleItems } from '../../settings/presentation/moneyChoices'
import { useWorkbook } from '../../workbook/application/workbookStore'
import { NO_RECORDS } from '../../../../shared/storage/domain/recordsRead'
import StepCard from './StepCard.vue'
import { useOnboarding } from './useOnboarding'
import { withGoogleAccess } from '../../../../shared/google/withGoogleAccess'

/**
 * The company: its name, its money, and the pack's one question, whose Yes switches on the owner-pay
 * module. For books brought along it confirms what the file says. Continue writes a row for each
 * answer.
 */
const onboarding = useOnboarding()
const store = useWorkbook()
const pack = installedPack().onboarding

const settings = computed(() => store.state.workbook?.settings ?? null)
const held = computed(() => store.state.records?.settings ?? NO_RECORDS)

const name = ref(settings.value?.companyName ?? '')
const currency = ref(settings.value?.currency ?? 'EUR')
const numberLocale = ref(settings.value?.numberLocale || FOLLOW_LANGUAGE)
const packOn = ref(settings.value?.ownerPayModule ? 'yes' : 'no')

const numberStyles = computed(() => numberStyleItems(numberLocale.value))
const currencyError = computed(() => currencyProblem(currency.value))
const answers = computed(() => (pack === null ? [] : [{ label: pack.yes, value: 'yes' }, { label: 'No', value: 'no' }]))

const saving = ref(false)
const failure = ref<string | null>(null)

async function proceed(): Promise<void> {
  if (currencyError.value !== null) return
  saving.value = true
  failure.value = null
  const entries = [
    { key: 'company_name', value: name.value.trim() },
    { key: 'currency', value: currency.value },
    { key: 'number_locale', value: numberLocale.value === FOLLOW_LANGUAGE ? '' : numberLocale.value },
    ...(pack === null ? [] : [{ key: 'owner_pay_module', value: flagText(packOn.value === 'yes') }]),
  ]
  try {
    await withGoogleAccess(store.state.choice?.source === 'drive' ? ['drive.file'] : [], () => store.write('Settings saved', (unit) => setSettings(unit, held.value, entries)))
    await onboarding.next()
  } catch (refused) {
    failure.value = refused instanceof Error ? refused.message : String(refused)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <StepCard title="Your company" :subtitle="onboarding.place.value.path === 'bring' ? 'As the file says. Change what is wrong.' : undefined">
    <UAlert v-if="settings === null" icon="i-lucide-file-question" color="warning" variant="subtle" title="There are no books on screen yet" description="Go back a step to make them." />
    <template v-else>
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField label="Company name" class="sm:col-span-2">
          <UInput v-model="name" placeholder="Example Studio" class="w-full" data-testid="onboarding-company-name" />
        </UFormField>
        <UFormField label="Currency" :error="currencyError ?? false">
          <USelectMenu v-model="currency" :items="[...CURRENCY_ITEMS]" value-key="value" :search-input="{ placeholder: 'Search currencies' }" virtualize class="w-full" />
        </UFormField>
        <UFormField label="Number style">
          <USelect v-model="numberLocale" :items="numberStyles" class="w-full" data-testid="onboarding-number-style" />
        </UFormField>
      </div>

      <template v-if="pack">
        <URadioGroup v-model="packOn" :items="answers" :legend="pack.question" :ui="{ legend: 'text-sm font-medium text-highlighted mb-2', fieldset: 'gap-3' }" data-testid="onboarding-pack" />
      </template>
      <UAlert v-if="failure" icon="i-lucide-triangle-alert" color="error" variant="subtle" title="That did not work" :description="failure" />
    </template>

    <template #actions>
      <UButton label="Continue" trailing-icon="i-lucide-arrow-right" :loading="saving" :disabled="settings === null || currencyError !== null" data-testid="onboarding-continue" @click="proceed" />
    </template>
  </StepCard>
</template>
