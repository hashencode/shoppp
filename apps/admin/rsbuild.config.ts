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

  if (command === 'dev' && !apiProxyTarget) {
    console.warn('[rsbuild] API_PROXY_TARGET is not set, skip /api proxy in dev server.')
  }

  return {
    plugins: [pluginReact()],
    source: {
      entry: {
        index: './src/main.tsx',
      },
      define: {
        __ENABLE_TEMPLATE_ROUTES__: command === 'dev',
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
              secure: false,
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
