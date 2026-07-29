export type Role = 'admin' | 'editor' | 'viewer'

export const roleLabels: Record<Role, string> = {
  admin: 'Admin',
  editor: 'Editor',
  viewer: 'Viewer',
}
