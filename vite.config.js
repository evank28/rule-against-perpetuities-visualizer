import { defineConfig } from 'vite';

export default defineConfig({
  base: '/rule-against-perpetuities-visualizer/',
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.js'],
  },
});
