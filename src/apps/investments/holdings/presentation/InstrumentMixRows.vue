<script setup lang="ts">
import { computed, ref } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import USelectMenu from '@nuxt/ui/components/SelectMenu.vue'

import FactsheetPaste from './FactsheetPaste.vue'
import { COUNTRY_ITEMS, SECTOR_ITEMS } from './instrumentForm'
import { fundMixErrors, words } from './words'
import { mixHasFaults, mixLineTexts, mixSum } from '../domain/fundMixDraft'
import type { FundMix, FundMixFaults, FundMixTexts, MixLineTexts } from '../domain/fundMixDraft'
import { HUNDRED_PERCENT } from '../../workbook/domain/investmentFields'
import { FUND_MIXES } from '../../workbook/domain/mixGroup'
import { formatQuantity } from '../../../../shared/money/moneyFormat'
import ChoiceButtons from '../../../../shared/ui/ChoiceButtons.vue'

/** A fund's own mix by sector and by country, one mix shown at a time, as a whole row of a FormGrid. */
const texts = defineModel<FundMixTexts>({ required: true })

const props = defineProps<{
  faults: FundMixFaults
  /** Whether a save was tried, after which each line shows what it lacks. */
  tried: boolean
}>()

const text = words.instrumentDialog
const MIX_OPTIONS = FUND_MIXES.map((value) => ({ value, label: text.mixes[value] }))
const GROUP_ITEMS: Record<FundMix, { readonly value: string; readonly label: string }[]> = { sector: SECTOR_ITEMS, country: COUNTRY_ITEMS }

const picked = ref<FundMix>(texts.value.sector.length === 0 && texts.value.country.length > 0 ? 'country' : 'sector')
/** Whether the country table from a factsheet is open for a paste. */
const pasting = ref(false)

/** The most places a percent keeps, as many as the file does. */
const PERCENT_PLACES = 12

const lines = computed(() => texts.value[picked.value])
const sum = computed(() => mixSum(lines.value))

const errors = computed(() => fundMixErrors(props.faults))

/** The mix not shown, when one of its lines is wrong. */
const otherToFix = computed(() => FUND_MIXES.find((mix) => mix !== picked.value && mixHasFaults(props.faults, mix)))

const shown = (error: string | null): string | false => (props.tried && error) || false

function replaced(next: MixLineTexts[]): void {
  texts.value = { ...texts.value, [picked.value]: next }
}

function filled(next: MixLineTexts[]): void {
  replaced(next)
  pasting.value = false
}

function update(index: number, field: 'group' | 'percent', value: string): void {
  replaced(lines.value.map((line, at) => (at === index ? { ...line, [field]: value } : line)))
}
</script>

<template>
  <div class="flex flex-col gap-3 sm:col-span-2" data-testid="instrument-mix">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <p class="type-card-title">{{ text.mix }}</p>
      <ChoiceButtons v-model="picked" :options="MIX_OPTIONS" :label="text.mixPick" data-testid="instrument-mix-pick" />
    </div>
    <p class="text-sm text-muted">{{ text.mixHelp }}</p>
    <FactsheetPaste v-if="pasting && picked === 'country'" @fill="filled" @cancel="pasting = false" />
    <ol v-if="lines.length > 0" class="flex flex-col gap-2" :aria-label="text.mixes[picked]">
      <li v-for="(line, index) in lines" :key="line.key" class="grid grid-cols-[minmax(0,1fr)_7rem_auto] items-start gap-2" data-testid="instrument-mix-line">
        <UFormField :error="shown(errors.lines[picked][index]?.group ?? null)">
          <USelectMenu
            :model-value="line.group"
            :items="GROUP_ITEMS[picked]"
            value-key="value"
            :placeholder="text.pickGroup"
            :search-input="picked === 'country' ? { placeholder: text.findCountry } : false"
            :aria-label="text.mixGroup(index + 1)"
            class="w-full"
            data-testid="instrument-mix-group"
            @update:model-value="update(index, 'group', String($event))"
          />
        </UFormField>
        <UFormField :error="shown(errors.lines[picked][index]?.percent ?? null)">
          <UInput
            :model-value="line.percent"
            inputmode="decimal"
            :aria-label="text.mixPercent(index + 1)"
            class="w-full"
            data-testid="instrument-mix-percent"
            @update:model-value="update(index, 'percent', String($event))"
          >
            <template #trailing><span class="text-muted">%</span></template>
          </UInput>
        </UFormField>
        <UButton
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          :aria-label="text.removeLine(index + 1)"
          data-testid="instrument-mix-remove"
          @click="replaced(lines.filter((other) => other.key !== line.key))"
        />
      </li>
    </ol>
    <div class="flex flex-wrap items-center justify-between gap-3">
      <span class="flex flex-wrap gap-2">
        <UButton :label="text.addLine" icon="i-lucide-plus" color="neutral" variant="outline" size="sm" data-testid="instrument-mix-add" @click="replaced([...lines, mixLineTexts('', '')])" />
        <UButton
          v-if="picked === 'country' && !pasting"
          :label="text.paste.open"
          icon="i-lucide-clipboard-paste"
          color="neutral"
          variant="outline"
          size="sm"
          data-testid="instrument-mix-paste-open"
          @click="pasting = true"
        />
      </span>
      <p v-if="lines.length > 0" class="text-sm" :class="sum === HUNDRED_PERCENT ? 'text-toned' : tried ? 'text-error' : 'text-muted'" data-testid="instrument-mix-sum">
        {{ text.mixSum(formatQuantity(sum, PERCENT_PLACES)) }}
      </p>
    </div>
    <p v-if="shown(errors.whole[picked])" class="text-sm text-error" data-testid="instrument-mix-whole">{{ errors.whole[picked] }}</p>
    <p v-if="tried && otherToFix !== undefined" class="text-sm text-error" data-testid="instrument-mix-other">{{ text.mixToFix(text.mixes[otherToFix]) }}</p>
  </div>
</template>
