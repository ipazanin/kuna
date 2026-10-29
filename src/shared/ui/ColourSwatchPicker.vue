<script lang="ts">
/** One choice of the picker: the value it stores, its name in plain words and the colour token it paints with. */
export interface SwatchChoice {
  readonly value: string
  readonly name: string
  readonly token: string
}
</script>

<script setup lang="ts">
import { computed } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'
import UPopover from '@nuxt/ui/components/Popover.vue'
import URadioGroup from '@nuxt/ui/components/RadioGroup.vue'

/**
 * A swatch button that opens a pop-up of named swatches, with a blank choice first, such as a
 * category's bucket colour. The arrow keys move between the swatches, and each is a 44 px target.
 */
const props = defineProps<{
  /** What the colour belongs to, as the pop-up's heading, such as "Colour of Software". */
  title: string
  /** The choice stored as blank. */
  blank: Omit<SwatchChoice, 'value'>
  swatches: readonly SwatchChoice[]
  /** A line under the swatches about the choice, such as who else wears it. */
  note?: string
}>()

const chosen = defineModel<string>({ required: true })

/** The radio value of the blank choice, which no swatch's value can be. */
const BLANK = 'blank'

const choices = computed(() => [{ ...props.blank, value: BLANK, class: 'col-span-full' }, ...props.swatches.map((swatch) => ({ ...swatch, class: 'size-11' }))])

/** A value outside the swatches reads as blank, and stays as stored until a swatch is picked. */
const picked = computed(() => choices.value.find((choice) => choice.value !== BLANK && choice.value.toLowerCase() === chosen.value.trim().toLowerCase()) ?? choices.value[0]!)
</script>

<template>
  <UPopover :content="{ align: 'start', collisionPadding: 12 }">
    <UButton color="neutral" variant="outline" size="sm" square :aria-label="`${title}: ${picked.name}`" :title="picked.name" data-testid="colour-swatch-button">
      <span class="swatch size-4" :style="{ background: `var(${picked.token})` }" aria-hidden="true" />
    </UButton>
    <template #content>
      <div class="flex w-[17.5rem] max-w-[calc(100vw-2rem)] flex-col gap-2 p-3" data-testid="colour-swatch-picker">
        <URadioGroup
          :model-value="picked.value"
          :items="choices"
          value-key="value"
          label-key="name"
          :legend="title"
          orientation="horizontal"
          :ui="{
            fieldset: 'grid grid-cols-5 gap-2',
            legend: 'mb-2 text-sm font-medium text-highlighted',
            item: 'relative h-11',
            container: 'absolute inset-0 z-control h-auto',
            base: 'size-full rounded-md ring-0 data-[state=checked]:ring-2 data-[state=checked]:ring-offset-2 data-[state=checked]:ring-(--ink-strong) data-[state=checked]:ring-offset-(--ui-bg) focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary',
            indicator: 'hidden',
            wrapper: 'ms-0 size-full',
            label: 'flex size-full items-center gap-2 text-sm font-normal text-default',
          }"
          @update:model-value="chosen = $event === BLANK ? '' : String($event)"
        >
          <template #label="{ item }">
            <span class="swatch shrink-0" :class="item.value === BLANK ? 'size-6' : 'size-full'" :style="{ background: `var(${item.token})` }" data-testid="colour-swatch">
              <UIcon v-if="item.value === picked.value" name="i-lucide-check" class="size-4 text-(--chart-on-fill)" />
            </span>
            <span :class="item.value === BLANK ? '' : 'sr-only'">{{ item.name }}</span>
          </template>
        </URadioGroup>
        <p v-if="note" class="text-xs text-muted" data-testid="colour-swatch-note">{{ note }}</p>
      </div>
    </template>
  </UPopover>
</template>

<style scoped>
.swatch {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.08);
}
</style>
