import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
    plugins: [react()],
    // Required for Capacitor — assets load from the local file bundle.
    base: './',
});
