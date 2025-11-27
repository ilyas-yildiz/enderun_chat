import axios from 'axios';

// DİKKAT: Buraya bilgisayarının yerel IP adresini yazmalısın.
// Localhost mobilde çalışmaz!
// Örnek: 'http://192.168.1.35'
const LOCAL_IP = 'http://192.168.1.X'; // <--- BURAYI KENDİ IP ADRESİNLE DEĞİŞTİR

const API_URL = `${LOCAL_IP}/api`;

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    },
});

// Reverb (Socket) için de host bilgisi lazım olacak, onu da dışarı açalım
export const REVERB_CONFIG = {
    broadcaster: 'reverb',
    key: '2nvnuk73vfnw7qv9kqvj', // .env dosyasındaki VITE_REVERB_APP_KEY ile aynı olmalı
    wsHost: '192.168.1.X', // <--- BURAYI KENDİ IP ADRESİNLE DEĞİŞTİR (http:// olmadan)
    wsPort: 8080,
    wssPort: 443,
    forceTLS: false,
    enabledTransports: ['ws', 'wss'],
};

export default api;