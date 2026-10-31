<script setup lang="ts">
import { computed, ref } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import USelect from '@nuxt/ui/components/Select.vue'

import AccountDialog from '../../settings/presentation/AccountDialog.vue'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import { words } from './words'

/** One of the file's accounts by its id, or a new one added on the spot. */
const account = defineModel<string>({ required: true })

const props = defineProps<{
  label: string
  error: string | false
  book: InvestmentBook
  testId: string
}>()

const adding = ref(false)
const items = computed(() => props.book.accounts.map((candidate) => ({ label: candidate.name, value: candidate.id as string })))
</script>

<template>
  <UFormField :label="label" :error="error">
    <div class="flex items-center gap-2">
      <USelect v-model="account" :items="items" class="min-w-0 flex-1" :data-testid="testId" />
      <UButton icon="i-lucide-plus" color="neutral" variant="outline" :aria-label="words.fields.newAccount" :data-testid="`${testId}-new`" @click="adding = true" />
    </div>
    <AccountDialog v-model:open="adding" :account="null" @saved="account = $event.id" />
  </UFormField>
</template>
