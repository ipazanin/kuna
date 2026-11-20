<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UColorPicker from '@nuxt/ui/components/ColorPicker.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import UPopover from '@nuxt/ui/components/Popover.vue'
import URadioGroup from '@nuxt/ui/components/RadioGroup.vue'

import { colourDistance, isHexColour } from '../charts/colour'
import { paintToken } from '../charts/ownColours'
import { SWATCHES, nearestPassing, ownSwatch, passesInLight, swatchOf } from '../charts/swatches'
import NoteLine from './NoteLine.vue'
import { words } from './words'

/**
 * A swatch button that opens a pop-up of the palette's named swatches, with a blank choice first, such as a category's
 * bucket colour, and an own colour below them. The arrow keys move between the swatches, and each is a 44 px target.
 * While the own colour is open the swatches step aside, so the pop-up fits a laptop's window and a phone's. An own
 * colour too pale for the light theme is not taken, and the nearest one that passes is offered in its place.
 */
const props = defineProps<{
  /** What the colour belongs to, as the pop-up's heading, such as "Colour of Software". */
  title: string
  /** The choice stored as blank, by its name and the colour token it paints with. */
  blank: { readonly name: string; readonly token: string }
  /** A line under the swatches about the choice, such as who else wears it. */
  note?: string | undefined
  /** A warning under the swatches, such as another group whose colour looks the same. */
  warning?: string | undefined
}>()

const chosen = defineModel<string>({ required: true })

/** The radio value of the blank choice, which no swatch's hex can be. */
const BLANK = 'blank'

const choices = computed(() => [
  { value: BLANK, name: props.blank.name, token: props.blank.token, class: 'col-span-full' },
  ...SWATCHES.map((swatch) => ({ value: swatch.hex, name: swatch.name, token: paintToken(swatch), class: 'size-11' })),
])

/** What the stored value paints: a swatch of the palette, an own colour, or blank for anything else, which stays as stored until a choice is made. */
const picked = computed(() => {
  const swatch = swatchOf(chosen.value)
  return swatch === null ? { value: BLANK, name: props.blank.name, token: props.blank.token } : { value: swatch.hex, name: swatch.name, token: paintToken(swatch) }
})

const otherOpen = ref(false)
/** The own colour being typed or dragged, as #rrggbb in lower case, before it is taken. */
const draft = ref('')

watch(otherOpen, (opened) => {
  if (opened) draft.value = swatchOf(chosen.value)?.own === true ? chosen.value.trim().toLowerCase() : ''
})

/** Where the colour picker's handles sit: the draft once it is a whole code, else the colour chosen now. */
const wheelColour = computed(() => (isHexColour(draft.value) ? draft.value : (swatchOf(chosen.value)?.hex ?? SWATCHES[0]!.hex)))

/** Takes a typed or dragged colour when it shows in the light theme. One that does not stays a draft with a passing one offered. */
function tryOwn(typed: string | undefined): void {
  const code = (typed ?? '').trim().toLowerCase()
  draft.value = code
  if (isHexColour(code) && passesInLight(code)) chosen.value = code
}

/** How far the colour picker may move a code it was given when it redraws, which is rounding and not a pick. */
const WHEEL_ROUNDING = 0.005

/** Takes a colour from the picker's handles, but not the picker giving back, rounded, the colour it was set to. */
function fromWheel(code: string | undefined): void {
  if (code === undefined || colourDistance(code.toLowerCase(), wheelColour.value) < WHEEL_ROUNDING) return
  tryOwn(code)
}

/** The nearest colour that passes, while the draft is a whole colour code too pale to take. */
const offered = computed(() => (isHexColour(draft.value) && !passesInLight(draft.value) ? ownSwatch(nearestPassing(draft.value)) : null))
const offeredToken = computed(() => (offered.value === null ? null : paintToken(offered.value)))

function takeOffered(): void {
  const passing = offered.value?.hex
  if (passing === undefined) return
  draft.value = passing
  chosen.value = passing
}
</script>

