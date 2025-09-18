import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // FIX: Set alias '@' to resolve to the project's `src` directory.
      // This aligns with standard project structures and resolves module loading errors.
      // FIX: Replaced `process.cwd()` with `import.meta.url` to resolve a TypeScript type error and use modern ESM standards.
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})