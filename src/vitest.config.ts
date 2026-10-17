import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      allow: ['..'],
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./setupTests.ts'],
    alias: {
      '@': path.resolve(__dirname, './'),
      'react': path.resolve(__dirname, './node_modules/react'),
      '@testing-library/react': path.resolve(__dirname, './node_modules/@testing-library/react'),
      'next/server': path.resolve(__dirname, './node_modules/next/server.js'),
      'next': path.resolve(__dirname, './node_modules/next'),
    },
    include: ['../tests/**/*.{test,spec}.{ts,tsx}'],
  },
});
