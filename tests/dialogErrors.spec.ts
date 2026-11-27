import { globSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from '@vue/compiler-sfc'
import { describe, expect, it } from 'vitest'

import { elementsOf, propText } from './support/templateElements'

const root = join(import.meta.dirname, '..')

/**
 * The refusal alerts of a dialog that binds no field's `:error`. A refusal alert is an error alert shown after Save or
 * for a refusal, so the fields' own problems would show in it, where a dialog shows each under its field.
 */
function refusalsWithoutFieldErrors(source: string): string[] {
  const ast = parse(source).descriptor.template?.ast
  if (ast === undefined || ast === null) return []
  const elements = elementsOf(ast)
  if (!elements.some((element) => element.tag === 'AppDialog')) return []
  if (elements.some((element) => element.tag === 'UFormField' && propText(element, 'error') !== null)) return []
  return elements
    .filter((element) => element.tag === 'UAlert' && /\berror\b/.test(propText(element, 'color') ?? ''))
    .filter((element) => [propText(element, 'if'), propText(element, 'title'), propText(element, 'description')].some((text) => text !== null && /\btried\b|refus/i.test(text)))
    .map((element) => `<UAlert> at line ${element.loc.start.line}`)
}

describe('a dialog that refuses its fields', () => {
  it('shows each field’s problem under that field, so a refusal alert sits beside fields that bind :error', () => {
    const files = globSync('src/**/*.vue', { cwd: root })
    expect(files.length).toBeGreaterThan(100)
    const offenders = files.flatMap((file) => refusalsWithoutFieldErrors(readFileSync(join(root, file), 'utf8')).map((alert) => `${file}: ${alert}`))
    expect(offenders).toEqual([])
  })

  it('flags a dialog whose refusal alert stands in for its fields’ errors', () => {
    const source = `<template>
  <AppDialog v-model:open="open" title="Add a cost">
    <UFormField label="Amount"><UInput v-model="amount" /></UFormField>
    <UAlert v-if="tried && refusal" color="error" :description="refusal" />
  </AppDialog>
</template>`
    expect(refusalsWithoutFieldErrors(source)).toEqual(['<UAlert> at line 4'])
    expect(refusalsWithoutFieldErrors(source.replace('<UFormField label="Amount">', '<UFormField label="Amount" :error="(tried && errors.amount) || false">'))).toEqual([])
  })

  it('leaves alone a dialog whose error alert says a write failed', () => {
    const source = `<template>
  <AppDialog v-model:open="open" title="Move into Kuna">
    <UFormField label="Folder"><UInput v-model="folder" /></UFormField>
    <UAlert v-if="failure" color="error" :title="text.failed" :description="failure" />
  </AppDialog>
</template>`
    expect(refusalsWithoutFieldErrors(source)).toEqual([])
  })
})
