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
    expect(screen.getByText('Access denied')).toBeTruthy()
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
    expect(await screen.findByText('Form details could not be loaded')).toBeTruthy()
    expect(screen.getByRole('heading', { level: 4, name: 'Contact settings' })).toBeTruthy()
  })

  it('places publication guidance inside Global contact channels', async () => {
    const { container } = renderPage()
    await screen.findByLabelText('Support email')
    const guidance = screen.getByText(
      'New storefront previews and versions use these public channels. Saving later changes leaves existing versions unchanged.'
    )
    expect(guidance.closest('.ant-card')?.textContent).toContain('Global contact channels')

    const pageRoot = container.querySelector('.space-y-4.pb-20')
    expect(pageRoot?.className).not.toContain('max-w-5xl')
    expect(pageRoot?.className).not.toContain('mx-auto')

    const cardBodyClassName = (title: string) =>
      screen.getByText(title).closest('.ant-card')?.querySelector('.ant-card-body')?.className

    expect(cardBodyClassName('Global contact channels')).toContain('max-w-[800px]')
    expect(cardBodyClassName('Global contact channels')).toContain('admin-form-content-align')
    expect(cardBodyClassName('Physical locations')).toContain('max-w-[800px]')
    expect(cardBodyClassName('Physical locations')).toContain('admin-form-content-align')
    expect(cardBodyClassName('Social links')).toContain('max-w-[800px]')
    expect(cardBodyClassName('Social links')).toContain('admin-form-content-align')
    const cardBodies = container.querySelectorAll('.ant-card > .ant-card-body')
    const finalCardBodyClassName = cardBodies[cardBodies.length - 1]?.className
    expect(finalCardBodyClassName).toContain('max-w-[800px]')
    expect(finalCardBodyClassName).toContain('admin-form-content-align')
    expect(container.querySelectorAll('[class~="md:grid-cols-2"]')).toHaveLength(0)
    expect(container.querySelector('.ax-fixed-toolbar')).toBeTruthy()
  })

  it('preserves a draft when reset is cancelled and restores saved values when confirmed', async () => {
    renderPage()
    const supportEmail = await screen.findByLabelText('Support email')
    fireEvent.change(supportEmail, { target: { value: 'draft@example.com' } })

    fireEvent.click(screen.getByRole('button', { name: 'Reset changes' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }))
    expect((supportEmail as HTMLInputElement).value).toBe('draft@example.com')

    fireEvent.click(screen.getByRole('button', { name: 'Reset changes' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }))
    expect((supportEmail as HTMLInputElement).value).toBe('support@example.com')
    expect(submitted).toHaveLength(0)
  })

  it('focuses the first invalid dynamic field without submitting', async () => {
    renderPage()
    await screen.findByLabelText('Support email')
    fireEvent.click(screen.getByRole('button', { name: 'Add location' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save contact settings' }))

    const firstInvalidField = screen.getByLabelText('Location name')
    await waitFor(() => expect(document.activeElement).toBe(firstInvalidField))
    expect(submitted).toHaveLength(0)
  })

  it('saves structured hours and fixed social data without an operator reason', async () => {
    renderPage()
    await screen.findByLabelText('Support email')
    fireEvent.click(screen.getByRole('switch', { name: 'Show support email publicly' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add location' }))
    fireEvent.change(screen.getByLabelText('Location name'), { target: { value: 'Studio' } })
    fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Shanghai' } })
    fireEvent.change(screen.getByLabelText('Postal address'), {
      target: { value: '123 Test Road' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add service hours' }))
    await screen.findByLabelText('Start weekday')
    const timeZone = screen.getByLabelText('Time zone')
    fireEvent.mouseDown(timeZone)
    fireEvent.change(timeZone, { target: { value: 'Asia/Shanghai' } })
    fireEvent.click(
      await screen.findByText('Asia/Shanghai', { selector: '.ant-select-item-option-content' })
    )
    fireEvent.click(screen.getByRole('button', { name: 'Add social link' }))
    fireEvent.mouseDown(screen.getByLabelText('Platform'))
    fireEvent.click(await screen.findByText('Instagram'))
    fireEvent.change(screen.getByLabelText('Destination URL'), {
      target: { value: 'https://instagram.com/shop' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save contact settings' }))
    await waitFor(() => expect(submitted).toHaveLength(1))
    expect(submitted[0]).toMatchObject({
      expectedLaunchVersion: 'launch-v1',
      expectedProfileVersion: null,
      profile: {
        publishSupportEmail: true,
        serviceHours: {
          kind: 'weekly',
          ranges: [
            {
              startDay: 'monday',
              endDay: 'friday',
              startTime: '09:00',
              endTime: '18:00',
            },
          ],
        },
        timeZone: 'Asia/Shanghai',
        locations: [{ name: 'Studio', city: 'Shanghai', address: '123 Test Road', visible: false }],
        socials: [
          {
            platform: 'instagram',
            label: 'Instagram',
            url: 'https://instagram.com/shop',
            visible: false,
          },
        ],
      },
    })
    expect(submitted[0]).not.toHaveProperty('reason')
    expect(screen.queryByLabelText('Link label')).toBeNull()
    expect(screen.queryByLabelText('Change reason')).toBeNull()
  })

  it('keeps stale edits visible and offers an explicit reload; readonly users cannot save', async () => {
    conflict = true
    renderPage()
    await screen.findByLabelText('Support email')
    fireEvent.change(screen.getByLabelText('Support email'), {
      target: { value: 'changed@example.com' },
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
    const urls = screen.getAllByLabelText('Destination URL')
    fireEvent.change(urls[0]!, { target: { value: 'https://facebook.com/shop' } })
    fireEvent.change(urls[1]!, { target: { value: 'https://dribbble.com/shop' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Move up' })[2]!)
    expect((screen.getAllByLabelText('Destination URL')[0] as HTMLInputElement).value).toBe(
      'https://dribbble.com/shop'
    )
  })

  it('renders a disabled bilingual read-only editor', async () => {
    renderPage(false, 'zh-CN')
    const email = await screen.findByLabelText('客服邮箱')
    expect((email as HTMLInputElement).disabled).toBe(true)
    expect(screen.queryByRole('button', { name: '保存联系方式' })).toBeNull()
    expect(submitted).toHaveLength(0)
  })
})
