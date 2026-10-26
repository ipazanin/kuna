import { describe, expect, it } from 'vitest'

import { scopesOfChoices } from '../src/features/onboarding/application/onboardingScopes'
import { nextStep, onboardingPlaceOf, onboardingQueryOf, previousStep, stepsOf } from '../src/features/onboarding/domain/onboardingSteps'
import type { OnboardingPlace } from '../src/features/onboarding/domain/onboardingSteps'

const place = (changes: Partial<OnboardingPlace>): OnboardingPlace => ({ path: 'new', home: 'drive', statements: 'hand', step: 'welcome', ...changes })

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
    expect(onboardingPlaceOf({ path: 'sideways', home: 'cloud', statements: 'mail' })).toEqual(place({}))
    for (const written of [place({ step: 'folder', statements: 'folder' }), place({ path: 'bring', home: 'browser', step: 'file' }), place({ path: 'move', step: 'access' })]) {
      expect(onboardingPlaceOf(onboardingQueryOf(written))).toEqual(written)
    }
    expect(onboardingQueryOf(place({ step: 'home' }))).toEqual({ step: 'home' })
  })

  it('go forward to Overview after the last step, and back only to steps that do not make the books again', () => {
    expect(nextStep(place({ step: 'access' }))).toBe('folder')
    expect(nextStep(place({ step: 'statement' }))).toBeNull()
    expect(nextStep(place({ path: 'bring', step: 'company' }))).toBeNull()
    expect(previousStep(place({ step: 'welcome' }))).toBeNull()
    expect(previousStep(place({ step: 'folder' }))).toBe('access')
    expect(previousStep(place({ step: 'company' }))).toBeNull()
    expect(previousStep(place({ step: 'statement' }))).toBeNull()
    expect(previousStep(place({ home: 'browser', step: 'company' }))).toBeNull()
    expect(previousStep(place({ path: 'bring', home: 'browser', step: 'file' }))).toBe('home')
    expect(previousStep(place({ path: 'bring', home: 'browser', step: 'company' }))).toBeNull()
    expect(previousStep(place({ path: 'open', step: 'find' }))).toBe('access')
  })

  it('ask Google for the books file, and for Drive read and Gmail only as the choices switch them on', () => {
    expect(scopesOfChoices(place({}), false)).toEqual(['drive.file'])
    expect(scopesOfChoices(place({ statements: 'folder' }), false)).toEqual(['drive.file', 'drive.readonly'])
    expect(scopesOfChoices(place({ path: 'bring' }), true)).toEqual(['drive.file', 'gmail.compose'])
    expect(scopesOfChoices(place({ path: 'open', statements: 'folder' }), true)).toEqual(['drive.file'])
    expect(scopesOfChoices(place({ path: 'move' }), true)).toEqual(['drive.file'])
  })
})
