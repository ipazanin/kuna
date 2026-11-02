<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'

import { TARGET_WRITES, replaceRows } from '../application/mixWrites'
import type { HoldingMixes } from '../domain/holdingMix'
import { targetedMix } from '../domain/targetMix'
import { groupName } from './mixDonut'
import { words } from './words'
import { useInvestmentsBooks } from '../../workbook/application/investmentsStore'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import { HUNDRED_PERCENT } from '../../workbook/domain/investmentFields'
import { CLASS_GROUPS, MIXES, SECTORS } from '../../workbook/domain/mixGroup'
import type { Mix, MixGroup } from '../../workbook/domain/mixGroup'
import type { Target } from '../../workbook/domain/target'
import { DECIMAL_ZERO, decimalShown, sumDecimal, typedDecimal } from '../../../../shared/money/decimal'
import type { Decimal } from '../../../../shared/money/decimal'
import { formatQuantity } from '../../../../shared/money/moneyFormat'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import AppDialog from '../../../../shared/ui/AppDialog.vue'
import ChoiceButtons from '../../../../shared/ui/ChoiceButtons.vue'
import FormGrid from '../../../../shared/ui/FormGrid.vue'

/** A percent per group of one mix, saved together as the targets in place of those held. */
const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  book: InvestmentBook
  /** The mixes on screen, whose groups held now are offered where a mix has no fixed list. */
  mixes: HoldingMixes
}>()

const store = useInvestmentsBooks()
const writes = useRecordWrites(store)
const text = words.targets.dialog

/** The most places a percent keeps, as many as the file does. */
const PERCENT_PLACES = 12
/** Class first, since it is the usual mix to aim at. */
const MIX_OPTIONS = (['class', ...MIXES.filter((mix) => mix !== 'class')] as const).map((value) => ({ value, label: words.mixes.titles[value] }))

const mix = ref<Mix>('class')
const percents = ref<Record<string, string>>({})
const tried = ref(false)

function heldPercents(of: Mix): Record<string, string> {
  return Object.fromEntries(props.book.targets.filter((target) => target.slice.mix === of).map((target) => [target.slice.group, decimalShown(target.percent)]))
}

watch(open, (opened) => {
  if (!opened) return
  mix.value = targetedMix(props.book.targets)?.mix ?? 'class'
  percents.value = heldPercents(mix.value)
  tried.value = false
})

watch(mix, (picked) => {
  percents.value = heldPercents(picked)
  tried.value = false
})

/**
 * Every group of a fixed list, the classes, the sectors and the accounts, and for currency and country the groups held
 * now and those targeted, so a target can name a group not bought yet.
 */
const groups = computed((): readonly string[] => {
  switch (mix.value) {
    case 'class':
      return CLASS_GROUPS
    case 'sector':
      return SECTORS
    case 'account':
      return props.book.accounts.map((account) => account.id)
    default: {
      const held = props.mixes[mix.value].parts.map((part) => part.group as string)
      const targeted = props.book.targets.filter((target) => target.slice.mix === mix.value).map((target) => target.slice.group as string)
      return [...new Set([...held, ...targeted])]
    }
  }
})

/** A typed percent, null for a blank field, and undefined for one that is not above 0 and at most 100. */
function percentOf(group: string): Decimal | null | undefined {
  const typed = (percents.value[group] ?? '').trim()
  if (typed === '') return null
  const percent = typedDecimal(typed)
  return percent === null || percent <= DECIMAL_ZERO || percent > HUNDRED_PERCENT ? undefined : percent
}

const sum = computed(() => sumDecimal(groups.value.map((group) => percentOf(group) ?? DECIMAL_ZERO)))
const unreadable = computed(() => groups.value.some((group) => percentOf(group) === undefined))
const whole = computed(() => sum.value === HUNDRED_PERCENT)

async function save(): Promise<void> {
  tried.value = true
  if (unreadable.value || !whole.value) return
  const wanted = groups.value.flatMap((group): Omit<Target, 'id'>[] => {
    const percent = percentOf(group)
    return percent === null || percent === undefined ? [] : [{ slice: { mix: mix.value, group } as MixGroup, percent }]
  })
  const saved = await writes.write(text.saved, (unit) => replaceRows(unit, TARGET_WRITES, props.book.targets, wanted), { failedTitle: text.notSaved })
  if (saved) open.value = false
}

async function remove(): Promise<void> {
  const removed = await writes.write(text.removed, (unit) => replaceRows(unit, TARGET_WRITES, props.book.targets, []), { key: 'delete', failedTitle: text.notRemoved })
  if (removed) open.value = false
}
</script>

<template>
  <AppDialog v-model:open="open" :title="words.targets.set" :description="text.description" width="xl">
    <FormGrid id="targets" as="form" data-testid="targets-form" @submit.prevent="save">
      <ChoiceButtons v-model="mix" :options="MIX_OPTIONS" :label="text.mix" class="sm:col-span-2" data-testid="targets-mix" />
      <UFormField v-for="group in groups" :key="`${mix}|${group}`" :label="groupName(mix, group, book)" :error="tried && percentOf(group) === undefined ? text.percentError : false">
        <UInput v-model="percents[group]" inputmode="decimal" class="w-full" :data-group="group" data-testid="targets-percent">
          <template #trailing><span class="text-muted">%</span></template>
        </UInput>
      </UFormField>
      <p class="text-sm sm:col-span-2" :class="whole ? 'text-toned' : tried ? 'text-error' : 'text-muted'" data-testid="targets-sum">
        {{ words.instrumentDialog.mixSum(formatQuantity(sum, PERCENT_PLACES)) }}
      </p>
      <p v-if="tried && !whole" class="text-sm text-error sm:col-span-2" data-testid="targets-whole">{{ text.whole }}</p>
    </FormGrid>
    <template #start>
      <UButton
        v-if="book.targets.length > 0"
        :label="text.remove"
        icon="i-lucide-trash-2"
        color="error"
        variant="ghost"
        :loading="writes.saving('delete')"
        :disabled="writes.busy.value"
        data-testid="targets-remove"
        @click="remove"
      />
    </template>
    <template #end>
      <UButton :label="text.cancel" color="neutral" variant="ghost" @click="open = false" />
      <UButton type="submit" form="targets" :label="text.save" icon="i-lucide-save" :loading="writes.saving('save')" :disabled="writes.busy.value" data-testid="targets-save" />
    </template>
  </AppDialog>
</template>
