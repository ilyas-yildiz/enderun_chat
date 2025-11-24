import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [
        laravel({
            input: [
                'resources/js/app.jsx',
                'resources/js/widget.jsx' // Ayrı giriş noktası
            ],
            refresh: true,
        }),
        react(),
    ],
    build: {
        rollupOptions: {
            output: {
                entryFileNames: (assetInfo) => {
                    if (assetInfo.name === 'widget') {
                        return 'assets/chat.js'; // Sabit isim
                    }
                    return 'assets/[name]-[hash].js';
                },
            },
        },
    },
});