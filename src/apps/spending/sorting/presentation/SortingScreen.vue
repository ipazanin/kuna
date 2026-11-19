<script setup lang="ts">
import CategoriesCard from '../../categories/presentation/CategoriesCard.vue'
import LabelsCard from '../../labels/presentation/LabelsCard.vue'
import { words as screenWords } from '../../screenWords'
import RulesCard from '../../statements/presentation/RulesCard.vue'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import ItemsMoveNotice from '../../workbook/presentation/ItemsMoveNotice.vue'
import PageHeader from '../../../../shared/ui/PageHeader.vue'
import ScreenSkeleton from '../../../../shared/ui/ScreenSkeleton.vue'
import { words } from './words'

/** Categories, labels and the rules that file under them, one card above the other, each with an anchor an old address lands on. */
const { state } = useSpendingBooks()
</script>

<template>
  <section class="flex max-w-measure flex-col gap-6">
    <PageHeader :title="screenWords.sorting" :description="words.description" />
    <ItemsMoveNotice />
    <ScreenSkeleton v-if="state.workbook === null && state.status !== 'error'" :heading="false" :cards="3" data-testid="spending-sorting-loading" />
    <template v-else-if="state.workbook !== null">
      <CategoriesCard />
      <LabelsCard />
      <RulesCard />
    </template>
  </section>
</template>
