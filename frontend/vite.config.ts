import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    allowedHosts: ['leafmind.local'],
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
