import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const useProxy = env.VITE_USE_PROXY === '1'
  const isPages = process.env.GITHUB_PAGES === 'true'

  return {
    plugins: [react()],
    base: isPages ? '/work-in-hour/' : '/',
    server: useProxy
      ? {
          proxy: {
            // holiday.cyi.me
            '/cn-holiday': {
              target: 'https://holiday.cyi.me',
              changeOrigin: true,
              secure: true,
              rewrite: (p) => p.replace(/^\/cn-holiday/, ''),
            },
          },
        }
      : undefined,
  }
})
