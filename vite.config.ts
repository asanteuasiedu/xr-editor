import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      tslib: new URL('./src/lib/tslibRuntime.ts', import.meta.url).pathname
    }
  }
});
