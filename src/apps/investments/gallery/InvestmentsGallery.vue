<script setup lang="ts">
import type { HoldingMix } from '../holdings/domain/holdingMix'
import { mixDonut } from '../holdings/presentation/mixDonut'
import { words } from '../holdings/presentation/words'
import type { ClassGroup } from '../workbook/domain/mixGroup'
import { moneyFromAmount, ratioOf, sumMoney } from '../../../shared/money/money'
import DonutCard from '../../../shared/ui/DonutCard.vue'

/** The investments' own specimens in the gallery: the class ring with every class held, so each class colour shows. Only development and fake builds load it. */
const CLASSES: readonly (readonly [ClassGroup, number])[] = [
  ['stocks', 41_200],
  ['bonds', 18_400],
  ['money-market', 9_600],
  ['gold', 6_300],
  ['crypto', 3_900],
  ['cash', 2_150],
]
const whole = sumMoney(CLASSES.map(([, amount]) => moneyFromAmount(amount)))
const classMix: HoldingMix<'class'> = {
  mix: 'class',
  parts: CLASSES.map(([group, amount]) => ({ group, value: moneyFromAmount(amount), share: ratioOf(moneyFromAmount(amount), whole) })),
  whole,
  unknown: moneyFromAmount(0),
  missing: [],
}
const ring = mixDonut(classMix, { accounts: [] }, null)
</script>

<template>
  <div class="flex flex-col gap-4" data-dev-only="DEV-GALLERY-ONLY-DO-NOT-SHIP">
    <h3 class="type-label">Class ring</h3>
    <DonutCard :title="words.mixes.titles.class" :description="ring.description" :parts="ring.parts" :total="ring.total" :total-label="ring.totalLabel" data-testid="gallery-class-ring" />
  </div>
</template>
