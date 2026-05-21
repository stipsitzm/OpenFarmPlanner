import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

function normalizeBasePath(input?: string): string {
  const value = input && input.trim().length > 0 ? input.trim() : '/'
  const withLeadingSlash = value.startsWith('/') ? value : `/${value}`

  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`
}

const basePath = normalizeBasePath(process.env.VITE_BASE_PATH)

// https://vite.dev/config/
export default defineConfig({
  base: basePath,
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    watch: {
      ignored: ['**/coverage/**'],
    },
    proxy: {
      '/admin': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/static': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/media': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
    testTimeout: 10000,
    hookTimeout: 10000,
    teardownTimeout: 5000,
    pool: process.env.CI ? 'forks' : 'threads',
    fileParallelism: !process.env.CI,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
    server: {
      deps: {
        inline: ['@mui/x-data-grid', '@mui/material'],
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        'node_modules/**',
        'src/__tests__/**',
        'src/test-utils/**',
        'src/setupTests.ts',
        '**/*.test.{ts,tsx}',
        '**/*.config.{ts,js}',
        '**/types.ts',
      ],
    },
  },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          mui: ['@mui/material', '@mui/icons-material', '@mui/x-data-grid'],
          i18n: ['i18next', 'react-i18next'],
        },
      },
    },
  },
})
