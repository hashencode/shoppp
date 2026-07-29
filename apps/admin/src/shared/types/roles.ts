export type Role =
  | 'admin'
  | 'catalog_manager'
  | 'operations'
  | 'support'
  | 'analyst'
  | 'editor'
  | 'viewer'

export const roleLabels: Record<Role, string> = {
  admin: 'Admin',
  catalog_manager: 'Catalog manager',
  operations: 'Operations',
  support: 'Support',
  analyst: 'Analyst',
  editor: 'Editor',
  viewer: 'Viewer',
}
