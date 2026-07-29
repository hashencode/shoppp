import { Button, Divider, Popconfirm } from 'antd'
import React, { Fragment } from 'react'
import type { ReactNode } from 'react'
import { withAppBasePath } from '../utils/app-base'

void React

export type ListRowActionSpec = {
  key: string
  label: ReactNode
  danger?: boolean
  disabled?: boolean
  visible?: boolean
  render?: ReactNode
  href?: string
  target?: string
  rel?: string
  confirm?: {
    title: string
    description?: string
    okText?: string
    cancelText?: string
  }
  onClick?: () => void | Promise<void>
}

type ListRowActionsProps = {
  actions: ListRowActionSpec[]
  appBasePath?: string
}

const renderDirectAction = (action: ListRowActionSpec, appBasePath?: string) => {
  if (action.render) {
    return <Fragment key={action.key}>{action.render}</Fragment>
  }

  const button = (
    <Button
      key={action.key}
      type="link"
      danger={action.danger}
      disabled={action.disabled}
      className="!px-0 hover:!bg-transparent active:!bg-transparent"
      href={action.href ? withAppBasePath(action.href, appBasePath) : undefined}
      target={action.target}
      rel={action.rel}
      onClick={
        action.confirm || !action.onClick
          ? undefined
          : () => {
              void action.onClick?.()
            }
      }
    >
      {action.label}
    </Button>
  )

  if (!action.confirm) {
    return button
  }

  return (
    <Popconfirm
      key={action.key}
      title={action.confirm.title}
      description={action.confirm.description}
      okText={action.confirm.okText}
      cancelText={action.confirm.cancelText}
      onConfirm={() => {
        void action.onClick?.()
      }}
    >
      {button}
    </Popconfirm>
  )
}

export const ListRowActions = ({ actions, appBasePath }: ListRowActionsProps) => {
  const visibleActions = actions.filter((action) => action.visible !== false)

  return (
    <div className="inline-flex items-center">
      {visibleActions.map((action, index) => (
        <Fragment key={action.key}>
          {renderDirectAction(action, appBasePath)}
          {index < visibleActions.length - 1 ? <Divider orientation="vertical" /> : null}
        </Fragment>
      ))}
    </div>
  )
}
