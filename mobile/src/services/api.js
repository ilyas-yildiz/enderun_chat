import axios from 'axios';

// Ngrok'tan aldığın adresi buraya yapıştır (sonunda /api OLMASIN, aşağıda ekliyoruz)
const PUBLIC_URL = 'https://preponderant-clustered-amber.ngrok-free.dev'; // DİKKAT: Ekran görüntüsündeki .dev uzantısı veya kopyaladığın tam adres neyse onu yaz.
//Senin durumunda: 'https://preponderant-clustered-amber.ngrok-free.dev'

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
    // Reverb için şimdilik tünel adresinin "host" kısmını (https:// olmadan) yazalım.
    // Eğer çalışmazsa tekrar IP'ye döneriz ama önce Login'i halledelim.
    wsHost: 'preponderant-clustered-amber.ngrok-free.dev',
    wsPort: 443, // Ngrok https üzerinden 443 kullanır
    wssPort: 443,
    forceTLS: true, // Https olduğu için true
    enabledTransports: ['ws', 'wss'],
};

export default api;