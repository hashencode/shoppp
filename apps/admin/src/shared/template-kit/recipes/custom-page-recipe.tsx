import { Typography } from 'antd'
import React, { type ReactNode } from 'react'
import { PageHeaderWithBack } from '../../components/form-page-header'
import { useRoutePageMeta } from '../../layout/route-page-meta-context'

void React

type CustomPageRecipeProps = {
  children: ReactNode
  title?: ReactNode
  titleHidden?: boolean
  extra?: ReactNode
  onBack?: () => void
  className?: string
}

const joinClassNames = (...classNames: Array<string | undefined>) =>
  classNames.filter(Boolean).join(' ')

const hasRenderableTitle = (title: ReactNode) =>
  title !== undefined && title !== null && title !== false

export const CustomPageRecipe = ({
  children,
  title,
  titleHidden,
  extra,
  onBack,
  className,
}: CustomPageRecipeProps) => {
  const routeMeta = useRoutePageMeta()
  const resolvedTitle = title ?? routeMeta?.title
  const shouldRenderTitle = !titleHidden && hasRenderableTitle(resolvedTitle)
  const shouldRenderHeader = shouldRenderTitle || Boolean(extra)

  return (
    <div className={joinClassNames('space-y-4 pb-20', className)}>
      {shouldRenderHeader ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {shouldRenderTitle ? (
            onBack ? (
              <PageHeaderWithBack title={resolvedTitle} onBack={onBack} />
            ) : (
              <Typography.Title level={4} className="!mb-1">
                {resolvedTitle}
              </Typography.Title>
            )
          ) : (
            <span />
          )}
          {extra ? <div className="flex flex-wrap items-center justify-end gap-2">{extra}</div> : null}
        </div>
      ) : null}
      {children}
    </div>
  )
}
