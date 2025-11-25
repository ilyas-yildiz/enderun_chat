import { createRoot } from 'react-dom/client';
import { useState, useEffect, useRef } from 'react';
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import axios from 'axios';

// --- CONFIG ---
const WIDGET_ID = 'enderun-chat-widget-container';
const API_URL = import.meta.env.VITE_APP_URL || 'http://localhost';

window.Pusher = Pusher;

// --- UTILS ---
function getStorageData() {
    // LocalStorage'dan hem UUID'yi hem de Conversation ID'yi okuyalım
    let uuid = localStorage.getItem('chat_visitor_uuid');
    let conversationId = localStorage.getItem('chat_conversation_id');

    // UUID yoksa oluştur
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuid || !uuidRegex.test(uuid)) {
        if (crypto.randomUUID) {
            uuid = crypto.randomUUID();
        } else {
            uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        }
        localStorage.setItem('chat_visitor_uuid', uuid);
        // Yeni UUID demek yeni kullanıcı demek, eski conversation ID'yi sil
        localStorage.removeItem('chat_conversation_id');
        conversationId = null;
    }

    return { uuid, conversationId };
}

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
    const [status, setStatus] = useState('Bağlanıyor...');

    // UUID ve Conversation ID yönetimi
    const storageData = useRef(getStorageData());
    const visitorUUID = storageData.current.uuid;
    const [conversationId, setConversationId] = useState(storageData.current.conversationId);

    // YAZIYOR İNDİKATÖRÜ STATE'LERİ
    const [isAgentTyping, setIsAgentTyping] = useState(false);
    const typingTimeoutRef = useRef(null); // İndikatörü gizlemek için zamanlayıcı
    const lastTypingSentTime = useRef(0); // API'yi floodlamamak için throttle zamanlayıcısı

    // --- REVERB BAĞLANTISI ---
    useEffect(() => {
        const echo = new Echo({
            broadcaster: 'reverb',
            key: import.meta.env.VITE_REVERB_APP_KEY,
            wsHost: import.meta.env.VITE_REVERB_HOST,
            wsPort: import.meta.env.VITE_REVERB_PORT ?? 80,
            wssPort: import.meta.env.VITE_REVERB_PORT ?? 443,
            forceTLS: (import.meta.env.VITE_REVERB_SCHEME === 'https'),
            enabledTransports: ['ws', 'wss'],
        });

        echo.connector.pusher.connection.bind('connected', () => setStatus('Çevrimiçi 🟢'));
        echo.connector.pusher.connection.bind('disconnected', () => setStatus('Bağlantı Koptu 🔴'));

        // Eğer bir Conversation ID'miz varsa o odayı dinle
        if (conversationId) {
            console.log(`📡 Dinleniyor: chat.${conversationId}`);
            echo.channel(`chat.${conversationId}`)
                .listen('.message.sent', (e) => {
                    console.log("📨 Mesaj Geldi:", e);

                    // Mesaj gelince "Yazıyor"u hemen kaldır
                    setIsAgentTyping(false);

                    // Sadece karşıdan (Agent/Admin) gelen mesajları ekle
                    if (e.sender_type !== 'App\\Models\\Visitor') {
                        setMessages(prev => [...prev, {
                            id: e.id,
                            text: e.body,
                            sender: 'agent'
                        }]);
                    }
                })
                .listen('.client.typing', (e) => {
                    // Eğer yazan 'user' (Admin) ise göster
                    if (e.senderType === 'user') {
                        setIsAgentTyping(true);

                        // 3 saniye sonra otomatik gizle (Admin yazmayı bırakırsa diye)
                        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                        typingTimeoutRef.current = setTimeout(() => {
                            setIsAgentTyping(false);
                        }, 3000);
                    }
                });
        }

        return () => {
            echo.disconnect();
        };
    }, [conversationId]);

    // --- INPUT HANDLER (YAZIYORUM SİNYALİ) ---
    const handleInputChange = (e) => {
        setMessage(e.target.value);

        if (!conversationId) return;

        // Her tuşa basışta API'ye gitme, 2 saniyede bir git (Throttle)
        const now = Date.now();
        if (now - lastTypingSentTime.current > 2000) {
            lastTypingSentTime.current = now;
            axios.post(`${API_URL}/api/chat/typing`, {
                widget_token: token,
                conversation_id: conversationId
            }).catch(err => console.error(err)); // Sessiz hata
        }
    };

    const toggle = () => setIsOpen(!isOpen);

    const send = async (e) => {
        e.preventDefault();
        if (!message.trim()) return;

        const currentMsg = message;
        setMessage('');

        const tempId = Date.now();
        setMessages(prev => [...prev, { id: tempId, text: currentMsg, sender: 'visitor' }]);

        try {
            const response = await axios.post(`${API_URL}/api/chat/send`, {
                widget_token: token,
                visitor_uuid: visitorUUID,
                message: currentMsg
            });

            // Backend'den dönen Conversation ID'yi yakala
            if (response.data.message && response.data.message.conversation_id) {
                const newConvId = response.data.message.conversation_id;

                // Eğer ID yeni ise State'i ve Storage'ı güncelle
                if (conversationId != newConvId) {
                    setConversationId(newConvId);
                    localStorage.setItem('chat_conversation_id', newConvId);
                }
            }
            console.log("Mesaj iletildi ✅");

        } catch (error) {
            console.error("Mesaj gönderilemedi ❌", error);
            if (error.response && error.response.data && error.response.data.errors) {
                alert("Hata: " + JSON.stringify(error.response.data.errors));
            } else {
                alert("Mesaj gönderilemedi!");
            }
        }
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

                        {/* YAZIYOR İNDİKATÖRÜ (SOL ALTTA) */}
                        {isAgentTyping && (
                            <div style={{ textAlign: 'left', margin: '5px 0' }}>
                                <span style={{ background: '#f3f4f6', color: '#6b7280', padding: '8px', borderRadius: '8px', display: 'inline-block', fontSize: '12px', fontStyle: 'italic' }}>
                                    Yazıyor...
                                </span>
                            </div>
                        )}
                    </div>
                    <form style={styles.footer} onSubmit={send}>
                        {/* onChange güncellendi */}
                        <input value={message} onChange={handleInputChange} style={styles.input} placeholder="Mesaj..." />
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