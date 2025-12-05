import axios from 'axios';

// BİLGİSAYARININ YEREL IP ADRESİ
const LOCAL_IP = '192.168.0.2';

// HTTP Bağlantısı (API)
const PUBLIC_URL = `http://${LOCAL_IP}`;
const API_URL = `${PUBLIC_URL}/api`;

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    },
});

export const REVERB_CONFIG = {
    broadcaster: 'reverb',
    key: '2nvnuk73vfnw7qv9kqvj',
    cluster: 'mt1',

    // WebSocket Bağlantısı (Reverb)
    wsHost: LOCAL_IP,
    wsPort: 8080, // Reverb Portu
    wssPort: 8080,
    forceTLS: false, // Yerel ağda şifreleme yok (http/ws)
    enabledTransports: ['ws', 'wss'],
};

export default api;