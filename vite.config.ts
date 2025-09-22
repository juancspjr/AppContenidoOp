import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // FIX: Set alias '@' to resolve to the project's root directory.
      // The project does not use a `src` directory, so this aligns with the actual structure.
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
})