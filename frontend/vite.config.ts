import path from 'node:path'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const pkg = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf-8'),
) as { version: string }

// Real build-time facts for the Settings page's Developer/About sections.
// The commit hash is null (and the row hidden) when git isn't available,
// rather than showing a made-up value.
function gitCommit(): string | null {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return null
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
    __GIT_COMMIT__: JSON.stringify(gitCommit()),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    allowedHosts: ['leafmind.local', '.trycloudflare.com', '.ngrok-free.app', '.ngrok-free.dev'],
    proxy: {
      '/api': {
        target: 'http://backend:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    rolldownOptions: {
      output: {
        // Route pages are already code-split via React.lazy (see
        // routes/router.tsx). This further separates large,
        // infrequently-changing vendor code from app code so browsers
        // can cache it independently across deploys.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (/react-router-dom|\/react\/|\/react-dom\//.test(id)) {
            return 'vendor-react'
          }
          if (/@tanstack[\\/]react-query|\/axios\//.test(id)) {
            return 'vendor-query'
          }
          if (/\/radix-ui\//.test(id)) return 'vendor-radix'
          if (/react-hook-form|@hookform|\/zod\//.test(id)) {
            return 'vendor-forms'
          }
          if (
            /react-markdown|\/unified\/|\/remark|\/rehype|\/mdast|\/micromark/.test(
              id,
            )
          ) {
            return 'vendor-markdown'
          }
          return undefined
        },
      },
    },
  },
})
