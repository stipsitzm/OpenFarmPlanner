import { defineConfig } from '@stryker-mutator/core';

export default defineConfig({
  // Test Runner
  testRunner: 'vitest',
  
  // Source files to mutate
  mutate: [
    'src/**/*.ts',
    'src/**/*.tsx',
    '!src/**/*.test.ts',
    '!src/**/*.test.tsx',
    '!src/**/__tests__/**',
    '!src/main.tsx',
    '!src/vite-env.d.ts',
  ],
  
  // Test files
  testPathPatterns: [
    'src/**/__tests__/**/*.test.ts',
    'src/**/__tests__/**/*.test.tsx',
  ],
  
  // Coverage thresholds for mutation score
  thresholds: {
    high: 80,    // Green: mutation score >= 80%
    medium: 60,  // Yellow: mutation score >= 60%
    low: 40,     // Orange: mutation score >= 40%
  },
  
  // Vitest configuration
  vitest: {
    configFile: 'vitest.config.ts',
  },
  
  // Plugins
  plugins: [
    '@stryker-mutator/typescript-checker',
    '@stryker-mutator/vitest-runner',
  ],
  
  // Report options
  reporters: ['progress', 'html'],
  htmlReporter: {
    baseDir: 'mutation-report',
  },
  
  // Timeout for mutants
  timeoutMS: 5000,
  maxTestRunnerReuse: 1,
  
  // Concurrency
  concurrency: 4,
  
  // Disable type checks for speed (optional)
  disableBail: true,
});
