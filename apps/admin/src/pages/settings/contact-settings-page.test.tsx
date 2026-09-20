import React from 'react'
import type { ContactSettings, UpdateContactSettingsRequest } from '@shoppp/contracts'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, it } from '@rstest/core'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { MemoryRouter } from 'react-router-dom'
import { AuthTestProvider } from '../../test/auth-context-fixture'
import { renderInLocale } from '../../test/render-in-locale'
import { ContactSettingsPage } from './contact-settings-page'

void React

if (!window.ResizeObserver) {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver
}

const initial: ContactSettings = {
  supportEmail: 'support@example.com',
  privacyContactEmail: 'privacy@example.com',
  launchVersion: 'launch-v1',
  profileVersion: null,
  updatedAt: null,
  profile: {
    publishSupportEmail: false,
    publishPrivacyEmail: false,
    publicPhone: null,
    serviceHours: null,
    timeZone: null,
    locations: [],
    socials: [],
  },
  publicContact: {
    supportEmail: null,
    privacyEmail: null,
    publicPhone: null,
    serviceHours: null,
    timeZone: null,
    locations: [],
    socials: [],
  },
}
let settings = initial
let submitted: UpdateContactSettingsRequest[] = []
let conflict = false
const server = setupServer(
  http.get('*/admin/settings/contact', () => HttpResponse.json({ data: settings })),
  http.put('*/admin/settings/contact', async ({ request }) => {
    submitted.push((await request.json()) as UpdateContactSettingsRequest)
    if (conflict)
      return HttpResponse.json(
        { error: { code: 'contact_settings_conflict', message: 'Stale' } },
        { status: 409 }
      )
    settings = {
      ...settings,
      profile: submitted.at(-1)!.profile,
      profileVersion: 'a34814ad-77a8-4f59-98d5-80b16a071dad',
      publicContact: {
        ...settings.publicContact,
        supportEmail: submitted.at(-1)!.profile.publishSupportEmail
          ? submitted.at(-1)!.supportEmail
          : null,
        locations: submitted.at(-1)!.profile.locations.filter((row) => row.visible),
        socials: submitted.at(-1)!.profile.socials.filter((row) => row.visible),
      },
    }
    return HttpResponse.json({ data: settings })
  })
)
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  settings = initial
  submitted = []
  conflict = false
})
afterAll(() => server.close())

const renderPage = (writable = true, locale: 'en-US' | 'zh-CN' = 'en-US') =>
  renderInLocale(
    <AuthTestProvider
      permissions={writable ? ['settings.read', 'settings.write'] : ['settings.read']}
    >
      <MemoryRouter>
        <ContactSettingsPage />
      </MemoryRouter>
    </AuthTestProvider>,
    locale
  )

