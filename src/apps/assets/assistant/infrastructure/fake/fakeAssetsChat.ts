import { answered, answersSince, findRecordsArgs, lookup, proposedStep, registerFakeChat } from '../../../../../shared/ai/infrastructure/fake/fakeChatReply'
import type { FakeChatTurn } from '../../../../../shared/ai/infrastructure/fake/fakeChatReply'
import type { ModelReply } from '../../../../../shared/ai/application/modelPort'
import { today } from '../../../../../shared/calendar/civilDate'
import { language } from '../../../../../shared/text/language'
import { ASSETS_OPERATIONS } from '../../operations/assetsOperations'

const ANSWERS = {
  en: {
    title: 'A new valuation',
    proposed: 'The card below adds the valuation to your newest asset. Nothing changes until you accept it.',
    noAsset: 'There is no asset in Assets to value.',
    months: (cited: string) =>
      `A month has passed on the day of the next month with the same number as the day the car was first registered, or on that month's last day when it has no such day ${cited}. A car first registered on 31 January has one month behind it on 28 February ${cited}.\n\n> Customs may still value a car by looking at it, so take Kuna's figure as an estimate.`,
  },
  hr: {
    title: 'Nova procjena',
    proposed: 'Kartica ispod dodaje procjenu vašoj najnovijoj stavci imovine. Ništa se ne mijenja dok je ne prihvatite.',
    noAsset: 'U Imovini nema nijedne stavke imovine koju biste mogli procijeniti.',
    months: (cited: string) =>
      `Mjesec je protekao onoga dana sljedećeg mjeseca koji brojem odgovara danu prve registracije, a ako toga dana nema, posljednjeg dana tog mjeseca ${cited}. Automobil prvi put registriran 31. siječnja ima 28. veljače jedan mjesec iza sebe ${cited}.\n\n> Carina automobil može procijeniti i pregledom, pa Kunin iznos uzmite kao procjenu.`,
  },
}

/** Reads the assets and proposes a valuation of the newest bought, on today's day. */
function valuationReply({ request, tokens }: FakeChatTurn): ModelReply {
  const says = ANSWERS[language === 'hr' ? 'hr' : 'en']
  const answers = answersSince(request)
  if (answers.length === 0) return lookup(0, 'find_records', findRecordsArgs('assets', 'asset', { limit: 5 }), tokens)
  if (answers.length === 1) {
    const { records } = JSON.parse(answers[0]!.text) as { readonly records: readonly { readonly ref: string }[] }
    const [asset] = records
    if (asset === undefined) return answered(request, says.noAsset, tokens)
    const step = proposedStep(ASSETS_OPERATIONS, 'add-valuation', { asset: asset.ref, date: today(), value: 210000, note: '' })
    return lookup(1, 'propose_changes', { app: 'assets', title: says.title, steps: [step], next: false }, tokens)
  }
  return answered(request, says.proposed, tokens)
}

/** Reads how the customs table counts a car's months and answers from it, citing the section and setting its own knowledge apart. */
function carMonthsReply({ request, tokens }: FakeChatTurn): ModelReply {
  const [read] = answersSince(request)
  if (read === undefined) return lookup(0, 'kuna_docs', { path: 'assets/law/used-car-value#how-months-count' }, tokens)
  const cited = /Cite this section as (\[law-\d+\])/.exec(read.text)?.[1] ?? ''
  return answered(request, ANSWERS[language === 'hr' ? 'hr' : 'en'].months(cited), tokens)
}

/** Assets' part of the fake chat: one that starts with valuation adds a valuation of the newest asset, and one about a car's months reads the law. */
function assetsChat(turn: FakeChatTurn): ModelReply | null {
  if (/^valuation|^procjen/i.test(turn.typed)) return valuationReply(turn)
  return /^how does customs count|^kako carina broji/i.test(turn.typed) ? carMonthsReply(turn) : null
}

export function registerFakeAssetsChat(): void {
  registerFakeChat(assetsChat)
}
