<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'

import { words } from './words'
import { isValidOib, oibIn } from '../domain/oib'
import { setSetting } from '../../workbook/application/settingWrites'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import { COMPANY_OIB_KEY } from '../../workbook/domain/spendingSettings'
import { words as spendingWords } from '../../words'
import { recordsOf } from '../../../../shared/storage/domain/recordsRead'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import AppCard from '../../../../shared/ui/AppCard.vue'

/** Settings' Receipts tab: the Company OIB that tells an R1 receipt for the company. */
const store = useSpendingBooks()
const writes = useRecordWrites(store)

const saved = computed(() => store.state.workbook?.settings.companyOib ?? '')
const typed = ref(saved.value)
const tried = ref(false)
watch(saved, (held) => {
  typed.value = held
})

const blank = computed(() => typed.value.trim() === '')
const oib = computed(() => oibIn(typed.value))
const error = computed(() => (!blank.value && !isValidOib(oib.value) ? words.settings.oibWrong : null))

async function save(): Promise<void> {
  tried.value = true
  const records = store.state.records
  if (error.value !== null || records === null) return
  const value = oib.value
  await writes.write(words.settings.saved, (unit) => setSetting(unit, recordsOf(records.settings), COMPANY_OIB_KEY, value), { failedTitle: spendingWords.form.notSaved })
}
</script>

<template>
  <AppCard :title="words.settings.title" :subtitle="words.settings.subtitle" data-testid="spending-receipts-settings">
    <form class="flex flex-col items-start gap-3 px-4 pt-3 pb-4 sm:px-5" @submit.prevent="save">
      <UFormField :label="words.settings.companyOib" :error="(tried && error) || false" class="w-full sm:w-72">
        <UInput v-model="typed" inputmode="numeric" autocomplete="off" class="w-full" data-testid="spending-company-oib" />
      </UFormField>
      <UButton
        type="submit"
        :label="words.settings.save"
        icon="i-lucide-save"
        :disabled="oib === saved && (oib !== '' || blank)"
        :loading="writes.saving('save')"
        data-testid="spending-company-oib-save"
      />
    </form>
  </AppCard>
</template>
