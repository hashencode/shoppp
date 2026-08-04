import { defineConfig, loadEnv } from '@rsbuild/core'
import { pluginReact } from '@rsbuild/plugin-react'
import { shouldForwardAccessAssertion } from './authenticated-dev-policy'
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
  const tunnelHostname = process.env.ADMIN_TUNNEL_HOSTNAME?.trim()

  if (command === 'dev' && envMode !== 'test') {
    throw new Error('Admin development supports only --env-mode test through the authenticated preflight.')
  }
  if (command === 'dev' && (!apiProxyTarget || !tunnelHostname)) {
    throw new Error('Authenticated admin development requires API_PROXY_TARGET and ADMIN_TUNNEL_HOSTNAME.')
  }
  if (command === 'dev') {
    const target = new URL(apiProxyTarget!)
    if (target.protocol !== 'https:' || /production/i.test(target.hostname)) {
      throw new Error('Admin development can proxy only to the HTTPS staging/test API.')
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
              on: {
                proxyReq: (proxyRequest, request) => {
                  if (!shouldForwardAccessAssertion(request.headers.host, tunnelHostname!)) {
                    proxyRequest.removeHeader('Cf-Access-Jwt-Assertion')
                  }
                },
              },
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
