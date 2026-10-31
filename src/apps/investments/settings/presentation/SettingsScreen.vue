<script setup lang="ts">
import PageHeader from '../../../../shared/ui/PageHeader.vue'
import PricesCard from '../../prices/presentation/PricesCard.vue'
import AccountsCard from './AccountsCard.vue'
import BenchmarkCard from './BenchmarkCard.vue'
import InvestmentsBooksCard from './InvestmentsBooksCard.vue'
import { words } from './words'
</script>

<template>
  <section class="flex max-w-measure flex-col gap-6">
    <PageHeader :title="words.title" :description="words.description" />
    <InvestmentsBooksCard />
    <AccountsCard />
    <BenchmarkCard />
    <PricesCard />
  </section>
</template>
