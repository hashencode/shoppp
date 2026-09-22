import React from 'react'
import { screen } from '@testing-library/react'
import { describe, expect, it } from '@rstest/core'
import { renderInLocale } from '../../test/render-in-locale'
import { CollectionBlockedDependencies } from './collection-blocked-dependencies'

void React

describe('CollectionBlockedDependencies', () => {
  it('shows permission-approved repair links and names the exact field path', () => {
    renderInLocale(
      <CollectionBlockedDependencies
        backlinks={[
          {
            fieldPath: 'items.nav-1.target',
            href: '/storefront/navigation/header',
            id: 'header',
            type: 'navigation-menu',
            version: 3,
          },
        ]}
      />
    )
    expect(screen.getByText(/items.nav-1.target/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Repair reference' }).getAttribute('href')).toBe(
      '/storefront/navigation/header'
    )
  })

  it('does not invent a deep link when diagnostics are permission-filtered', () => {
    renderInLocale(
      <CollectionBlockedDependencies
        backlinks={[
          { fieldPath: 'items.nav-1.target', id: 'header', type: 'navigation-menu', version: 3 },
        ]}
      />
    )
    expect(screen.queryByRole('link', { name: 'Repair reference' })).toBeNull()
  })
})
