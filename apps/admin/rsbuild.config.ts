import { defineConfig, loadEnv } from '@rsbuild/core'
import { pluginReact } from '@rsbuild/plugin-react'
import { normalizeAppBasePath } from './src/shared/utils/normalize-app-base-path'

const readPublicEnvValue = (publicVars: Record<string, string>, name: string) => {
  const value = publicVars[`import.meta.env.${name}`]
  if (!value) return process.env[name]?.trim()

  try {
    const parsed = JSON.parse(value) as unknown
    return typeof parsed === 'string' ? parsed.trim() : undefined
  } catch {
    return value.replace(/^"|"$/g, '').trim()
  }
}

export default defineConfig(({ command, envMode }) => {
  const { publicVars } = loadEnv({ mode: envMode, prefixes: ['PUBLIC_'] })
  const appBasePath = normalizeAppBasePath(readPublicEnvValue(publicVars, 'PUBLIC_APP_BASE'))
  const apiProxyTarget = process.env.API_PROXY_TARGET?.trim()

  if (command === 'dev' && envMode !== 'development' && envMode !== 'test') {
    throw new Error('Admin development supports only the local development or staging test modes.')
  }
  if (command === 'dev' && !apiProxyTarget) {
    throw new Error('Admin development requires API_PROXY_TARGET.')
  }
  if (command === 'dev') {
    const target = new URL(apiProxyTarget!)
    const localTarget =
      envMode === 'development' &&
      target.protocol === 'http:' &&
      (target.hostname === '127.0.0.1' || target.hostname === 'localhost')
    const stagingTarget =
      envMode === 'test' &&
      target.protocol === 'https:' &&
      !/production/i.test(target.hostname) &&
      /(?:staging|test)/i.test(target.hostname)
    if (!localTarget && !stagingTarget) {
      throw new Error('Admin development proxy does not match the selected local or staging mode.')
    }
  }

  return {
    plugins: [pluginReact()],
    source: {
      entry: {
        index: './src/main.tsx',
      },
    },
    html: {
      template: './index.html',
    },
    resolve: {
      alias: {
        '@': './src',
      },
    },
    output: {
      legalComments: 'none',
      assetPrefix: `${appBasePath}/`,
    },
    server: apiProxyTarget
      ? {
          proxy: {
            '/api': {
              target: apiProxyTarget,
              changeOrigin: true,
              secure: true,
              pathRewrite: { '^/api': '' },
            },
          },
        }
      : undefined,
    splitChunks: {
      preset: 'none',
      chunks: 'all',
      minSize: 20000,
      maxSize: 550000,
      minChunks: 2,
      maxAsyncRequests: 20,
      maxInitialRequests: 30,
      cacheGroups: {
        react: {
          test: /[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom)[\\/]/,
          name: 'react',
          chunks: 'all',
          priority: 30,
          enforce: true,
        },
        antd: {
          test: /[\\/]node_modules[\\/](antd|@ant-design|rc-.*)[\\/]/,
          name: 'antd',
          chunks: 'all',
          priority: 25,
          enforce: true,
          maxSize: 3_000_000,
        },
        charts: {
          test: /[\\/]node_modules[\\/](echarts|echarts-for-react)[\\/]/,
          name: 'charts',
          chunks: 'all',
          priority: 23,
          enforce: true,
          maxSize: 3_000_000,
        },
        utils: {
          test: /[\\/]node_modules[\\/](dayjs|axios|classnames)[\\/]/,
          name: 'utils',
          chunks: 'all',
          priority: 20,
          enforce: true,
        },
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendor',
          chunks: 'all',
          priority: 10,
        },
        common: {
          minChunks: 2,
          name: 'common',
          chunks: 'all',
          priority: 5,
        },
      },
    },
  }
})
