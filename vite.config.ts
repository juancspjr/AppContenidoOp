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
  define: {
    // Inyectar las API keys como constantes globales
    __GOOGLE_API_KEYS__: JSON.stringify([
      process.env.GOOGLE_API_KEY0,
      process.env.GOOGLE_API_KEY1,
      process.env.GOOGLE_API_KEY2,
      process.env.GOOGLE_API_KEY3,
      process.env.GOOGLE_API_KEY4,
      process.env.GOOGLE_API_KEY5,
      process.env.GOOGLE_API_KEY6
    ].filter(key => key && key.trim() !== ''))
  },
  resolve: {
    alias: {
      // FIX: Set alias '@' to resolve to the project's root directory.
      // The project does not use a `src` directory, so this aligns with the actual structure.
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
})