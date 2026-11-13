<script setup lang="ts">
import { computed, provide, ref } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import UCheckbox from '@nuxt/ui/components/Checkbox.vue'
import URadioGroup from '@nuxt/ui/components/RadioGroup.vue'
import USwitch from '@nuxt/ui/components/Switch.vue'

import AppCard from '../../shared/ui/AppCard.vue'
import AppDialog from '../../shared/ui/AppDialog.vue'
import { CHANGES_REFUSED } from '../../shared/ui/changesRefused'
import CurrencySelect from '../../shared/ui/CurrencySelect.vue'
import DayField from '../../shared/ui/DayField.vue'
import FigureTable from '../../shared/ui/FigureTable.vue'
import FormGrid from '../../shared/ui/FormGrid.vue'
import MoneyInput from '../../shared/ui/MoneyInput.vue'
import MoneyText from '../../shared/ui/MoneyText.vue'
import { moneyFromCents, plainAmount } from '../../shared/money/money'
import { typedAmount } from '../../shared/money/typedAmount'
import GallerySection from './GallerySection.vue'

const formOpen = ref(false)
const refusedOpen = ref(false)
// Only a dialog marked `changes` shows it, so the other specimens stay as they are.
provide(
  CHANGES_REFUSED,
  ref({ title: 'A newer version of Kuna saved this file', description: 'Until you reload, Kuna shows this file and saves nothing to it.', reloadLabel: 'Reload', reload: () => {} }),
)
const tableOpen = ref(false)
const confirmOpen = ref(false)
const tried = ref(false)
const boxTicked = ref(false)
const radioPicked = ref('A radio picked')
const gridInterest = ref('')
const dialogInterest = ref('')
const subsidised = ref(true)
const firstInstalment = ref('2026-07-12')
const blankDay = ref('')
const laterDay = ref('2026-11-20')
const savingDay = ref('2026-03-01')
const earlierDay = ref('2026-10-30')
const wrongDay = ref('')
const changedDay = ref<string | null>(null)
const typedMoney = ref('')
const givenMoney = ref(plainAmount(moneyFromCents(150000)))
const disabledMoney = ref(plainAmount(moneyFromCents(150000)))
const wrongMoney = ref('')
const pickedCurrency = ref('EUR')
const namedCurrency = ref('USD')
const optionalCurrency = ref('')
const keptCurrency = ref('EUR')
const readMoney = computed(() => typedAmount(typedMoney.value))

const ROWS = [
  { due: '20 Oct 2026', payment: moneyFromCents(82220), interest: moneyFromCents(39992), principal: moneyFromCents(42228) },
  { due: '20 Nov 2026', payment: moneyFromCents(82220), interest: moneyFromCents(39854), principal: moneyFromCents(42366) },
  { due: '20 Dec 2026', payment: moneyFromCents(82220), interest: moneyFromCents(39716), principal: moneyFromCents(42504) },
] as const
</script>

