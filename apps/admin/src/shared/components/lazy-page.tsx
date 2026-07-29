import { Spin } from 'antd'
import { lazy, Suspense, type ComponentType, type ReactNode } from 'react'

type LazyLoader = () => Promise<{ default: ComponentType }>

export const lazyPage = (loader: LazyLoader): ReactNode => {
  const LazyComponent = lazy(loader)

  return (
    <Suspense
      fallback={
        <div className="flex min-h-[240px] items-center justify-center">
          <Spin size="large" />
        </div>
      }
    >
      <LazyComponent />
    </Suspense>
  )
}