describe('ContactSettingsPage', () => {
  it('keeps the route heading in permission, loading, load-error, and normal states', async () => {
    const noAccess = renderInLocale(
      <AuthTestProvider permissions={[]}>
        <MemoryRouter>
          <ContactSettingsPage />
        </MemoryRouter>
      </AuthTestProvider>
    )
    expect(screen.getByRole('heading', { level: 4, name: 'Contact settings' })).toBeTruthy()
    expect(screen.getByText('No permission to view contact settings.')).toBeTruthy()
    noAccess.unmount()

    const loadingView = renderPage()
    expect(screen.getByRole('heading', { level: 4, name: 'Contact settings' })).toBeTruthy()
    await screen.findByLabelText('Support email')
    expect(screen.getAllByRole('heading', { level: 4, name: 'Contact settings' })).toHaveLength(1)
    loadingView.unmount()

    server.use(
      http.get('*/admin/settings/contact', () =>
        HttpResponse.json(
          { error: { code: 'contact_unavailable', message: 'Unavailable' } },
          { status: 503 }
        )
      )
    )
    renderPage()
    expect(await screen.findByText('Contact settings could not be loaded.')).toBeTruthy()
    expect(screen.getByRole('heading', { level: 4, name: 'Contact settings' })).toBeTruthy()
  })

  it('places publication guidance inside Global contact channels', async () => {
    renderPage()
    await screen.findByLabelText('Support email')
    const guidance = screen.getByText(
      'Only channels you explicitly publish will appear on the storefront after a new preview or release.'
    )
    expect(guidance.closest('.ant-card')?.textContent).toContain('Global contact channels')
  })

  it('saves a confirmed email and ordered optional rows with version and reason', async () => {
    renderPage()
    await screen.findByLabelText('Support email')
    fireEvent.click(screen.getByRole('switch', { name: 'Show support email publicly' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add location' }))
    fireEvent.change(screen.getByLabelText('Location name'), { target: { value: 'Studio' } })
    fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Shanghai' } })
    fireEvent.change(screen.getByLabelText('Postal address'), {
      target: { value: '123 Test Road' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add social link' }))
    fireEvent.change(screen.getByLabelText('Platform'), { target: { value: 'Instagram' } })
    fireEvent.change(screen.getByLabelText('Link label'), { target: { value: 'Our Instagram' } })
    fireEvent.change(screen.getByLabelText('Destination URL'), {
      target: { value: 'https://instagram.com/shop' },
    })
    fireEvent.change(screen.getByLabelText('Change reason'), {
      target: { value: 'Confirm public contact' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save contact settings' }))
    await waitFor(() => expect(submitted).toHaveLength(1))
    expect(submitted[0]).toMatchObject({
      expectedLaunchVersion: 'launch-v1',
      expectedProfileVersion: null,
      reason: 'Confirm public contact',
      profile: {
        publishSupportEmail: true,
        locations: [{ name: 'Studio', city: 'Shanghai', address: '123 Test Road', visible: false }],
        socials: [
          {
            platform: 'Instagram',
            label: 'Our Instagram',
            url: 'https://instagram.com/shop',
            visible: false,
          },
        ],
      },
    })
  })

  it('keeps stale edits visible and offers an explicit reload; readonly users cannot save', async () => {
    conflict = true
    renderPage()
    await screen.findByLabelText('Support email')
    fireEvent.change(screen.getByLabelText('Support email'), {
      target: { value: 'changed@example.com' },
    })
    fireEvent.change(screen.getByLabelText('Change reason'), {
      target: { value: 'Update mailbox' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save contact settings' }))
    expect(
      await screen.findByText('Contact settings changed since you opened this page.')
    ).toBeTruthy()
    expect((screen.getByLabelText('Support email') as HTMLInputElement).value).toBe(
      'changed@example.com'
    )
    fireEvent.click(screen.getByRole('button', { name: 'Compare current values' }))
    expect(await screen.findByText('Current saved contact values')).toBeTruthy()
    expect((screen.getByLabelText('Support email') as HTMLInputElement).value).toBe(
      'changed@example.com'
    )
    fireEvent.click(screen.getByRole('button', { name: 'Replace my edits with current values' }))
    await waitFor(() =>
      expect((screen.getByLabelText('Support email') as HTMLInputElement).value).toBe(
        'support@example.com'
      )
    )
  })

  it('reorders and removes rows without discarding the remaining unsaved values', async () => {
    renderPage()
    await screen.findByLabelText('Support email')
    fireEvent.click(screen.getByRole('button', { name: 'Add location' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add location' }))
    const names = screen.getAllByLabelText('Location name')
    fireEvent.change(names[0]!, { target: { value: 'North' } })
    fireEvent.change(names[1]!, { target: { value: 'South' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Move up' })[1]!)
    expect((screen.getAllByLabelText('Location name')[0] as HTMLInputElement).value).toBe('South')
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove location' })[1]!)
    expect(screen.getAllByLabelText('Location name')).toHaveLength(1)
    expect((screen.getByLabelText('Location name') as HTMLInputElement).value).toBe('South')
    fireEvent.click(screen.getByRole('button', { name: 'Add social link' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add social link' }))
    const labels = screen.getAllByLabelText('Link label')
    fireEvent.change(labels[0]!, { target: { value: 'First' } })
    fireEvent.change(labels[1]!, { target: { value: 'Second' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Move up' })[2]!)
    expect((screen.getAllByLabelText('Link label')[0] as HTMLInputElement).value).toBe('Second')
  })

  it('renders a disabled bilingual read-only editor', async () => {
    renderPage(false, 'zh-CN')
    const email = await screen.findByLabelText('客服邮箱')
    expect((email as HTMLInputElement).disabled).toBe(true)
    expect(screen.queryByRole('button', { name: '保存联系方式' })).toBeNull()
    expect(submitted).toHaveLength(0)
  })
})
