import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Capacitor loads assets from the local file bundle (relative paths).
// Vercel / normal web hosting uses absolute paths from site root.
const forCapacitor = process.env.VITE_CAPACITOR === 'true'

export default defineConfig({
  plugins: [react()],
  base: forCapacitor ? './' : '/',
})
