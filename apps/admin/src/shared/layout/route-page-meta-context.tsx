import React, { createContext, useContext, type PropsWithChildren } from 'react'

void React

export type RouteBreadcrumbItem = {
  title: string
  path?: string
  canNavigate: boolean
}

export type RoutePageMeta = {
  title?: string
  breadcrumbItems: RouteBreadcrumbItem[]
}

const RoutePageMetaContext = createContext<RoutePageMeta | null>(null)

export const RoutePageMetaProvider = ({
  children,
  value,
}: PropsWithChildren<{ value: RoutePageMeta }>) => {
  return <RoutePageMetaContext.Provider value={value}>{children}</RoutePageMetaContext.Provider>
}

export const useRoutePageMeta = () => useContext(RoutePageMetaContext)
