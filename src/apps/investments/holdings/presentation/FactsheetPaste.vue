<script setup lang="ts">
import { computed, ref } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'
import UTextarea from '@nuxt/ui/components/Textarea.vue'

import { readFactsheetCountries } from '../domain/factsheetCountries'
import { COUNTRY_ITEMS } from './instrumentForm'
import { mixLineTexts } from '../domain/fundMixDraft'
import type { MixLineTexts } from '../domain/fundMixDraft'
import { words } from './words'
import { decimalShown } from '../../../../shared/money/decimal'
import { plural } from '../../../../shared/text/translation'

/** A country table pasted from a fund's factsheet, what Kuna read of each line with every line it could not read flagged, and the lines it fills the mix with once confirmed. */
const emit = defineEmits<{
  fill: [lines: MixLineTexts[]]
  cancel: []
}>()

const text = words.instrumentDialog
const pasted = ref('')
const read = computed(() => readFactsheetCountries(pasted.value))
const filling = computed(() => read.value.flatMap((line) => (line.group === null || line.percent === null ? [] : [mixLineTexts(line.group, decimalShown(line.percent))])))

function groupLabel(group: string): string {
  return COUNTRY_ITEMS.find((item) => item.value === group)?.label ?? group
}

function lineText(line: (typeof read.value)[number]): string {
  if (line.group === null) return text.paste.notRead(line.text)
  return line.percent === null ? text.paste.noPercent(groupLabel(line.group)) : text.paste.read(groupLabel(line.group), decimalShown(line.percent))
}
</script>

<template>
  <div class="flex flex-col gap-3" data-testid="instrument-mix-paste">
    <UFormField :label="text.paste.label" :help="text.paste.help">
      <UTextarea v-model="pasted" :rows="5" autoresize class="w-full" data-testid="instrument-mix-paste-text" />
    </UFormField>
    <ul v-if="read.length > 0" class="flex flex-col gap-1" :aria-label="text.paste.lines" data-testid="instrument-mix-paste-lines">
      <li
        v-for="(line, index) in read"
        :key="index"
        class="flex items-start gap-2 type-caption"
        :class="line.group === null || line.percent === null ? 'text-warning' : 'text-toned'"
        :data-read="String(line.group !== null && line.percent !== null)"
        data-testid="instrument-mix-paste-line"
      >
        <UIcon :name="line.group === null || line.percent === null ? 'i-lucide-triangle-alert' : 'i-lucide-check'" class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span class="min-w-0 break-words">{{ lineText(line) }}</span>
      </li>
    </ul>
    <div class="flex flex-wrap justify-end gap-2">
      <UButton :label="text.cancel" color="neutral" variant="outline" size="sm" data-testid="instrument-mix-paste-cancel" @click="emit('cancel')" />
      <UButton
        :label="plural(text.paste.fill(filling.length), filling.length)"
        icon="i-lucide-check"
        size="sm"
        :disabled="filling.length === 0"
        data-testid="instrument-mix-paste-fill"
        @click="emit('fill', filling)"
      />
    </div>
  </div>
</template>
