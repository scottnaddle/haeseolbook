import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico'],
      manifest: {
        name: '해설북 독립형',
        short_name: '해설북',
        description: '기출 원문 + 해설영상 + 필기 이북 (오프라인 전용)',
        theme_color: '#3b82f6',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024
      }
    })
  ],
  resolve: {
    alias: {
      '@hsb/shared': path.resolve(__dirname, '../../packages/shared/dist/index.js')
    }
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
    commonjsOptions: {
      include: [/packages\/shared/, /node_modules/]
    }
  },
  optimizeDeps: {
    include: ['@hsb/shared']
  }
});
