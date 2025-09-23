import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5000,
    strictPort: true,
  },
  resolve: {
    alias: {
      // FIX: Set alias '@' to resolve to the project's root directory.
      // The project does not use a `src` directory, so this aligns with the actual structure.
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
})