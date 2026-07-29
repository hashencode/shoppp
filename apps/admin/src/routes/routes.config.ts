import {
  BarChartOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DatabaseOutlined,
  ExclamationCircleOutlined,
  FormOutlined,
  FileTextOutlined,
  ProfileOutlined,
  ReloadOutlined,
  ShoppingCartOutlined,
  ShoppingOutlined,
  DollarOutlined,
  AuditOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  GlobalOutlined,
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

const commerceRoutes: TemplateRoute[] = [
  {
    key: 'commerce-dashboard',
    path: '/dashboard',
    title: 'Commerce dashboard',
    icon: createElement(DollarOutlined),
    permission: 'reporting.read',
    inMenu: true,
    menuMode: 'standalone',
    breadcrumb: ['Commerce dashboard'],
    component: () =>
      lazyPage(() =>
        import('../pages/dashboard/dashboard-page').then((m) => ({
          default: m.DashboardPage,
        }))
      ),
  },
  {
    key: 'order-report',
    path: '/reports/orders',
    title: 'Revenue report',
    icon: createElement(FileTextOutlined),
    permission: 'reporting.read',
    inMenu: true,
    menuMode: 'standalone',
    breadcrumb: ['Reports', 'Order revenue'],
    component: () =>
      lazyPage(() =>
        import('../pages/reports/order-report-page').then((m) => ({
          default: m.OrderReportPage,
        }))
      ),
  },
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
    key: 'notification-recovery',
    path: '/operations/jobs',
    title: 'Automation recovery',
    icon: createElement(ReloadOutlined),
    permission: 'operations.jobs.read',
    inMenu: true,
    menuMode: 'standalone',
    breadcrumb: ['Operations', 'Automation recovery'],
    component: () =>
      lazyPage(() =>
        import('../pages/operations/jobs/notification-jobs-page').then((m) => ({
          default: m.NotificationJobsPage,
        }))
      ),
  },
  {
    key: 'launch-settings',
    path: '/settings/launch',
    title: 'Launch settings',
    icon: createElement(SettingOutlined),
    permission: 'settings.read',
    inMenu: true,
    menuMode: 'standalone',
    breadcrumb: ['Settings', 'Launch'],
    component: () =>
      lazyPage(() =>
        import('../pages/settings/launch-settings-page').then((m) => ({
          default: m.LaunchSettingsPage,
        }))
      ),
  },
  {
    key: 'shipping-settings',
    path: '/settings/shipping',
    title: 'Shipping settings',
    icon: createElement(GlobalOutlined),
    permission: 'settings.read',
    inMenu: true,
    menuMode: 'standalone',
    breadcrumb: ['Settings', 'Shipping'],
    component: () =>
      lazyPage(() =>
        import('../pages/settings/shipping-settings-page').then((m) => ({
          default: m.ShippingSettingsPage,
        }))
      ),
  },
  {
    key: 'audit',
    path: '/audit',
    title: 'Audit trail',
    icon: createElement(AuditOutlined),
    permission: 'audit.read',
    inMenu: true,
    menuMode: 'standalone',
    breadcrumb: ['Operations', 'Audit'],
    component: () =>
      lazyPage(() =>
        import('../pages/audit/audit-page').then((m) => ({
          default: m.AuditPage,
        }))
      ),
  },
  {
    key: 'privacy',
    path: '/privacy',
    title: 'Privacy requests',
    icon: createElement(SafetyCertificateOutlined),
    permission: 'privacy.manage',
    inMenu: true,
    menuMode: 'standalone',
    breadcrumb: ['Operations', 'Privacy requests'],
    component: () =>
      lazyPage(() =>
        import('../pages/privacy/privacy-page').then((m) => ({
          default: m.PrivacyPage,
        }))
      ),
  },
]

const templateRoutesEnabled =
  typeof __ENABLE_TEMPLATE_ROUTES__ !== 'undefined' && __ENABLE_TEMPLATE_ROUTES__
const developmentTemplateRoutes: TemplateRoute[] = templateRoutesEnabled
  ? [
  {
    key: 'welcome',
    path: '/template',
    title: '欢迎',
    icon: createElement(SmileOutlined),
    permission: 'dashboard.read',
    inMenu: true,
    menuVisibility: 'dev-only',
    menuGroup: 'Template',
    component: () =>
      lazyPage(() =>
        import('../pages/home/welcome-page').then((m) => ({ default: m.WelcomePage }))
      ),
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
      lazyPage(() =>
        import('../pages/templates/dashboard/analysis-page').then((m) => ({
          default: m.AnalysisPage,
        }))
      ),
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
      lazyPage(() =>
        import('../pages/templates/list/table-query-page').then((m) => ({
          default: m.TableQueryPage,
        }))
      ),
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
      lazyPage(() =>
        import('../pages/templates/form/basic-form-page').then((m) => ({
          default: m.BasicFormPage,
        }))
      ),
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
      lazyPage(() =>
        import('../pages/templates/form/step-form-page').then((m) => ({ default: m.StepFormPage }))
      ),
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
      lazyPage(() =>
        import('../pages/templates/form/advanced-form-page').then((m) => ({
          default: m.AdvancedFormPage,
        }))
      ),
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
      lazyPage(() =>
        import('../pages/templates/profile/basic-profile-page').then((m) => ({
          default: m.BasicProfilePage,
        }))
      ),
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
        import('../pages/templates/dashboard/result-success-page').then((m) => ({
          default: m.ResultSuccessPage,
        }))
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
      lazyPage(() =>
        import('../pages/templates/dashboard/result-fail-page').then((m) => ({
          default: m.ResultFailPage,
        }))
      ),
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
      lazyPage(() =>
        import('../pages/templates/exception/forbidden-page').then((m) => ({
          default: m.ForbiddenPage,
        }))
      ),
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
      lazyPage(() =>
        import('../pages/templates/exception/server-error-page').then((m) => ({
          default: m.ServerErrorPage,
        }))
      ),
  },
    ]
  : []

export const templateRoutes: TemplateRoute[] = [
  ...commerceRoutes,
  ...developmentTemplateRoutes,
  {
    key: 'exception-404',
    path: '*',
    title: '404',
    icon: createElement(ExclamationCircleOutlined),
    permission: 'exception.read',
    inMenu: false,
    breadcrumb: ['异常页', '404'],
    component: () =>
      lazyPage(() =>
        import('../pages/not-found-page').then((m) => ({
          default: m.NotFoundPage,
        }))
      ),
  },
]
