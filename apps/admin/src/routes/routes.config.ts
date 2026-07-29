import {
  BarChartOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DatabaseOutlined,
  ExclamationCircleOutlined,
  FormOutlined,
  ProfileOutlined,
  ShoppingCartOutlined,
  ShoppingOutlined,
  SmileOutlined,
  TableOutlined,
} from '@ant-design/icons'
import { createElement, type ReactNode } from 'react'
import { type PermissionKey } from '../infrastructure/auth/permissions'
import { lazyPage } from '../shared/components/lazy-page.tsx'

export type TemplateRoute = {
  key: string
  path: string
  title: string
  icon: ReactNode
  permission: PermissionKey
  inMenu: boolean
  menuVisibility?: 'always' | 'dev-only'
  menuMode?: 'standalone' | 'grouped'
  menuGroup?: string
  breadcrumb?: string[]
  component: () => ReactNode
}

export const templateRoutes: TemplateRoute[] = [
  {
    key: 'catalog-products',
    path: '/catalog/products',
    title: 'Catalog',
    icon: createElement(ShoppingOutlined),
    permission: 'catalog.read',
    inMenu: true,
    menuMode: 'standalone',
    breadcrumb: ['Catalog', 'Products'],
    component: () =>
      lazyPage(() =>
        import('../pages/catalog/catalog-list-page').then((m) => ({
          default: m.CatalogListPage,
        }))
      ),
  },
  {
    key: 'catalog-product-form',
    path: '/catalog/products/form',
    title: 'Product',
    icon: createElement(FormOutlined),
    permission: 'catalog.read',
    inMenu: false,
    breadcrumb: ['Catalog', 'Products', 'Product'],
    component: () =>
      lazyPage(() =>
        import('../pages/catalog/catalog-form-page').then((m) => ({
          default: m.CatalogFormPage,
        }))
      ),
  },
  {
    key: 'inventory',
    path: '/inventory',
    title: 'Inventory',
    icon: createElement(DatabaseOutlined),
    permission: 'inventory.read',
    inMenu: true,
    menuMode: 'standalone',
    breadcrumb: ['Inventory'],
    component: () =>
      lazyPage(() =>
        import('../pages/inventory/inventory-page').then((m) => ({
          default: m.InventoryPage,
        }))
      ),
  },
  {
    key: 'orders',
    path: '/orders',
    title: 'Orders',
    icon: createElement(ShoppingCartOutlined),
    permission: 'orders.read',
    inMenu: true,
    menuMode: 'standalone',
    breadcrumb: ['Orders'],
    component: () =>
      lazyPage(() =>
        import('../pages/orders/order-list-page').then((m) => ({
          default: m.OrderListPage,
        }))
      ),
  },
  {
    key: 'order-detail',
    path: '/orders/:reference',
    title: 'Order',
    icon: createElement(ShoppingCartOutlined),
    permission: 'orders.read',
    inMenu: false,
    breadcrumb: ['Orders', 'Order'],
    component: () =>
      lazyPage(() =>
        import('../pages/orders/order-detail').then((m) => ({
          default: m.OrderDetailPage,
        }))
      ),
  },
  {
    key: 'fulfillment',
    path: '/fulfillment',
    title: 'Fulfillment',
    icon: createElement(ShoppingCartOutlined),
    permission: 'orders.fulfill',
    inMenu: true,
    menuMode: 'standalone',
    breadcrumb: ['Fulfillment'],
    component: () =>
      lazyPage(() =>
        import('../pages/fulfillment/fulfillment-page').then((m) => ({
          default: m.FulfillmentPage,
        }))
      ),
  },
  {
    key: 'welcome',
    path: '/template',
    title: '欢迎',
    icon: createElement(SmileOutlined),
    permission: 'dashboard.read',
    inMenu: true,
    menuVisibility: 'dev-only',
    menuGroup: 'Template',
    component: () => lazyPage(() => import('../pages/home/welcome-page').then((m) => ({ default: m.WelcomePage }))),
  },
  {
    key: 'analysis',
    path: '/template/dashboard/analysis',
    title: '仪表盘',
    icon: createElement(BarChartOutlined),
    permission: 'dashboard.read',
    inMenu: true,
    menuVisibility: 'dev-only',
    menuGroup: 'Template',
    component: () =>
      lazyPage(() => import('../pages/templates/dashboard/analysis-page').then((m) => ({ default: m.AnalysisPage }))),
  },
  {
    key: 'table-query',
    path: '/template/list/table',
    title: '查询列表',
    icon: createElement(TableOutlined),
    permission: 'list.read',
    inMenu: true,
    menuVisibility: 'dev-only',
    menuGroup: 'Template',
    component: () =>
      lazyPage(() => import('../pages/templates/list/table-query-page').then((m) => ({ default: m.TableQueryPage }))),
  },
  {
    key: 'list-prompt-generator',
    path: '/dev/list/prompt-generator',
    title: '列表提示词生成',
    icon: createElement(TableOutlined),
    permission: 'list.read',
    inMenu: true,
    menuVisibility: 'dev-only',
    component: () =>
      lazyPage(() =>
        import('../pages/templates/list/list-prompt-generator-page').then((m) => ({
          default: m.ListPromptGeneratorPage,
        }))
      ),
  },
  {
    key: 'basic-form',
    path: '/template/list/table/form',
    title: '基础表单',
    icon: createElement(FormOutlined),
    permission: 'form.read',
    inMenu: true,
    menuVisibility: 'dev-only',
    menuGroup: 'Template',
    breadcrumb: ['表单页', '基础表单'],
    component: () =>
      lazyPage(() => import('../pages/templates/form/basic-form-page').then((m) => ({ default: m.BasicFormPage }))),
  },
  {
    key: 'step-form',
    path: '/template/form/step-form',
    title: '分步表单',
    icon: createElement(FormOutlined),
    permission: 'form.write',
    inMenu: true,
    menuVisibility: 'dev-only',
    menuGroup: 'Template',
    breadcrumb: ['表单页', '分步表单'],
    component: () =>
      lazyPage(() => import('../pages/templates/form/step-form-page').then((m) => ({ default: m.StepFormPage }))),
  },
  {
    key: 'advanced-form',
    path: '/template/form/advanced-form',
    title: '高级表单',
    icon: createElement(FormOutlined),
    permission: 'form.write',
    inMenu: true,
    menuVisibility: 'dev-only',
    menuGroup: 'Template',
    breadcrumb: ['表单页', '高级表单'],
    component: () =>
      lazyPage(() => import('../pages/templates/form/advanced-form-page').then((m) => ({ default: m.AdvancedFormPage }))),
  },
  {
    key: 'basic-profile',
    path: '/template/profile/basic',
    title: '详情页',
    icon: createElement(ProfileOutlined),
    permission: 'profile.read',
    inMenu: true,
    menuVisibility: 'dev-only',
    menuGroup: 'Template',
    component: () =>
      lazyPage(() => import('../pages/templates/profile/basic-profile-page').then((m) => ({ default: m.BasicProfilePage }))),
  },
  {
    key: 'result-success',
    path: '/template/result/success',
    title: '成功页',
    icon: createElement(CheckCircleOutlined),
    permission: 'result.read',
    inMenu: true,
    menuVisibility: 'dev-only',
    menuGroup: 'Template',
    breadcrumb: ['结果页', '成功页'],
    component: () =>
      lazyPage(() =>
        import('../pages/templates/dashboard/result-success-page').then((m) => ({ default: m.ResultSuccessPage }))
      ),
  },
  {
    key: 'result-fail',
    path: '/template/result/fail',
    title: '失败页',
    icon: createElement(CloseCircleOutlined),
    permission: 'result.read',
    inMenu: true,
    menuVisibility: 'dev-only',
    menuGroup: 'Template',
    breadcrumb: ['结果页', '失败页'],
    component: () =>
      lazyPage(() => import('../pages/templates/dashboard/result-fail-page').then((m) => ({ default: m.ResultFailPage }))),
  },
  {
    key: 'exception-403',
    path: '/template/exception/403',
    title: '403',
    icon: createElement(ExclamationCircleOutlined),
    permission: 'exception.read',
    inMenu: true,
    menuVisibility: 'dev-only',
    menuGroup: 'Template',
    breadcrumb: ['异常页', '403'],
    component: () =>
      lazyPage(() => import('../pages/templates/exception/forbidden-page').then((m) => ({ default: m.ForbiddenPage }))),
  },
  {
    key: 'exception-500',
    path: '/template/exception/500',
    title: '500',
    icon: createElement(ExclamationCircleOutlined),
    permission: 'exception.read',
    inMenu: true,
    menuVisibility: 'dev-only',
    menuGroup: 'Template',
    breadcrumb: ['异常页', '500'],
    component: () =>
      lazyPage(() => import('../pages/templates/exception/server-error-page').then((m) => ({ default: m.ServerErrorPage }))),
  },
  {
    key: 'exception-404',
    path: '*',
    title: '404',
    icon: createElement(ExclamationCircleOutlined),
    permission: 'exception.read',
    inMenu: false,
    breadcrumb: ['异常页', '404'],
    component: () =>
      lazyPage(() => import('../pages/templates/exception/not-found-page').then((m) => ({ default: m.NotFoundPage }))),
  },
]
