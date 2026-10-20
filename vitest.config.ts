import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    globalSetup: ['./__tests__/global-setup.ts'],
    env: { DATABASE_URL: 'file:./test.db' },
    fileParallelism: false,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
});
