<script setup lang="ts">
import PageHeader from '../../../../shared/ui/PageHeader.vue'
import LoansBooksCard from './LoansBooksCard.vue'
import { words } from './words'
</script>

<template>
  <section class="flex max-w-measure flex-col gap-6">
    <PageHeader :title="words.title" :description="words.description" />
    <LoansBooksCard />
  </section>
</template>
