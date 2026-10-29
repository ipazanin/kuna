import { describe, expect, it } from 'vitest'

import type { CivilDate } from '../src/shared/calendar/civilDate'
import { scopesOfChoices } from '../src/apps/company/onboarding/application/onboardingScopes'
import { OTHER_BANK, makingStep, nextStep, onboardingPlaceOf, onboardingQueryOf, previousStep, stepsOf } from '../src/apps/company/onboarding/domain/onboardingSteps'
import type { BooksHome, OnboardingPath, OnboardingPlace, StatementMail } from '../src/apps/company/onboarding/domain/onboardingSteps'
import { statementMailProblems, statementSettingsOf } from '../src/apps/company/onboarding/domain/statementsChoice'

const ERSTE: StatementMail = { bank: 'erste', from: '', subject: '', since: null }

const place = (changes: Partial<OnboardingPlace>): OnboardingPlace => ({ path: 'new', home: 'drive', statements: 'hand', mail: ERSTE, step: 'welcome', made: null, ...changes })

const TODAY = '2026-10-27' as CivilDate

describe('the onboarding steps', () => {
  it('ask Google before any file is opened, on each path in the proposal’s order, and never for books kept in this browser', () => {
    expect(stepsOf('new', 'drive')).toEqual(['welcome', 'home', 'access', 'folder', 'company', 'statement'])
    expect(stepsOf('new', 'browser')).toEqual(['welcome', 'home', 'company', 'statement'])
    expect(stepsOf('bring', 'drive')).toEqual(['welcome', 'home', 'access', 'file', 'folder', 'company'])
    expect(stepsOf('bring', 'browser')).toEqual(['welcome', 'home', 'file', 'company'])
    expect(stepsOf('open', 'drive')).toEqual(['welcome', 'access', 'find'])
    expect(stepsOf('move', 'drive')).toEqual(['access', 'folder'])
  })

  it('read the place from the route, so a trip to Google comes back into the step it left', () => {
    expect(onboardingPlaceOf({})).toEqual(place({}))
    expect(onboardingPlaceOf({ step: 'access', path: 'bring', statements: 'folder' })).toEqual(place({ path: 'bring', statements: 'folder', step: 'access' }))
    expect(onboardingPlaceOf({ step: 'find', path: 'new' }).step).toBe('welcome')
    expect(onboardingPlaceOf({ step: 'access', path: 'open', home: 'browser' })).toMatchObject({ home: 'drive', step: 'access' })
    expect(onboardingPlaceOf({ path: 'sideways', home: 'cloud', statements: 'post' })).toEqual(place({}))
    const typed = place({ step: 'access', statements: 'mail', mail: { bank: OTHER_BANK, from: 'statements@bank.example.com', subject: 'Statement', since: '2025-01-01' as CivilDate } })
    for (const written of [place({ step: 'folder', statements: 'folder' }), place({ path: 'bring', home: 'browser', step: 'file' }), place({ path: 'move', step: 'access' }), place({ statements: 'mail', step: 'access' }), typed]) {
      expect(onboardingPlaceOf(onboardingQueryOf(written))).toEqual(written)
    }
    expect(onboardingQueryOf(place({ step: 'home' }))).toEqual({ step: 'home' })
    expect(onboardingQueryOf(typed)).toEqual({ step: 'access', statements: 'mail', bank: 'other', from: 'statements@bank.example.com', subject: 'Statement', since: '2025-01-01' })
  })

  it('offer statements from mail only to new books on Drive, since books brought along or kept in this browser carry their own way', () => {
    expect(onboardingPlaceOf({ step: 'access', statements: 'mail' }).statements).toBe('mail')
    expect(onboardingPlaceOf({ step: 'access', path: 'bring', statements: 'mail' }).statements).toBe('hand')
    expect(onboardingPlaceOf({ step: 'statement', home: 'browser', statements: 'mail' }).statements).toBe('hand')
    expect(onboardingPlaceOf({ step: 'access', statements: 'mail', bank: 'a-bank-with-no-preset' }).mail.bank).toBe('erste')
  })

  it('go forward to Overview after the last step', () => {
    expect(nextStep(place({ step: 'access' }))).toBe('folder')
    expect(nextStep(place({ step: 'statement' }))).toBeNull()
    expect(nextStep(place({ path: 'bring', step: 'company' }))).toBeNull()
  })

  it('go back from every step of every path to the step before it, the books made or not, and from none on the first', () => {
    const paths: readonly (readonly [OnboardingPath, BooksHome])[] = [
      ['new', 'drive'],
      ['new', 'browser'],
      ['bring', 'drive'],
      ['bring', 'browser'],
      ['open', 'drive'],
      ['move', 'drive'],
    ]
    for (const [path, home] of paths) {
      const steps = stepsOf(path, home)
      steps.forEach((step, index) => {
        for (const made of [null, 'file-1']) {
          expect(previousStep(place({ path, home, step, made })), `${path} ${home} ${step}`).toBe(steps[index - 1] ?? null)
        }
      })
    }
  })

  it('make the books on the folder step on Drive, and in this browser on the step that holds what they start from', () => {
    expect(makingStep(place({}))).toBe('folder')
    expect(makingStep(place({ path: 'bring' }))).toBe('folder')
    expect(makingStep(place({ path: 'move' }))).toBe('folder')
    expect(makingStep(place({ home: 'browser' }))).toBe('home')
    expect(makingStep(place({ path: 'bring', home: 'browser' }))).toBe('file')
  })

  it('keep the books this run made in the route, so a trip to Google still knows them, but never on the open and move paths', () => {
    const made = place({ step: 'company', made: 'file-1' })
    expect(onboardingQueryOf(made)).toEqual({ step: 'company', made: 'file-1' })
    expect(onboardingPlaceOf(onboardingQueryOf(made))).toEqual(made)
    expect(onboardingPlaceOf({ path: 'bring', home: 'browser', step: 'company', made: 'local-1' }).made).toBe('local-1')
    expect(onboardingPlaceOf({ path: 'move', step: 'folder', made: 'file-1' }).made).toBeNull()
    expect(onboardingPlaceOf({ path: 'open', step: 'find', made: 'file-1' }).made).toBeNull()
  })

  it('ask Google for the books file, and for Drive read and Gmail only as the choices switch them on', () => {
    expect(scopesOfChoices(place({}), false)).toEqual(['drive.file'])
    expect(scopesOfChoices(place({ statements: 'folder' }), false)).toEqual(['drive.file', 'drive.readonly'])
    expect(scopesOfChoices(place({ statements: 'mail' }), false)).toEqual(['drive.file', 'gmail.readonly'])
    expect(scopesOfChoices(place({ statements: 'mail' }), true)).toEqual(['drive.file', 'gmail.readonly', 'gmail.compose'])
    expect(scopesOfChoices(place({ path: 'bring' }), true)).toEqual(['drive.file', 'gmail.compose'])
    expect(scopesOfChoices(place({ path: 'open', statements: 'folder' }), true)).toEqual(['drive.file'])
    expect(scopesOfChoices(place({ path: 'move' }), true)).toEqual(['drive.file'])
  })
})

