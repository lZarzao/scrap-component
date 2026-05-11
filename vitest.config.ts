import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // Environment
    environment: 'node',

    // Globals (optional, allows using describe/it without imports)
    globals: true,

    // TypeScript configuration for tests
    typecheck: {
      tsconfig: './tsconfig.test.json',
    },

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/**',
        'dist/**',
        '**/*.config.ts',
        '**/*.d.ts',
        'src/db/migrations/**', // Exclude migrations from coverage
        'src/index.ts', // Entry point (hard to test in isolation)
      ],
      // Coverage thresholds
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
    },

    // Test file patterns
    include: ['tests/**/*.test.ts', 'tests/**/*.spec.ts'],

    // Timeout configuration
    testTimeout: 10000, // 10 seconds
    hookTimeout: 10000,

    // Reporters
    reporters: ['verbose'],

    // Setup files (if needed)
    // setupFiles: ['./tests/setup.ts'],
  },

  // Path aliases resolution (must match tsconfig paths)
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
