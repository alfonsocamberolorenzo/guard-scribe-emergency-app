import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'node:path'
// import componentTagger from '.../componentTagger' // ← importa tu plugin si procede

export default defineConfig(({ mode }) => {
  const base = process.env.VITE_BASE ?? '/'

  return {
    base,
    server: {
      host: '::',
      port: 8080,
    },
    plugins: [
      react(),
      mode === 'development' && componentTagger(), 
    ].filter(Boolean),
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: false, // pon true si necesitas *.map en prod
    },
    preview: {
      host: '::',
      port: 4173,
    },
  }
})
