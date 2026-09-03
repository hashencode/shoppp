import { RouterProvider } from 'react-router-dom'
import { AdminUiProvider } from './admin-ui-provider'
import { router } from './router'

export const AppRouter = () => (
  <AdminUiProvider>
    <RouterProvider router={router} />
  </AdminUiProvider>
)
