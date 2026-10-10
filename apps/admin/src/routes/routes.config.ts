import {
  DatabaseOutlined,
  ExclamationCircleOutlined,
  FormOutlined,
  FileTextOutlined,
  ReloadOutlined,
  ShoppingCartOutlined,
  ShoppingOutlined,
  DollarOutlined,
  AuditOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  SkinOutlined,
  GlobalOutlined,
  TeamOutlined,
  KeyOutlined,
  SmileOutlined,
  IdcardOutlined,
  FileProtectOutlined,
} from '@ant-design/icons'
import { createElement, type ReactNode } from 'react'
import { type PermissionKey } from '../infrastructure/auth/permissions'
import { lazyPage } from '../shared/components/lazy-page.tsx'

export type TemplateRoute = {
  key: string
  path: string
  title: string
  icon: ReactNode
  permission: PermissionKey | null
  inMenu: boolean
  menuVisibility?: 'always' | 'dev-only'
  menuMode?: 'standalone' | 'grouped'
  menuGroup?: string
  menuTitle?: string
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
    menuGroup: 'Home',
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
    key: 'setup-guide',
    path: '/welcome',
    title: 'Store setup guide',
    icon: createElement(SmileOutlined),
    permission: null,
    inMenu: true,
    menuGroup: 'Home',
    menuMode: 'standalone',
    component: () =>
      lazyPage(() =>
        import('../pages/home/welcome-page').then((m) => ({ default: m.WelcomePage }))
      ),
  },
  {
    key: 'orders',
    path: '/orders',
    title: 'Orders',
    icon: createElement(ShoppingCartOutlined),
    permission: 'orders.read',
    inMenu: true,
    menuGroup: 'Orders',
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
    menuGroup: 'Orders',
    menuTitle: 'Shipping and fulfillment',
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
    key: 'catalog-products',
    path: '/catalog/products',
    title: 'Catalog',
    icon: createElement(ShoppingOutlined),
    permission: 'catalog.read',
    inMenu: true,
    menuGroup: 'Products',
    menuTitle: 'Products',
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
    key: 'catalog-collections',
    path: '/catalog/collections',
    title: 'Collections',
    icon: createElement(ShoppingOutlined),
    permission: 'catalog.read',
    inMenu: true,
    menuGroup: 'Products',
    menuTitle: 'Product collections',
    breadcrumb: ['Catalog', 'Collections'],
    component: () =>
      lazyPage(() =>
        import('../pages/catalog/collection-list-page').then((m) => ({
          default: m.CollectionListPage,
        }))
      ),
  },
  {
    key: 'catalog-collection-form',
    path: '/catalog/collections/form',
    title: 'Collection',
    icon: createElement(FormOutlined),
    permission: 'catalog.read',
    inMenu: false,
    breadcrumb: ['Catalog', 'Collections', 'Collection'],
    component: () =>
      lazyPage(() =>
        import('../pages/catalog/collection-form-page').then((m) => ({
          default: m.CollectionFormPage,
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
    menuGroup: 'Products',
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
    key: 'catalog-reviews',
    path: '/catalog/reviews',
    title: 'Reviews',
    icon: createElement(AuditOutlined),
    permission: 'reviews.moderate',
    inMenu: true,
    menuGroup: 'Products',
    menuMode: 'standalone',
    breadcrumb: ['Catalog', 'Reviews'],
    component: () =>
      lazyPage(() =>
        import('../pages/catalog/review-moderation-page').then((m) => ({
          default: m.ReviewModerationPage,
        }))
      ),
  },
  {
    key: 'content-pages',
    path: '/content/pages',
    title: 'Pages',
    icon: createElement(FileTextOutlined),
    permission: 'content.read',
    inMenu: true,
    menuGroup: 'Content',
    breadcrumb: ['Content', 'Pages'],
    component: () =>
      lazyPage(() =>
        import('../pages/content/content-list-page').then((m) => ({
          default: m.ContentPagesListPage,
        }))
      ),
  },
  {
    key: 'content-page-form',
    path: '/content/pages/form',
    title: 'Page',
    icon: createElement(FormOutlined),
    permission: 'content.read',
    inMenu: false,
    breadcrumb: ['Content', 'Pages', 'Page'],
    component: () =>
      lazyPage(() =>
        import('../pages/content/page-editor-page').then((m) => ({ default: m.PageEditorPage }))
      ),
  },
  {
    key: 'content-articles',
    path: '/content/articles',
    title: 'Articles',
    icon: createElement(FileTextOutlined),
    permission: 'content.read',
    inMenu: true,
    menuGroup: 'Content',
    breadcrumb: ['Content', 'Articles'],
    component: () =>
      lazyPage(() =>
        import('../pages/content/content-list-page').then((m) => ({
          default: m.ContentArticlesListPage,
        }))
      ),
  },
  {
    key: 'content-article-form',
    path: '/content/articles/form',
    title: 'Article',
    icon: createElement(FormOutlined),
    permission: 'content.read',
    inMenu: false,
    breadcrumb: ['Content', 'Articles', 'Article'],
    component: () =>
      lazyPage(() =>
        import('../pages/content/article-editor-page').then((m) => ({
          default: m.ArticleEditorPage,
        }))
      ),
  },
  {
    key: 'storefront-navigation',
    path: '/storefront/navigation',
    title: 'Navigation',
    icon: createElement(GlobalOutlined),
    permission: 'navigation.read',
    inMenu: true,
    menuGroup: 'Content',
    menuTitle: 'Navigation menus',
    menuMode: 'standalone',
    breadcrumb: ['Storefront', 'Navigation'],
    component: () =>
      lazyPage(() =>
        import('../pages/storefront/navigation-page').then((m) => ({
          default: m.NavigationPage,
        }))
      ),
  },
  {
    key: 'storefront-themes',
    path: '/storefront/themes',
    title: 'Storefront themes',
    icon: createElement(SkinOutlined),
    permission: 'themes.read',
    inMenu: true,
    menuGroup: 'Online store',
    menuTitle: 'Store design',
    menuMode: 'standalone',
    breadcrumb: ['Storefront', 'Themes'],
    component: () =>
      lazyPage(() =>
        import('../pages/storefront/themes-page').then((m) => ({
          default: m.ThemesPage,
        }))
      ),
  },
  {
    key: 'storefront-theme-editor',
    path: '/storefront/themes/:draftId',
    title: 'Theme editor',
    icon: createElement(SkinOutlined),
    permission: 'themes.read',
    inMenu: false,
    breadcrumb: ['Storefront', 'Themes', 'Editor'],
    component: () =>
      lazyPage(() =>
        import('../pages/storefront/theme-editor-page').then((m) => ({
          default: m.ThemeEditorPage,
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
    menuGroup: 'Analytics',
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
    key: 'store-identity',
    path: '/settings/identity',
    title: 'Store identity',
    icon: createElement(IdcardOutlined),
    permission: 'identity.read',
    inMenu: true,
    menuGroup: 'Settings',
    menuTitle: 'Store details',
    breadcrumb: ['Store settings', 'Store identity'],
    component: () =>
      lazyPage(() =>
        import('../pages/settings/store-identity-page').then((m) => ({
          default: m.StoreIdentityPage,
        }))
      ),
  },
  {
    key: 'contact-settings',
    path: '/settings/contact',
    title: 'Contact settings',
    icon: createElement(SettingOutlined),
    permission: 'settings.read',
    inMenu: true,
    menuGroup: 'Settings',
    menuTitle: 'Contact information',
    breadcrumb: ['Store settings', 'Contact settings'],
    component: () =>
      lazyPage(() =>
        import('../pages/settings/contact-settings-page').then((m) => ({
          default: m.ContactSettingsPage,
        }))
      ),
  },
  {
    key: 'launch-settings',
    path: '/settings/launch',
    title: 'Commercial settings',
    icon: createElement(SettingOutlined),
    permission: 'settings.read',
    inMenu: true,
    menuGroup: 'Settings',
    menuTitle: 'Business settings',
    breadcrumb: ['Store settings', 'Commercial settings'],
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
    menuGroup: 'Settings',
    breadcrumb: ['Store settings', 'Shipping settings'],
    component: () =>
      lazyPage(() =>
        import('../pages/settings/shipping-settings-page').then((m) => ({
          default: m.ShippingSettingsPage,
        }))
      ),
  },
  {
    key: 'policies',
    path: '/settings/policies',
    title: 'Policies',
    icon: createElement(FileProtectOutlined),
    permission: 'policies.read',
    inMenu: true,
    menuGroup: 'Settings',
    breadcrumb: ['Store settings', 'Policies'],
    component: () =>
      lazyPage(() =>
        import('../pages/settings/policies-page').then((m) => ({
          default: m.PoliciesPage,
        }))
      ),
  },
  {
    key: 'iam-users',
    path: '/access/users',
    title: 'Users & invitations',
    icon: createElement(TeamOutlined),
    permission: 'iam.users.read',
    inMenu: true,
    menuGroup: 'Settings',
    breadcrumb: ['Access management', 'Users & invitations'],
    component: () =>
      lazyPage(() => import('../pages/iam/users-page').then((m) => ({ default: m.UsersPage }))),
  },
  {
    key: 'iam-user-detail',
    path: '/access/users/:id',
    title: 'User access',
    icon: createElement(TeamOutlined),
    permission: 'iam.users.read',
    inMenu: false,
    breadcrumb: ['Access management', 'Users & invitations', 'User access'],
    component: () =>
      lazyPage(() =>
        import('../pages/iam/user-detail-page').then((m) => ({ default: m.UserDetailPage }))
      ),
  },
  {
    key: 'iam-roles',
    path: '/access/roles',
    title: 'Roles',
    icon: createElement(KeyOutlined),
    permission: 'iam.roles.read',
    inMenu: true,
    menuGroup: 'Settings',
    menuTitle: 'Roles and permissions',
    breadcrumb: ['Access management', 'Roles'],
    component: () =>
      lazyPage(() => import('../pages/iam/roles-page').then((m) => ({ default: m.RolesPage }))),
  },
  {
    key: 'iam-role-detail',
    path: '/access/roles/:id',
    title: 'Role',
    icon: createElement(KeyOutlined),
    permission: 'iam.roles.read',
    inMenu: false,
    breadcrumb: ['Access management', 'Roles', 'Role'],
    component: () =>
      lazyPage(() =>
        import('../pages/iam/role-detail-page').then((m) => ({ default: m.RoleDetailPage }))
      ),
  },
  {
    key: 'privacy',
    path: '/privacy',
    title: 'Privacy requests',
    icon: createElement(SafetyCertificateOutlined),
    permission: 'privacy.manage',
    inMenu: true,
    menuGroup: 'Settings',
    menuMode: 'standalone',
    breadcrumb: ['Operations', 'Privacy requests'],
    component: () =>
      lazyPage(() =>
        import('../pages/privacy/privacy-page').then((m) => ({
          default: m.PrivacyPage,
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
    menuGroup: 'Settings',
    menuTitle: 'Audit log',
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
    key: 'notification-recovery',
    path: '/operations/jobs',
    title: 'Automation recovery',
    icon: createElement(ReloadOutlined),
    permission: 'operations.jobs.read',
    inMenu: true,
    menuGroup: 'Settings',
    menuTitle: 'Automated task recovery',
    menuMode: 'standalone',
    breadcrumb: ['Operations', 'Automation recovery'],
    component: () =>
      lazyPage(() =>
        import('../pages/operations/jobs/notification-jobs-page').then((m) => ({
          default: m.NotificationJobsPage,
        }))
      ),
  },
]

export const templateRoutes: TemplateRoute[] = [
  ...commerceRoutes,
  {
    key: 'exception-404',
    path: '*',
    title: '404',
    icon: createElement(ExclamationCircleOutlined),
    permission: 'catalog.read',
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