<template>
  <UPopover :content="{ align: 'start', collisionPadding: 12 }">
    <UButton color="neutral" variant="outline" size="sm" square :aria-label="`${title}: ${picked.name}`" :title="picked.name" data-testid="colour-swatch-button">
      <span class="swatch size-4" :style="{ background: `var(${picked.token})` }" aria-hidden="true" />
    </UButton>
    <template #content>
      <div class="flex max-h-(--reka-popover-content-available-height) w-[17.5rem] max-w-[calc(100vw-2rem)] flex-col gap-2 overflow-y-auto p-3" data-testid="colour-swatch-picker">
        <URadioGroup
          :model-value="picked.value"
          :items="choices"
          value-key="value"
          label-key="name"
          :legend="title"
          orientation="horizontal"
          :ui="{
            fieldset: 'grid grid-cols-5 gap-2',
            legend: 'mb-2 type-card-title',
            item: otherOpen ? 'hidden' : 'relative h-11',
            container: 'absolute inset-0 z-control h-auto',
            base: 'size-full rounded-md ring-0 data-[state=checked]:ring-2 data-[state=checked]:ring-offset-2 data-[state=checked]:ring-inverted data-[state=checked]:ring-offset-bg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary',
            indicator: 'hidden',
            wrapper: 'ms-0 size-full',
            label: 'flex size-full items-center gap-2 font-normal type-body',
          }"
          @update:model-value="chosen = $event === BLANK ? '' : String($event)"
        >
          <template #label="{ item }">
            <span class="swatch shrink-0" :class="item.value === BLANK ? 'size-6' : 'size-full'" :style="{ background: `var(${item.token})` }" data-testid="colour-swatch">
              <UIcon v-if="item.value === picked.value" name="i-lucide-check" class="size-4 text-on-fill" />
            </span>
            <span :class="item.value === BLANK ? '' : 'sr-only'">{{ item.name }}</span>
          </template>
        </URadioGroup>
        <UButton
          :label="words.swatchPicker.otherColour"
          color="neutral"
          variant="ghost"
          size="sm"
          :trailing-icon="otherOpen ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
          :aria-expanded="otherOpen"
          class="self-start"
          data-testid="colour-swatch-other"
          @click="otherOpen = !otherOpen"
        />
        <div v-if="otherOpen" class="flex flex-col gap-2" data-testid="colour-swatch-own">
          <UColorPicker :model-value="wheelColour" size="sm" class="self-center" @update:model-value="fromWheel" />
          <UInput
            :model-value="draft.toUpperCase()"
            :placeholder="words.swatchPicker.codePlaceholder"
            :aria-label="words.swatchPicker.code"
            size="sm"
            class="w-full"
            data-testid="colour-swatch-code"
            @update:model-value="tryOwn(String($event))"
          >
            <template #leading>
              <span class="swatch size-4" :style="{ background: isHexColour(draft) ? draft : 'transparent' }" aria-hidden="true" />
            </template>
          </UInput>
          <div v-if="offered !== null" class="flex flex-col gap-1.5" data-testid="colour-swatch-refused">
            <NoteLine tone="warning">{{ words.swatchPicker.tooPale(draft.toUpperCase()) }}</NoteLine>
            <UButton
              :label="words.swatchPicker.useInstead(offered.hex.toUpperCase())"
              color="neutral"
              variant="outline"
              size="sm"
              class="self-start"
              data-testid="colour-swatch-offered"
              @click="takeOffered"
            >
              <template #leading>
                <span class="swatch size-4" :style="{ background: `var(${offeredToken})` }" aria-hidden="true" />
              </template>
            </UButton>
          </div>
        </div>
        <NoteLine v-if="warning" tone="warning" data-testid="colour-swatch-warning">{{ warning }}</NoteLine>
        <p v-if="note" class="type-caption" data-testid="colour-swatch-note">{{ note }}</p>
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
