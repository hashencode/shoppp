import { Navigate, createBrowserRouter } from 'react-router-dom'
import { LoginPage } from '../pages/auth/login-page'
import { ForbiddenPage } from '../pages/forbidden-page'
import { hasPermission } from '../infrastructure/auth/permissions'
import { useAuth } from '../infrastructure/auth/use-auth'
import { PermissionGuard } from '../shared/components/permission-guard'
import { RouteErrorBoundary } from '../shared/components/route-error-boundary'
import { AppShell } from '../shared/layout/app-shell'
import { APP_BASE_PATH } from '../shared/utils/app-base'
import { RedirectIfAuthenticated, RequireAuth } from './auth-route-guards'
import { templateRoutes, type TemplateRoute } from './routes.config'

type RouteIssue = {
  code: 'ROUTE_DUPLICATE_KEY' | 'ROUTE_DUPLICATE_PATH' | 'ROUTE_INVALID'
  message: string
}

const validateTemplateRoutes = (routes: TemplateRoute[]): RouteIssue[] => {
  const issues: RouteIssue[] = []
  const keySet = new Set<string>()
  const pathSet = new Set<string>()

  for (const route of routes) {
    if (!route.key || !route.path || !route.title || !route.permission) {
      issues.push({
        code: 'ROUTE_INVALID',
        message: `Route ${route.key || 'unknown'} has missing required fields`,
      })
      continue
    }

    if (keySet.has(route.key)) {
      issues.push({
        code: 'ROUTE_DUPLICATE_KEY',
        message: `Duplicate route key: ${route.key}`,
      })
    }

    if (pathSet.has(route.path)) {
      issues.push({
        code: 'ROUTE_DUPLICATE_PATH',
        message: `Duplicate route path: ${route.path}`,
      })
    }

    keySet.add(route.key)
    pathSet.add(route.path)
  }

  return issues
}

const toRootChildPath = (path: string) => {
  if (!path.startsWith('/')) {
    return path
  }

  return path.slice(1)
}

const AuthorizedHome = () => {
  const { permissions, role } = useAuth()
  const target = templateRoutes.find(
    (route) => route.inMenu && hasPermission(role, route.permission, permissions)
  )?.path
  return target ? <Navigate to={target} replace /> : <ForbiddenPage />
}

const routeIssues = validateTemplateRoutes(templateRoutes)
const routerOptions = APP_BASE_PATH ? { basename: APP_BASE_PATH } : undefined
const invalidRouter = createBrowserRouter([
  {
    path: '*',
    element: (
      <RouteErrorBoundary
        errorCode={routeIssues[0]?.code ?? 'ROUTE_INVALID'}
        detail={routeIssues.map((issue) => issue.message).join('; ')}
      />
    ),
  },
], routerOptions)

const validRouter = createBrowserRouter([
  {
    path: '/login',
    element: (
      <RedirectIfAuthenticated>
        <LoginPage />
      </RedirectIfAuthenticated>
    ),
  },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppShell routes={templateRoutes} />
      </RequireAuth>
    ),
    children: [
      {
        index: true,
        element: <AuthorizedHome />,
      },
      ...templateRoutes
        .filter(
          (route) => route.path !== '*' && !route.path.startsWith('/dev') && !route.path.startsWith('/template')
        )
        .map((route) => ({
          path: toRootChildPath(route.path),
          element: <PermissionGuard permission={route.permission}>{route.component()}</PermissionGuard>,
        })),
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
], routerOptions)

export const router = routeIssues.length > 0 ? invalidRouter : validRouter
