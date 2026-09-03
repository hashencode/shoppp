import React from 'react'
import { App } from 'antd'
import {
  render as rtlRender,
  renderHook as rtlRenderHook,
  type RenderOptions,
} from '@testing-library/react'

void React

// Match the production feedback owner for isolated component and hook tests.
export const render = (ui: React.ReactNode, options?: RenderOptions) =>
  rtlRender(ui, { wrapper: App, ...options })
export const renderHook: typeof rtlRenderHook = (hook, options) =>
  rtlRenderHook(hook, { wrapper: App, ...options })
