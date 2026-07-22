import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Connect, Plugin } from 'vite'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

/** Server-side OpenAI proxy — keeps OPENAI_API_KEY out of the browser bundle. */
function openaiProxyPlugin(apiKey: string, defaultModel: string): Plugin {
  const mount = (middlewares: Connect.Server) => {
    middlewares.use(async (req, res, next) => {
      const url = req.url?.split('?')[0] ?? ''
      if (!url.startsWith('/api/openai')) return next()

      if (url === '/api/openai/status' && req.method === 'GET') {
        json(res, 200, {
          configured: Boolean(apiKey),
          model: defaultModel,
        })
        return
      }

      if (url === '/api/openai/chat/completions' && req.method === 'POST') {
        if (!apiKey) {
          json(res, 503, { error: { message: 'OPENAI_API_KEY not set in .env' } })
          return
        }
        try {
          const body = await readBody(req)
          const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body,
          })
          const text = await upstream.text()
          res.statusCode = upstream.status
          res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json')
          res.end(text)
        } catch (err) {
          json(res, 502, {
            error: {
              message: err instanceof Error ? err.message : 'OpenAI proxy failed',
            },
          })
        }
        return
      }

      json(res, 404, { error: { message: 'Not found' } })
    })
  }

  return {
    name: 'openai-proxy',
    configureServer(server) {
      mount(server.middlewares)
    },
    configurePreviewServer(server) {
      mount(server.middlewares)
    },
  }
}

function json(res: ServerResponse, status: number, payload: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(payload))
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const ollamaTarget = env.OLLAMA_URL || 'http://127.0.0.1:11434'
  const openaiKey = env.OPENAI_API_KEY?.trim() || ''
  const openaiModel = env.OPENAI_MODEL?.trim() || env.VITE_OPENAI_MODEL?.trim() || 'gpt-4o-mini'

  return {
    plugins: [
      react(),
      openaiProxyPlugin(openaiKey, openaiModel),
      VitePWA({
        registerType: 'prompt',
        includeAssets: [
          'favicon.ico',
          'favicon-32x32.png',
          'apple-touch-icon.png',
        ],
        manifest: {
          name: 'Thinker',
          short_name: 'Thinker',
          description:
            'Microlearning for builders — ideas on AI, sports, history, politics, and finance. Replace doomscrolling.',
          theme_color: '#1a2332',
          background_color: '#1a2332',
          display: 'standalone',
          orientation: 'portrait-primary',
          start_url: '/',
          scope: '/',
          categories: ['education', 'lifestyle'],
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
            },
            {
              src: 'pwa-192x192-maskable.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'maskable',
            },
            {
              src: 'pwa-512x512-maskable.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          navigateFallback: '/index.html',
          runtimeCaching: [
            {
              // Never cache LLM calls
              urlPattern: ({ url }) =>
                url.pathname.startsWith('/api/ollama') ||
                url.pathname.startsWith('/api/openai'),
              handler: 'NetworkOnly',
            },
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
              },
            },
            {
              urlPattern: /^https:\/\/www\.gutenberg\.org\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'gutenberg-cache',
                networkTimeoutSeconds: 8,
                expiration: {
                  maxEntries: 40,
                  maxAgeSeconds: 60 * 60 * 24 * 7,
                },
              },
            },
            {
              urlPattern: /^https:\/\/gutendex\.com\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'gutendex-cache',
                networkTimeoutSeconds: 8,
                expiration: {
                  maxEntries: 40,
                  maxAgeSeconds: 60 * 60 * 24,
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: false,
        },
      }),
    ],
    server: {
      proxy: {
        '/api/ollama': {
          target: ollamaTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/ollama/, ''),
          timeout: 300_000,
          proxyTimeout: 300_000,
        },
      },
    },
  }
})
