<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import type { DateValue } from '@internationalized/date'
import { CalendarDate, parseDate } from '@internationalized/date'
import UButton from '@nuxt/ui/components/Button.vue'
import UCalendar from '@nuxt/ui/components/Calendar.vue'
import UInputDate from '@nuxt/ui/components/InputDate.vue'
import UPopover from '@nuxt/ui/components/Popover.vue'

import { parseCivilDate } from '../calendar/civilDate'
import { intlLocale } from '../text/language'
import { isOutsideLimits, typedDayText } from './dayTyping'
import { words } from './words'

/**
 * A day typed or picked from a calendar, shown in the app's language whatever the browser's, such as 12/07/2026 in English
 * and 12. 07. 2026. in Croatian. Its value is the day as YYYY-MM-DD, and blank while no whole day is typed. It follows each
 * keystroke, so a caller that writes on a day listens to `change`, which comes once the field is left or a day is picked.
 * A whole day typed outside `min` and `max` shows as an error and still reaches the caller, which says why or moves it.
 * Once left, the field shows the caller's value again, so a caller that moves or refuses a day need not hand back a new one.
 */
const props = withDefaults(
  defineProps<{
    modelValue: string
    /** The earliest day it takes, as YYYY-MM-DD. */
    min?: string
    /** The latest day it takes, as YYYY-MM-DD. */
    max?: string
    size?: 'sm' | 'md'
    /** True while a write the field started runs. The calendar button spins. */
    loading?: boolean
    disabled?: boolean
  }>(),
  { size: 'md', loading: false, disabled: false },
)

const emit = defineEmits<{ 'update:modelValue': [day: string]; change: [day: string] }>()

function dayOf(iso: string | undefined): CalendarDate | undefined {
  return iso !== undefined && parseCivilDate(iso) !== null ? parseDate(iso) : undefined
}

/**
 * The day the field holds while it is typed. A value handed back while a person types, such as today for a blank, would
 * start the typing over, so the field takes the value when it is not being typed in, and once it is left.
 */
const day = shallowRef<CalendarDate | undefined>(dayOf(props.modelValue))
const typing = ref(false)
/** The day the field held when it was entered, so leaving it says a change only when the day moved. */
let entered = props.modelValue
function takeValue(): void {
  if (props.modelValue !== typedDayText(day.value)) day.value = dayOf(props.modelValue)
}
watch(
  () => props.modelValue,
  () => {
    if (!typing.value) takeValue()
  },
)

function enter(): void {
  typing.value = true
  entered = typedDayText(day.value)
}

function leave(): void {
  typing.value = false
  const typed = typedDayText(day.value)
  if (typed !== entered) emit('change', typed)
  takeValue()
}

/** The field and the calendar also speak of ranges and of times, which a field of one day never asks for. */
function type(typed: unknown): void {
  day.value = typed instanceof CalendarDate ? typed : undefined
  emit('update:modelValue', typedDayText(day.value))
}

/** The earliest and the latest day the calendar offers, left out when not given. */
const calendarLimits = computed(() => {
  const [earliest, latest] = [dayOf(props.min), dayOf(props.max)]
  return { ...(earliest === undefined ? {} : { minValue: earliest }), ...(latest === undefined ? {} : { maxValue: latest }) }
})

/** The field marks a day outside the limits itself, since its own limits mark each first digit of a year as an error. */
function outsideLimits(typed: DateValue): boolean {
  return isOutsideLimits(typed, props)
}
const picking = ref(false)

/**
 * The day's first digit starts where a text field's text does, each part is as wide as its digits, and the parts stop
 * short of the calendar button, which is 44 px wide on a phone.
 */
const LOOK = { base: 'ps-2 pe-12', segment: 'px-0.5 tabular-nums data-[segment=day]:w-auto data-[segment=month]:w-auto data-[segment=year]:w-auto', trailing: 'pe-0.5' }

/**
 * A part of the day cancels every key but Tab, Escape too, and a dialog does not close on a cancelled Escape. So Escape
 * on a part goes on from the field itself, as it would from any other field.
 */
function passEscape(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || !(event.currentTarget instanceof HTMLElement) || event.target === event.currentTarget) return
  event.stopPropagation()
  event.currentTarget.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
}

function pick(picked: unknown): void {
  type(picked)
  picking.value = false
  entered = typedDayText(day.value)
  emit('change', entered)
}
</script>

<template>
  <UInputDate
    :model-value="day"
    :locale="intlLocale"
    :is-date-unavailable="outsideLimits"
    :size="size"
    :disabled="disabled"
    :ui="LOOK"
    @update:model-value="type"
    @focus="enter"
    @blur="leave"
    @keydown.capture="passEscape"
  >
    <template #trailing>
      <UPopover v-model:open="picking">
        <UButton icon="i-lucide-calendar" color="neutral" variant="link" :size="size === 'sm' ? 'xs' : 'sm'" :aria-label="words.pickDay" :loading="loading" :disabled="disabled" />
        <template #content>
          <UCalendar :model-value="day" :locale="intlLocale" :week-starts-on="1" v-bind="calendarLimits" size="sm" class="p-2" @update:model-value="pick" />
        </template>
      </UPopover>
    </template>
  </UInputDate>
</template>
