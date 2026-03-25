import { defineConfig } from 'vite';

export default defineConfig({
  base: '/rule-against-perpetuities-visualized/',
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.js'],
  },
});
