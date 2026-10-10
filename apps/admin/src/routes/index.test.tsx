import React from 'react'
import { ConfigProvider, DatePicker } from 'antd'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from '@rstest/core'
import { getAntdLocale } from './antd-locale'
import { templateRoutes } from './routes.config'

void React

describe('Ant Design locale', () => {
  it('uses locale-sensitive component copy for Chinese and English', () => {
    const { rerender } = render(
      <ConfigProvider locale={getAntdLocale('zh-CN')}>
        <DatePicker />
      </ConfigProvider>
    )

    expect(screen.getByPlaceholderText('请选择日期')).toBeTruthy()

    rerender(
      <ConfigProvider locale={getAntdLocale('en-US')}>
        <DatePicker />
      </ConfigProvider>
    )

    expect(screen.getByPlaceholderText('Select date')).toBeTruthy()
  })
})

describe('first-level menu route contract', () => {
  const firstLevelRouteInventory = {
    'commerce-dashboard': { title: 'Commerce dashboard', headingOwner: 'custom' },
    'setup-guide': { title: 'Store setup guide', headingOwner: 'custom' },
    orders: { title: 'Orders', headingOwner: 'standard-list' },
    fulfillment: { title: 'Fulfillment', headingOwner: 'custom' },
    'catalog-products': { title: 'Catalog', headingOwner: 'standard-list' },
    'catalog-collections': { title: 'Collections', headingOwner: 'standard-list' },
    inventory: { title: 'Inventory', headingOwner: 'standard-list' },
    'catalog-reviews': { title: 'Reviews', headingOwner: 'custom' },
    'content-pages': { title: 'Pages', headingOwner: 'standard-list' },
    'content-articles': { title: 'Articles', headingOwner: 'standard-list' },
    'storefront-navigation': { title: 'Navigation', headingOwner: 'custom' },
    'storefront-themes': { title: 'Storefront themes', headingOwner: 'custom' },
    'order-report': { title: 'Revenue report', headingOwner: 'standard-list' },
    'store-identity': { title: 'Store identity', headingOwner: 'top-level-form' },
    'contact-settings': { title: 'Contact settings', headingOwner: 'top-level-form' },
    'launch-settings': { title: 'Commercial settings', headingOwner: 'top-level-form' },
    'shipping-settings': { title: 'Shipping settings', headingOwner: 'top-level-form' },
    policies: { title: 'Policies', headingOwner: 'custom' },
    'iam-users': { title: 'Users & invitations', headingOwner: 'custom' },
    'iam-roles': { title: 'Roles', headingOwner: 'standard-list' },
    privacy: { title: 'Privacy requests', headingOwner: 'custom' },
    audit: { title: 'Audit trail', headingOwner: 'custom' },
    'notification-recovery': { title: 'Automation recovery', headingOwner: 'standard-list' },
  } as const

  it('keeps every menu route in the documented heading-owner inventory', () => {
    const menuRoutes = templateRoutes.filter((route) => route.inMenu)

    expect(menuRoutes.map(({ key, title }) => ({ key, title }))).toEqual(
      Object.entries(firstLevelRouteInventory).map(([key, { title }]) => ({ key, title }))
    )

    const headingOwners = Object.values(firstLevelRouteInventory).map(
      ({ headingOwner }) => headingOwner
    )
    expect(headingOwners).toContain('standard-list')
    expect(headingOwners).toContain('custom')
    expect(headingOwners).toContain('top-level-form')
  })

  it('organizes the existing destinations into seven ordered merchant tasks', () => {
    const groups = new Map<string | undefined, string[]>()
    for (const route of templateRoutes.filter(({ inMenu }) => inMenu)) {
      const paths = groups.get(route.menuGroup) ?? []
      paths.push(route.path)
      groups.set(route.menuGroup, paths)
    }

    expect([...groups]).toEqual([
      ['Home', ['/dashboard', '/welcome']],
      ['Orders', ['/orders', '/fulfillment']],
      ['Products', ['/catalog/products', '/catalog/collections', '/inventory', '/catalog/reviews']],
      ['Content', ['/content/pages', '/content/articles', '/storefront/navigation']],
      ['Online store', ['/storefront/themes']],
      ['Analytics', ['/reports/orders']],
      [
        'Settings',
        [
          '/settings/identity',
          '/settings/contact',
          '/settings/launch',
          '/settings/shipping',
          '/settings/policies',
          '/access/users',
          '/access/roles',
          '/privacy',
          '/audit',
          '/operations/jobs',
        ],
      ],
    ])
    const menuPaths = templateRoutes.filter(({ inMenu }) => inMenu).map(({ path }) => path)
    expect(new Set(menuPaths).size).toBe(menuPaths.length)
    expect(templateRoutes.filter(({ inMenu }) => !inMenu).map(({ path }) => path)).toEqual([
      '/orders/:reference',
      '/catalog/products/form',
      '/catalog/collections/form',
      '/content/pages/form',
      '/content/articles/form',
      '/storefront/themes/:draftId',
      '/access/users/:id',
      '/access/roles/:id',
      '*',
    ])
  })

  it('keeps menu-only labels separate from the original page and breadcrumb metadata', () => {
    expect(templateRoutes.find(({ key }) => key === 'catalog-products')).toMatchObject({
      title: 'Catalog',
      menuTitle: 'Products',
      menuMode: 'standalone',
      breadcrumb: ['Catalog', 'Products'],
    })
    expect(templateRoutes.find(({ key }) => key === 'contact-settings')).toMatchObject({
      title: 'Contact settings',
      menuTitle: 'Contact information',
      breadcrumb: ['Store settings', 'Contact settings'],
    })
    expect(templateRoutes.find(({ key }) => key === 'iam-users')).toMatchObject({
      menuGroup: 'Settings',
      breadcrumb: ['Access management', 'Users & invitations'],
    })
    expect(templateRoutes.find(({ key }) => key === 'iam-roles')).toMatchObject({
      menuGroup: 'Settings',
      breadcrumb: ['Access management', 'Roles'],
    })
  })
})