<template>
  <GallerySection
    id="form-grid"
    title="FormGrid"
    description="Two fields to a row from 640 px, the labels in a row of their own, so the inputs line up however long a label runs. A wide field spans the row, and so does an alert, with its icon beside its title."
  >
    <AppCard as="div" class="p-5">
      <FormGrid data-testid="gallery-form-grid">
        <UFormField label="Name" :error="(tried && 'A name, such as Home loan') || false">
          <UInput placeholder="Home loan" class="w-full" />
        </UFormField>
        <UFormField label="Interest the bank charged before the first instalment, if it did" help="What the bank charged from the payout.">
          <MoneyInput v-model="gridInterest" placeholder="0.00" class="w-full" />
        </UFormField>
        <UFormField label="Monthly instalments" help="240 for 20 years.">
          <UInput inputmode="numeric" class="w-full" />
        </UFormField>
        <UFormField label="First instalment">
          <DayField v-model="firstInstalment" class="w-full" />
        </UFormField>
        <USwitch v-model="subsidised" label="A subsidy pays part of each instalment" description="A switch takes the whole row." />
        <UAlert
          icon="i-lucide-triangle-alert"
          color="warning"
          variant="subtle"
          title="Moving the first instalment later deletes what came before it"
          description="An alert takes the whole row."
          data-testid="gallery-form-grid-alert"
        />
        <UAlert color="info" variant="subtle" title="An alert without an icon takes the whole row too" />
        <UFormField label="Note" class="sm:col-span-2">
          <UInput class="w-full" />
        </UFormField>
      </FormGrid>
      <div class="mt-4 flex flex-wrap items-start gap-6">
        <USwitch v-model="tried" label="Show the errors" />
        <UCheckbox v-model="boxTicked" label="A checkbox, unticked" />
        <URadioGroup v-model="radioPicked" :items="['A radio picked', 'One not picked']" />
      </div>
    </AppCard>
  </GallerySection>

  <GallerySection
    id="money-input"
    title="MoneyInput"
    description="An amount of money, bound with v-model to the text shown, which typedAmount reads. It groups thousands while it is typed in the language on screen, takes a decimal mark with two digits at most, reads a group mark typed after a number as the decimal mark until a third digit follows it, turns 3k into 3,000 and 1.5m into 1,500,000 at once, and adds the cents when it is left. It holds zero or more, so a typed minus is dropped, and a paste that does not read as one amount leaves it as it was."
  >
    <AppCard as="div" class="p-5">
      <FormGrid>
        <UFormField label="Amount" help="Try 3k, 0.2k, 1.5m or paste 1.234,56.">
          <MoneyInput v-model="typedMoney" placeholder="0.00" class="w-full" />
        </UFormField>
        <UFormField label="Given an amount" help="Opened on an amount the screen already has.">
          <MoneyInput v-model="givenMoney" class="w-full" />
        </UFormField>
        <UFormField label="With an error" error="An amount, such as 1,500.00">
          <MoneyInput v-model="wrongMoney" placeholder="0.00" class="w-full" />
        </UFormField>
        <UFormField label="Disabled">
          <MoneyInput v-model="disabledMoney" disabled class="w-full" />
        </UFormField>
        <p class="type-caption sm:col-span-2">
          <template v-if="readMoney === null">The first field reads no amount yet.</template>
          <template v-else>The first field reads <MoneyText :cents="readMoney" />.</template>
        </p>
      </FormGrid>
    </AppCard>
  </GallerySection>

  <GallerySection
    id="day-field"
    title="DayField"
    description="A day typed or picked from the calendar beside it, shown in the language on screen whatever the browser's, bound with v-model to the day as YYYY-MM-DD, blank while no whole day is typed. The value follows each keystroke, and change comes once the field is left or a day is picked, so a field that writes listens to change. A native date field shows the browser's order, which lint refuses."
  >
    <AppCard as="div" class="p-5">
      <FormGrid>
        <UFormField label="Opened on">
          <DayField v-model="firstInstalment" class="w-full" data-testid="gallery-day-field" @change="changedDay = $event" />
        </UFormField>
        <UFormField label="Blank" help="No day yet.">
          <DayField v-model="blankDay" class="w-full" />
        </UFormField>
        <UFormField label="From today on" help="Takes no day before 11 Nov 2026.">
          <DayField v-model="laterDay" min="2026-11-11" class="w-full" />
        </UFormField>
        <UFormField label="Up to today" help="Takes no day after 11 Nov 2026.">
          <DayField v-model="earlierDay" max="2026-11-11" class="w-full" />
        </UFormField>
        <UFormField label="With an error" error="A day, such as 1 Mar 2026">
          <DayField v-model="wrongDay" class="w-full" />
        </UFormField>
        <UFormField label="Disabled" help="A day that another field sets.">
          <DayField v-model="savingDay" disabled class="w-full" />
        </UFormField>
        <UFormField label="Saving">
          <DayField v-model="savingDay" loading class="w-full" />
        </UFormField>
        <UFormField label="Small" help="As in a filter bar or an editor's row.">
          <DayField v-model="earlierDay" size="sm" class="w-40" />
        </UFormField>
        <p class="type-caption sm:col-span-2">
          The first field holds <span class="identifier">{{ firstInstalment || 'blank' }}</span
          >, and its last change said <span class="identifier">{{ changedDay ?? 'nothing yet' }}</span
          >.
        </p>
      </FormGrid>
    </AppCard>
  </GallerySection>

  <GallerySection
    id="currency-select"
    title="CurrencySelect"
    description="A currency picked by its code, bound with v-model to the code. The euro comes first unless the screen names other codes to list first, the rest follow in alphabetical order, and typing searches them. A field that may stay empty passes the label of a choice of no currency."
  >
    <AppCard as="div" class="p-5">
      <FormGrid>
        <UFormField label="Currency">
          <CurrencySelect v-model="pickedCurrency" search="Find a currency" class="w-full" />
        </UFormField>
        <UFormField label="Those the file names first" help="USD and GBP before the rest.">
          <CurrencySelect v-model="namedCurrency" search="Find a currency" :first="['USD', 'GBP']" class="w-full" />
        </UFormField>
        <UFormField label="May stay empty">
          <CurrencySelect v-model="optionalCurrency" search="Find a currency" :first="[]" none="No other currency" class="w-full" />
        </UFormField>
        <UFormField label="Disabled" help="An account with entries keeps its currency.">
          <CurrencySelect v-model="keptCurrency" search="Find a currency" disabled class="w-full" />
        </UFormField>
      </FormGrid>
    </AppCard>
  </GallerySection>

  <GallerySection id="dialog" title="AppDialog" description="Full screen on a phone. Delete and the like at the start of the footer, Cancel and the primary action at its end.">
    <div class="flex flex-wrap gap-2">
      <UButton label="A form" color="neutral" variant="outline" data-testid="gallery-dialog-form" @click="formOpen = true" />
      <UButton label="A wide table" color="neutral" variant="outline" @click="tableOpen = true" />
      <UButton label="A confirmation" color="neutral" variant="outline" @click="confirmOpen = true" />
      <UButton label="A form that cannot save" color="neutral" variant="outline" data-testid="gallery-dialog-refused" @click="refusedOpen = true" />
    </div>

    <AppDialog v-model:open="formOpen" title="Change the bank loan" description="Its terms. Rate periods and extra payments change on the loan's page.">
      <FormGrid id="gallery-form" as="form" @submit.prevent="formOpen = false">
        <UFormField label="Name">
          <UInput placeholder="Home loan" class="w-full" />
        </UFormField>
        <UFormField label="Interest before the first instalment" help="What the bank charged from the payout, if it did.">
          <MoneyInput v-model="dialogInterest" placeholder="0.00" class="w-full" />
        </UFormField>
        <UFormField label="Note" class="sm:col-span-2">
          <UInput class="w-full" />
        </UFormField>
      </FormGrid>
      <template #start>
        <UButton label="Delete loan" icon="i-lucide-trash-2" color="error" variant="ghost" @click="formOpen = false" />
      </template>
      <template #end>
        <UButton label="Cancel" color="neutral" variant="ghost" @click="formOpen = false" />
        <UButton type="submit" form="gallery-form" label="Save loan" icon="i-lucide-save" />
      </template>
    </AppDialog>

    <AppDialog v-model:open="tableOpen" width="2xl" title="Plan for 2026" description="A dialog whose body is a table takes a wider panel.">
      <FigureTable label="Plan for 2026">
        <thead>
          <tr>
            <th scope="col" class="text-start">Due</th>
            <th scope="col" class="text-end">Instalment</th>
            <th scope="col" class="text-end">Interest</th>
            <th scope="col" class="text-end">Principal</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in ROWS" :key="row.due">
            <th scope="row" class="text-start font-normal text-toned">{{ row.due }}</th>
            <td class="text-end"><MoneyText :cents="row.payment" /></td>
            <td class="text-end"><MoneyText :cents="row.interest" /></td>
            <td class="text-end"><MoneyText :cents="row.principal" /></td>
          </tr>
        </tbody>
      </FigureTable>
      <template #end>
        <UButton label="Close" color="neutral" @click="tableOpen = false" />
      </template>
    </AppDialog>

    <AppDialog
      v-model:open="refusedOpen"
      changes
      title="Change the bank loan"
      description="With `changes`, a dialog opens with the reason the app takes none at the top of its body, and its Save stays off."
    >
      <FormGrid>
        <UFormField label="Name">
          <UInput placeholder="Home loan" class="w-full" />
        </UFormField>
      </FormGrid>
      <template #end>
        <UButton label="Cancel" color="neutral" variant="ghost" @click="refusedOpen = false" />
        <UButton label="Save loan" icon="i-lucide-save" disabled />
      </template>
    </AppDialog>

    <AppDialog v-model:open="confirmOpen" width="md" title="Delete the books in this browser" description="The books are deleted from this browser and cannot be recovered.">
      <p class="type-body">A confirmation keeps its question in the title and its answer in the buttons.</p>
      <template #end>
        <UButton label="Keep them" color="neutral" variant="ghost" @click="confirmOpen = false" />
        <UButton label="Delete the books" icon="i-lucide-trash-2" color="error" @click="confirmOpen = false" />
      </template>
    </AppDialog>
  </GallerySection>
</template>
