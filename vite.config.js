import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    // functions/ has its own vitest run; rules tests skip themselves without the emulator
    include: ['src/**/*.test.{js,jsx}', 'test/**/*.test.js'],
  },
});
