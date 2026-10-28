import { describe, expect, it } from 'vitest'

import { installedPack } from '../src/apps/company/packs/packContribution'
import { codecOfKind } from '../src/apps/company/workbook/application/recordCodecs'
import * as CORE_KINDS from '../src/apps/company/workbook/domain/coreKinds'

const pack = installedPack().workbook!
const packKinds = [...pack.codecs.map((codec) => codec.kind), ...pack.kinds.map((rules) => rules.kind)]
const kinds = [...Object.values(CORE_KINDS), ...pack.codecs.map((codec) => codec.kind)]

describe("the company app's kind names", () => {
  it('names each kind once, so the document holds one list of it and its codec is the one found', () => {
    const names = kinds.map((kind) => kind.name)
    expect(names.filter((name, index) => names.indexOf(name) !== index)).toEqual([])
    expect(kinds.filter((kind) => codecOfKind(kind).kind !== kind).map((kind) => kind.name)).toEqual([])
  })

  it("starts each pack kind with the pack's name, while core's kinds stay bare", () => {
    expect(packKinds.map((kind) => kind.name).filter((name) => !name.startsWith(`${pack.key.name}.`))).toEqual([])
    expect(Object.values(CORE_KINDS).map((kind) => kind.name).filter((name) => name.includes('.'))).toEqual([])
  })
})
