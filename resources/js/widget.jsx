import { createRoot } from 'react-dom/client';
import { useState, useEffect, useRef } from 'react';
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

// --- CONFIG ---
const WIDGET_ID = 'enderun-chat-widget-container';

// Echo için Pusher'ı window'a ata (Laravel Echo buna ihtiyaç duyar)
window.Pusher = Pusher;

// --- STYLES (Inline) ---
const styles = {
    container: { position: 'fixed', bottom: '20px', right: '20px', zIndex: 2147483647, fontFamily: 'sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' },
    button: { backgroundColor: '#4F46E5', color: 'white', border: 'none', borderRadius: '50%', width: '60px', height: '60px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px' },
    chatWindow: { width: '350px', height: '500px', backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 5px 20px rgba(0,0,0,0.2)', marginBottom: '16px', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid #e5e7eb' },
    header: { background: '#4F46E5', color: 'white', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    messagesArea: { flex: 1, backgroundColor: '#f9fafb', padding: '16px', overflowY: 'auto' },
    footer: { padding: '12px', borderTop: '1px solid #f3f4f6', display: 'flex', gap: '8px' },
    input: { flex: 1, padding: '10px', borderRadius: '20px', border: '1px solid #ddd' }
};

function initWidget() {
    if (document.getElementById(WIDGET_ID)) return;

    const widgetRoot = document.createElement('div');
    widgetRoot.id = WIDGET_ID;
    document.body.appendChild(widgetRoot);

    const scriptElement = document.getElementById('enderun-chat-script')
        || document.querySelector('script[src*="chat.js"]');
    const widgetToken = scriptElement?.getAttribute('data-token');

    const root = createRoot(widgetRoot);
    root.render(<WidgetApp token={widgetToken} />);
}

function WidgetApp({ token }) {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([{ id: 1, text: 'Merhaba 👋 Size nasıl yardımcı olabilirim?', sender: 'agent' }]);
    const [message, setMessage] = useState('');
    const [status, setStatus] = useState('Bağlanıyor...'); // Bağlantı durumu testi

    // --- REVERB CONNECTION ---
    useEffect(() => {
        // Echo Instance oluştur
        const echo = new Echo({
            broadcaster: 'reverb',
            key: import.meta.env.VITE_REVERB_APP_KEY,
            wsHost: import.meta.env.VITE_REVERB_HOST,
            wsPort: import.meta.env.VITE_REVERB_PORT ?? 80,
            wssPort: import.meta.env.VITE_REVERB_PORT ?? 443,
            forceTLS: (import.meta.env.VITE_REVERB_SCHEME ?? 'https') === 'https',
            enabledTransports: ['ws', 'wss'],
        });

        // Bağlantı durumunu dinle (Test amaçlı)
        echo.connector.pusher.connection.bind('connected', () => {
            console.log('✅ Reverb Connected!');
            setStatus('Çevrimiçi 🟢');
        });

        echo.connector.pusher.connection.bind('disconnected', () => {
            console.log('❌ Reverb Disconnected');
            setStatus('Bağlantı Koptu 🔴');
        });

        // Cleanup
        return () => {
            echo.disconnect();
        };
    }, []);

    const toggle = () => setIsOpen(!isOpen);

    const send = (e) => {
        e.preventDefault();
        if (!message.trim()) return;

        // Şimdilik sadece local ekliyoruz
        setMessages(prev => [...prev, { id: Date.now(), text: message, sender: 'visitor' }]);
        setMessage('');
    };

    return (
        <div style={styles.container}>
            {isOpen && (
                <div style={styles.chatWindow}>
                    <div style={styles.header}>
                        <div>
                            <div style={{ fontWeight: 'bold' }}>Canlı Destek</div>
                            <div style={{ fontSize: '12px', opacity: 0.8 }}>{status}</div>
                        </div>
                        <button onClick={toggle} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>✕</button>
                    </div>
                    <div style={styles.messagesArea}>
                        {messages.map(m => (
                            <div key={m.id} style={{ textAlign: m.sender === 'visitor' ? 'right' : 'left', margin: '5px 0' }}>
                                <span style={{ background: m.sender === 'visitor' ? '#4F46E5' : 'white', color: m.sender === 'visitor' ? 'white' : 'black', padding: '8px', borderRadius: '8px', display: 'inline-block', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>{m.text}</span>
                            </div>
                        ))}
                    </div>
                    <form style={styles.footer} onSubmit={send}>
                        <input value={message} onChange={e => setMessage(e.target.value)} style={styles.input} placeholder="Mesaj..." />
                    </form>
                </div>
            )}
            <button style={styles.button} onClick={toggle}>{isOpen ? '✕' : '💬'}</button>
        </div>
    );
}

if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initWidget();
} else {
    window.addEventListener('DOMContentLoaded', initWidget);
}