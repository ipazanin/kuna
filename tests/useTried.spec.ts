import { join } from 'node:path'
import { ESLint } from 'eslint'
import { nextTick, ref } from 'vue'
import { describe, expect, it } from 'vitest'

import { kunaConfig } from '../eslint.config.js'
import baseline from '../scripts/lint-baseline.json'
import { useTried } from '../src/shared/ui/useTried'

describe('whether Save was pressed in a dialog', () => {
  it('starts false and turns true on Save', () => {
    const { tried, markTried } = useTried(ref(true))

    expect(tried.value).toBe(false)
    markTried()
    expect(tried.value).toBe(true)
  })

  it('clears as the dialog opens again, so it never opens on the last red fields', async () => {
    const open = ref(true)
    const { tried, markTried } = useTried(open)
    markTried()

    open.value = false
    await nextTick()
    expect(tried.value).toBe(true)

    open.value = true
    await nextTick()
    expect(tried.value).toBe(false)
  })

  it('clears on demand, as a dialog does when its step or mode changes', () => {
    const { tried, markTried, clearTried } = useTried(ref(true))
    markTried()

    clearTried()

    expect(tried.value).toBe(false)
  })

  it('lives as long as its form when no open is passed', async () => {
    const { tried, markTried } = useTried()
    markTried()
    await nextTick()

    expect(tried.value).toBe(true)
  })
})

describe('the lint rule that keeps the tried flag in useTried', { timeout: 120_000 }, () => {
  const root = join(import.meta.dirname, '..')
  const eslint = new ESLint({ cwd: root, overrideConfigFile: true, overrideConfig: kunaConfig(baseline) })
  const triedRefusals = async (script: string) => {
    const [result] = await eslint.lintText(`<script setup lang="ts">\n${script}\n</script>\n`, { filePath: join(root, 'src/apps/planted/presentation/PlantedDialog.vue') })
    return (result?.messages ?? []).filter((message) => message.ruleId === 'kuna/tried-flags')
  }

  it('refuses a local tried flag, a tried parameter and a tried taken from anything but useTried', async () => {
    expect(await triedRefusals("import { ref } from 'vue'\nconst tried = ref(false)\nexport { tried }")).toHaveLength(1)
    expect(await triedRefusals('export const kept = [1].map((tried) => tried + 1)')).toHaveLength(1)
    expect(await triedRefusals('declare const form: { tried: boolean }\nconst { tried } = form\nexport { tried }')).toHaveLength(1)
  })

  it('leaves the flag taken from useTried, under its own name or another', async () => {
    const taken = "import { ref } from 'vue'\nimport { useTried } from '../../../shared/ui/useTried'\nconst open = ref(false)\n"
    expect(await triedRefusals(`${taken}const { tried, markTried } = useTried(open)\nexport { tried, markTried }`)).toEqual([])
    expect(await triedRefusals(`${taken}const { tried: triedAccounts } = useTried(open)\nexport { triedAccounts }`)).toEqual([])
  })
})
