import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [
        laravel({
            input: [
                'resources/js/app.jsx', // Yönetim Paneli
                'resources/js/widget.jsx' // Widget (YENİ)
            ],
            refresh: true,
        }),
        react(),
    ],
    build: {
        rollupOptions: {
            output: {
                // Dosya isimlerini sabitleme kuralı
                entryFileNames: (assetInfo) => {
                    // Eğer giriş dosyası 'widget' ise 'assets/chat.js' olarak çıkar
                    if (assetInfo.name === 'widget') {
                        return 'assets/chat.js';
                    }
                    // Diğerleri standart (hashli) devam etsin
                    return 'assets/[name]-[hash].js';
                },
            },
        },
    },
});