<script setup lang="ts">
import { computed } from 'vue'

import AppCard from '../../../../shared/ui/AppCard.vue'
import PageHeader from '../../../../shared/ui/PageHeader.vue'
import { useLoansBooks } from '../../workbook/application/loansStore'

/** The Loans Overview, empty until the app can keep loans. */
const { state } = useLoansBooks()

const where = computed(() => (state.choice?.source === 'drive' ? `on Google Drive as ${state.choice.name}` : 'in this browser'))
</script>

<template>
  <section class="flex max-w-measure flex-col gap-6">
    <PageHeader title="Overview" />
    <AppCard>
      <div class="flex flex-col gap-1 px-4 py-6 sm:px-5" data-testid="loans-empty">
        <p class="text-base font-medium text-highlighted">No loans yet</p>
        <p class="text-sm text-muted">Your Loans file is ready, kept {{ where }}. The app cannot add loans to it yet.</p>
      </div>
    </AppCard>
  </section>
</template>
