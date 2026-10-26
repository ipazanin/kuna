<script setup lang="ts">
import { computed, ref } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import URadioGroup from '@nuxt/ui/components/RadioGroup.vue'
import USelect from '@nuxt/ui/components/Select.vue'
import USelectMenu from '@nuxt/ui/components/SelectMenu.vue'

import { googleAccess } from '../../../shared/google/googleAuth'
import { folderPathOf, folderTrail } from '../../../shared/text/folderPath'
import { installedPack } from '../../packs/packContribution'
import { setSettings } from '../../settings/application/settingWrites'
import { currencyProblem, flagText, heldSettingValue } from '../../settings/domain/settings'
import { CURRENCY_ITEMS, numberStyleItems } from '../../settings/presentation/moneyChoices'
import { useWorkbook } from '../../workbook/application/workbookStore'
import { NO_RECORDS } from '../../workbook/domain/recordsRead'
import StepCard from './StepCard.vue'
import { useOnboarding } from './useOnboarding'

/**
 * The company: its name, its money, and the pack's one question, whose Yes switches on the owner-pay
 * module. With Yes and Drive read allowed, the pack's folders are chosen here too. For books brought
 * along it confirms what the file says. Continue writes a row for each answer.
 */
const onboarding = useOnboarding()
const store = useWorkbook()
const pack = installedPack().onboarding

const settings = computed(() => store.state.workbook?.settings ?? null)
const held = computed(() => store.state.records?.settings ?? NO_RECORDS)

const name = ref(settings.value?.companyName ?? '')
const currency = ref(settings.value?.currency ?? 'EUR')
const numberLocale = ref(settings.value?.numberLocale ?? 'en-GB')
const packOn = ref(settings.value?.ownerPayModule ? 'yes' : 'no')
const folders = ref<Record<string, readonly string[]>>(Object.fromEntries((pack?.folders ?? []).map((folder) => [folder.key, folderPathOf(heldSettingValue(held.value, folder.key) ?? '')])))

const numberStyles = computed(() => numberStyleItems(numberLocale.value))
const currencyError = computed(() => currencyProblem(currency.value))
const readsDrive = computed(() => store.state.choice?.source === 'drive' && (googleAccess().scopes?.includes('drive.readonly') ?? false))
const answers = computed(() => (pack === null ? [] : [{ label: pack.yes, value: 'yes' }, { label: 'No', value: 'no' }]))

const choosing = ref<string | null>(null)
const saving = ref(false)
const failure = ref<string | null>(null)

async function chooseFolder(key: string, holds: string): Promise<void> {
  choosing.value = key
  failure.value = null
  try {
    const picked = await store.pickDriveFolder(`Choose the folder of ${holds}`)
    if (picked !== null && picked.path === null) {
      failure.value = 'The app cannot read the folders above the one picked, so it cannot name its path. Choose it later on Settings, General.'
    } else if (picked?.path) {
      folders.value = { ...folders.value, [key]: picked.path }
    }
  } catch (refused) {
    failure.value = refused instanceof Error ? refused.message : String(refused)
  } finally {
    choosing.value = null
  }
}

async function proceed(): Promise<void> {
  if (currencyError.value !== null) return
  saving.value = true
  failure.value = null
  const entries = [
    { key: 'company_name', value: name.value.trim() },
    { key: 'currency', value: currency.value },
    { key: 'number_locale', value: numberLocale.value },
    ...(pack === null ? [] : [{ key: 'owner_pay_module', value: flagText(packOn.value === 'yes') }]),
    ...(packOn.value === 'yes' ? Object.entries(folders.value).map(([key, path]) => ({ key, value: path.join('/') })) : []),
  ]
  try {
    await store.write('Settings saved', (unit) => setSettings(unit, held.value, entries))
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
        <div v-if="packOn === 'yes'" class="flex flex-col gap-3" data-testid="onboarding-pack-folders">
          <template v-if="readsDrive">
            <div v-for="folder in pack.folders" :key="folder.key" class="flex flex-wrap items-center justify-between gap-2">
              <div class="min-w-0">
                <p class="text-sm text-highlighted">The folder of {{ folder.holds }}</p>
                <p class="identifier text-xs break-words text-muted">{{ folders[folder.key]?.length ? folderTrail(folders[folder.key]!) : 'Not chosen yet' }}</p>
              </div>
              <UButton label="Choose folder" icon="i-lucide-folder-search" color="neutral" variant="outline" size="sm" :loading="choosing === folder.key" :disabled="choosing !== null" @click="chooseFolder(folder.key, folder.holds)" />
            </div>
          </template>
          <p v-else class="text-sm text-muted">Choose the folders of {{ pack.folders.map((folder) => folder.holds).join(' and of ') }} later on Settings, General. Reading them needs Drive read access.</p>
        </div>
      </template>
      <UAlert v-if="failure" icon="i-lucide-triangle-alert" color="error" variant="subtle" title="That did not work" :description="failure" />
    </template>

    <template #actions>
      <UButton label="Continue" trailing-icon="i-lucide-arrow-right" :loading="saving" :disabled="settings === null || currencyError !== null" data-testid="onboarding-continue" @click="proceed" />
    </template>
  </StepCard>
</template>
