import { language } from '../../../../shared/text/language'
import { listInWords } from '../../../../shared/text/listInWords'
import { plural } from '../../../../shared/text/translation'
import type { Translation } from '../../../../shared/text/translation'
import { croatianBucket } from '../../workbook/domain/bucketNames'

// Croatian addresses the reader as vi, written lowercase inside a sentence.
// A role and a category keep their names as the categories tab stores them, such as owner-benefit and travel. A bucket takes its Croatian name in quotes.

export const en = {
  /** What the categories editor says beside a field it cannot save. */
  fields: {
    notABucket: 'Not one of the six buckets',
    unknownRoles: (count: number, roles: string) => `Not ${count === 1 ? 'a role' : 'roles'} the app knows: ${roles}`,
    unknownVat: 'Not a VAT treatment the app knows',
    shareRange: 'A whole number from 0 to 100',
    onlyOperating: 'Only an operating category holds a share',
    roleFirst: (role: string) => `Give a category the ${role} role first`,
  },
  /** Why a change to the categories is refused. */
  refusals: {
    advancesBucket: (slug: string, advances: number) =>
      `"${slug}" stays in the operating or taxes bucket, since ${advances === 1 ? 'an owner advance carries it' : `${advances} owner advances carry it`} and an advance counts only as an operating cost or a tax.`,
    colour: (slug: string, colour: string, codes: readonly string[], count: number) =>
      `"${slug}" takes one of the ${count} colours of the palette, ${codes.join(', ')}, an own colour as #rrggbb that keeps 3:1 in the light theme, or none for its bucket's colour, not "${colour}".`,
    roleBucket: (slug: string, bucket: string, role: string) =>
      `"${slug}" is in the ${bucket} bucket, and only an owner-pay category carries the ${role} role, since the owner's part of a shared cost counts there.`,
    roleOnce: (slug: string, role: string, count: number, others: string) => `"${slug}" takes the ${role} role only once no other category carries it, and ${others} ${count === 1 ? 'does' : 'do'}.`,
    shareBucket: (slug: string, bucket: string) => `"${slug}" is in the ${bucket} bucket, and only an operating category holds an owner share.`,
    shareRole: (slug: string, role: string) => `"${slug}" holds an owner share only once a category carries the ${role} role, where the owner's part counts.`,
    unknownRoles: (slug: string, roles: string) => `"${slug}" takes only roles the app knows, not ${roles}.`,
    noClass: (slug: string) => `Pick a tax class for "${slug}".`,
    oneClass: (slug: string, classes: readonly string[]) => `Kuna counts a category one way, and "${slug}" has ${listInWords(classes)}.`,
    classVat: (slug: string, taxClass: string, treatments: readonly string[], vat: string) => `"${slug}" carries ${taxClass}, which allows only ${listInWords(treatments, 'or')}, not ${vat}.`,
    classBucket: (slug: string, taxClass: string, buckets: readonly string[], bucket: string) => `"${slug}" carries ${taxClass}, which allows only ${listInWords(buckets, 'or')}, not ${bucket}.`,
  },
}

export const hr: Translation<typeof en> = {
  fields: {
    notABucket: 'Nije jedna od šest skupina',
    unknownRoles: (count, roles) => `${plural({ one: 'Uloga koju', few: 'Uloge koje', other: 'Uloge koje' }, count)} aplikacija ne poznaje: ${roles}`,
    unknownVat: 'Aplikacija ne poznaje taj PDV tretman',
    shareRange: 'Cijeli broj od 0 do 100',
    onlyOperating: `Udio može imati samo kategorija skupine ${croatianBucket('operating')}`,
    roleFirst: (role) => `Najprije nekoj kategoriji dajte ulogu ${role}`,
  },
  refusals: {
    advancesBucket: (slug, advances) =>
      `„${slug}” ostaje u skupini ${croatianBucket('operating')} ili ${croatianBucket('taxes')} jer ${plural({ one: `je nosi ${advances} predujam vlasnika`, few: `je nose ${advances} predujma vlasnika`, other: `je nosi ${advances} predujmova vlasnika` }, advances)}, a predujam se broji samo kao poslovni rashod ili porez.`,
    colour: (slug, colour, codes, count) =>
      `„${slug}” uzima jednu od ${count} boja palete, ${codes.join(', ')}, vlastitu boju kao #rrggbb koja u svijetloj temi drži kontrast 3:1, ili nijednu za boju svoje skupine, a ne „${colour}”.`,
    roleBucket: (slug, bucket, role) =>
      `„${slug}” je u skupini ${croatianBucket(bucket)}, a ulogu ${role} ima samo kategorija skupine ${croatianBucket('owner-pay')} jer se ondje broji vlasnikov dio zajedničkog troška.`,
    roleOnce: (slug, role, count, others) =>
      `„${slug}” može dobiti ulogu ${role} tek kad je nema nijedna druga kategorija, a ${plural({ one: 'ima je', few: 'imaju je', other: 'imaju je' }, count)} ${others}.`,
    shareBucket: (slug, bucket) => `„${slug}” je u skupini ${croatianBucket(bucket)}, a udio vlasnika ima samo kategorija skupine ${croatianBucket('operating')}.`,
    shareRole: (slug, role) => `„${slug}” može imati udio vlasnika tek kad neka kategorija ima ulogu ${role}, u kojoj se broji vlasnikov dio.`,
    unknownRoles: (slug, roles) => `„${slug}” uzima samo uloge koje aplikacija poznaje, a ne ${roles}.`,
    noClass: (slug) => `Odaberite porezni tretman za „${slug}”.`,
    oneClass: (slug, classes) => `Kuna kategoriju broji na jedan način, a „${slug}” ima ${listInWords(classes)}.`,
    classVat: (slug, taxClass, treatments, vat) => `„${slug}” ima porezni tretman ${taxClass}, koji dopušta samo ${listInWords(treatments, 'or')}, a ne ${vat}.`,
    classBucket: (slug, taxClass, buckets, bucket) =>
      `„${slug}” ima porezni tretman ${taxClass}, koji dopušta samo skupinu ${listInWords(buckets.map(croatianBucket), 'or')}, a ne ${croatianBucket(bucket)}.`,
  },
}

export const words = language === 'hr' ? hr : en
