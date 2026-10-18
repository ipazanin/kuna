<script setup lang="ts">
import { computed, ref } from 'vue'
import USwitch from '@nuxt/ui/components/Switch.vue'
import { useToast } from '@nuxt/ui/composables/useToast'

import { useDisplayNames } from '../../../features/workbook/application/useDisplayNames'
import { useWorkbook } from '../../../features/workbook/application/workbookStore'
import type { Category } from '../../../features/workbook/domain/workbook'
import { PACK_ROLES } from '../domain/packRoles'

/**
 * Whether loans to the owner and their repayments count as owner pay or as financing. The answer
 * lives on the categories tab, in the bucket of the categories with the two loan roles, so the
 * switch writes those cells and reads them back.
 */
const props = defineProps<{
  categories: readonly Category[]
}>()

const store = useWorkbook()
const toast = useToast()
const names = useDisplayNames()
const saving = ref(false)

const loanCategories = computed(() =>
  props.categories.filter((category) => category.roles.includes(PACK_ROLES.ownerLoanOut) || category.roles.includes(PACK_ROLES.ownerLoanRepaid)),
)
const countsAsPay = computed(() => loanCategories.value.length > 0 && loanCategories.value.every((category) => category.bucket === 'owner-pay'))
const mixed = computed(() => !countsAsPay.value && !loanCategories.value.every((category) => category.bucket === 'financing'))
const listed = computed(() => loanCategories.value.map((category) => `${names.value.category(category.slug)} (${category.bucket})`).join(' and '))

async function choose(asPay: boolean): Promise<void> {
  const bucket = asPay ? 'owner-pay' : 'financing'
  saving.value = true
  try {
    await store.changeBuckets(loanCategories.value.map((category) => ({ category: category.slug, expected: category.bucket, bucket })))
    toast.add({
      title: asPay ? 'Loans count as owner pay' : 'Loans count as financing',
      description: `The categories tab now puts ${loanCategories.value.map((category) => category.slug).join(' and ')} in the ${bucket} bucket.`,
      icon: 'i-lucide-check',
      color: 'success',
    })
  } catch (failure) {
    toast.add({ title: 'Not changed', description: failure instanceof Error ? failure.message : String(failure), icon: 'i-lucide-triangle-alert', color: 'error', duration: 10_000 })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <section class="rounded-card border border-default bg-raised p-4 shadow-raised sm:p-5" data-testid="loan-bucket">
    <header class="mb-4">
      <h2 class="text-sm font-medium text-highlighted">Loans to the owner</h2>
      <p class="mt-0.5 text-xs text-muted">From the categories tab: the bucket of the categories with the owner-loan-out and owner-loan-repaid roles.</p>
    </header>
    <p v-if="loanCategories.length === 0" class="text-sm text-muted">No category carries the owner-loan-out or owner-loan-repaid role, so there is nothing to switch.</p>
    <template v-else>
      <USwitch
        :model-value="countsAsPay"
        :loading="saving || store.state.writing"
        :disabled="saving || store.state.writing"
        label="Loans to the owner count as owner pay"
        :description="
          countsAsPay
            ? 'On: a loan is pay taken early and its repayment pay handed back, so both count in owner pay, costs and net. Off moves both to financing, outside profit and loss.'
            : 'Off: loans and their repayments are financing, outside profit and loss. On moves both into owner pay, where they count in costs and net.'
        "
        @update:model-value="choose($event)"
      />
      <p v-if="mixed" class="mt-3 text-xs text-[var(--tone-warning)]">The loan categories sit in different buckets now: {{ listed }}. Switching puts both in one.</p>
    </template>
  </section>
</template>
