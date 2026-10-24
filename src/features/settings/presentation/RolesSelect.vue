<script setup lang="ts">
import { computed } from 'vue'
import UBadge from '@nuxt/ui/components/Badge.vue'
import USelectMenu from '@nuxt/ui/components/SelectMenu.vue'

import { rolesOfText } from '../domain/categoryDrafts'

/**
 * The roles of one category as a menu of the roles the app knows. A role the app does not know,
 * such as a typo typed in a file, shows as a red chip until it is taken off.
 */
const props = defineProps<{
  known: readonly string[]
  error?: string | undefined
}>()

/** The roles as the categories tab writes them, comma separated. */
const roles = defineModel<string>({ required: true })

const picked = computed({
  get: () => [...new Set(rolesOfText(roles.value))],
  set: (chosen: string[]) => {
    roles.value = chosen.join(', ')
  },
})

const items = computed(() => [
  ...props.known.map((role) => ({ label: role, value: role })),
  ...picked.value.filter((role) => !props.known.includes(role)).map((role) => ({ label: `${role}, not a role the app knows`, value: role })),
])
</script>

<template>
  <USelectMenu
    v-model="picked"
    :items="items"
    value-key="value"
    multiple
    :search-input="{ placeholder: 'Search roles' }"
    placeholder="None"
    :color="error ? 'error' : 'neutral'"
    :highlight="Boolean(error)"
    aria-label="Roles"
    size="sm"
    class="w-56"
    data-testid="category-roles"
  >
    <template #default="{ modelValue }">
      <span v-if="!Array.isArray(modelValue) || modelValue.length === 0" class="text-dimmed">None</span>
      <span v-else class="flex min-w-0 flex-wrap gap-1">
        <UBadge
          v-for="role in modelValue"
          :key="String(role)"
          :label="String(role)"
          :color="known.includes(String(role)) ? 'neutral' : 'error'"
          variant="subtle"
          size="xs"
          :data-unknown="known.includes(String(role)) ? undefined : 'true'"
        />
      </span>
    </template>
  </USelectMenu>
</template>
