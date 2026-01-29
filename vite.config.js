import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
    plugins: [react(), tailwindcss()],
    build: {
        sourcemap: false // Disable source maps in production to prevent code leakage
    },
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: './src/test/setup.js'
    }
})
