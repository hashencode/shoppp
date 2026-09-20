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
    'setup-guide': { title: 'Store setup guide', headingOwner: 'custom' },
    'commerce-dashboard': { title: 'Commerce dashboard', headingOwner: 'custom' },
    'order-report': { title: 'Revenue report', headingOwner: 'standard-list' },
    'catalog-products': { title: 'Catalog', headingOwner: 'standard-list' },
    'catalog-reviews': { title: 'Reviews', headingOwner: 'custom' },
    'storefront-themes': { title: 'Storefront themes', headingOwner: 'custom' },
    inventory: { title: 'Inventory', headingOwner: 'standard-list' },
    orders: { title: 'Orders', headingOwner: 'standard-list' },
    fulfillment: { title: 'Fulfillment', headingOwner: 'custom' },
    'notification-recovery': { title: 'Automation recovery', headingOwner: 'standard-list' },
    'contact-settings': { title: 'Contact settings', headingOwner: 'top-level-form' },
    'launch-settings': { title: 'Commercial settings', headingOwner: 'top-level-form' },
    'shipping-settings': { title: 'Shipping settings', headingOwner: 'top-level-form' },
    audit: { title: 'Audit trail', headingOwner: 'custom' },
    privacy: { title: 'Privacy requests', headingOwner: 'custom' },
    'iam-users': { title: 'Users & invitations', headingOwner: 'custom' },
    'iam-roles': { title: 'Roles', headingOwner: 'standard-list' },
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

  it('includes grouped IAM entries without changing their breadcrumb contract', () => {
    const groupedRoutes = templateRoutes
      .filter((route) => route.inMenu && route.menuGroup)
      .map(({ key, menuGroup, breadcrumb }) => ({ key, menuGroup, breadcrumb }))

    expect(groupedRoutes).toEqual([
      {
        key: 'iam-users',
        menuGroup: 'Access management',
        breadcrumb: ['Access management', 'Users & invitations'],
      },
      {
        key: 'iam-roles',
        menuGroup: 'Access management',
        breadcrumb: ['Access management', 'Roles'],
      },
    ])
  })
})
