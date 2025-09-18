import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // FIX: Set alias '@' to resolve to the project's `src` directory.
      // This aligns with standard project structures and resolves module loading errors.
      '@': path.resolve(process.cwd(), 'src'),
    },
  },
})