describe('the statements choice', () => {
  it('writes an explicit row for each setting: filing on sync off by hand, on for a Drive folder the statement step names', () => {
    const blank = { statementsFolder: [], statementsMailFrom: [], statementsMailSubject: '', mailSince: null }
    expect(statementSettingsOf('hand', ERSTE, TODAY)).toEqual({ ...blank, statementsSync: false })
    expect(statementSettingsOf('folder', ERSTE, TODAY)).toEqual({ ...blank, statementsSync: true })
  })

  it('files mail into a statements folder beside the books file, with the preset bank’s sender and subject words and mail since the first day of this year', () => {
    expect(statementSettingsOf('mail', ERSTE, TODAY)).toEqual({
      statementsSync: true,
      statementsFolder: ['.', 'statements'],
      statementsMailFrom: ['netbanking.support@erstebank.hr'],
      statementsMailSubject: 'ERSTE Izvadak',
      mailSince: '2026-01-01',
    })
  })

  it('takes another bank’s sender and subject words as typed, with the day picked, and says what is missing or does not hold', () => {
    const typed: StatementMail = { bank: OTHER_BANK, from: ' Statements@Bank.example.com, ', subject: ' Statement ', since: '2025-06-01' as CivilDate }
    expect(statementSettingsOf('mail', typed, TODAY)).toMatchObject({ statementsMailFrom: ['statements@bank.example.com'], statementsMailSubject: 'Statement', mailSince: '2025-06-01' })
    expect(statementMailProblems(typed)).toEqual({})
    expect(statementMailProblems(ERSTE)).toEqual({})
    expect(statementMailProblems({ ...typed, from: '', subject: '' })).toEqual({ from: 'Type the address the bank mails statements from', subject: 'Type the words before the statement number' })
    expect(statementMailProblems({ ...typed, from: 'the bank', subject: 'Izvadak "' })).toEqual({
      from: '"the bank" is not a mail address',
      subject: 'a subject cannot hold a double quote, which would end the phrase Gmail searches for',
    })
  })
})
