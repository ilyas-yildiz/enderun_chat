import { createRoot } from 'react-dom/client';
import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import axios from 'axios';

const WIDGET_ID = 'enderun-chat-widget-container';

const getApiUrl = () => {
    try {
        return (import.meta && import.meta.env && import.meta.env.VITE_APP_URL) ? import.meta.env.VITE_APP_URL : 'http://localhost';
    } catch (e) {
        return 'http://localhost';
    }
};
const API_URL = getApiUrl();

window.Pusher = Pusher;

// --- UTILS ---
function getStorageData() {
    let uuid = localStorage.getItem('chat_visitor_uuid');
    let conversationId = localStorage.getItem('chat_conversation_id');
    
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuid || !uuidRegex.test(uuid)) {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            uuid = crypto.randomUUID();
        } else {
            uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        }
        localStorage.setItem('chat_visitor_uuid', uuid);
        localStorage.removeItem('chat_conversation_id');
        conversationId = null;
    }
    return { uuid, conversationId };
}

function initWidget() {
    if (document.getElementById(WIDGET_ID)) return;
    const widgetRoot = document.createElement('div');
    widgetRoot.id = WIDGET_ID;
    document.body.appendChild(widgetRoot);
    const scriptElement = document.getElementById('enderun-chat-script') || document.querySelector('script[src*="chat.js"]');
    const widgetToken = scriptElement?.getAttribute('data-token');
    const root = createRoot(widgetRoot);
    root.render(<WidgetApp token={widgetToken} />);
}

function WidgetApp({ token }) {
    const [config, setConfig] = useState({
        color: '#4F46E5', 
        title: 'Canlı Destek',
        welcome: 'Merhaba 👋 Size nasıl yardımcı olabilirim?'
    });
    
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([]); 
    const [message, setMessage] = useState(''); // Normal sohbet mesajı
    const [status, setStatus] = useState('Bağlanıyor...');
    
    // DOSYA VE ÖNİZLEME STATE'LERİ (YENİ)
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null); 
    const [caption, setCaption] = useState(''); // Resim altı yazısı
    const fileInputRef = useRef(null);
    
    // SCROLL REF
    const messagesContainerRef = useRef(null);
    
    const storageData = useRef(getStorageData());
    const visitorUUID = storageData.current.uuid;
    const [conversationId, setConversationId] = useState(storageData.current.conversationId);
    
    const [isAgentTyping, setIsAgentTyping] = useState(false);
    const typingTimeoutRef = useRef(null);
    const lastTypingSentTime = useRef(0);

    // --- SCROLL FONKSİYONU ---
    const scrollToBottom = () => {
        if (messagesContainerRef.current) {
            messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        }
    };

    useLayoutEffect(() => {
        if (isOpen) {
            scrollToBottom();
            setTimeout(scrollToBottom, 100);
        }
    }, [messages, isOpen, isAgentTyping]);

    // --- 1. CONFIG YÜKLEME ---
    useEffect(() => {
        axios.get(`${API_URL}/api/chat/config?widget_token=${token}`)
            .then(res => {
                setConfig(res.data);
                setMessages(prev => {
                    if (prev.length === 0) {
                        return [{ id: 1, text: res.data.welcome, sender: 'agent', type: 'text' }];
                    }
                    return prev;
                });
            })
            .catch(err => console.error("Widget Config Error:", err));
    }, [token]);

    // --- 2. REVERB BAĞLANTISI ---
    useEffect(() => {
        const getEnv = (key, def) => {
            try {
                return (import.meta && import.meta.env && import.meta.env[key]) ? import.meta.env[key] : def;
            } catch (e) {
                return def;
            }
        };

        const reverbKey = getEnv('VITE_REVERB_APP_KEY', '');
        const reverbHost = getEnv('VITE_REVERB_HOST', 'localhost');
        const reverbPort = getEnv('VITE_REVERB_PORT', 80);
        const reverbScheme = getEnv('VITE_REVERB_SCHEME', 'http');

        const echo = new Echo({
            broadcaster: 'reverb',
            key: reverbKey,
            wsHost: reverbHost,
            wsPort: reverbPort ?? 80,
            wssPort: reverbPort ?? 443,
            forceTLS: (reverbScheme === 'https'),
            enabledTransports: ['ws', 'wss'],
        });

        echo.connector.pusher.connection.bind('connected', () => setStatus('Çevrimiçi 🟢'));
        echo.connector.pusher.connection.bind('disconnected', () => setStatus('Bağlantı Koptu 🔴'));

        if (conversationId) {
            echo.channel(`chat.${conversationId}`)
                .listen('.message.sent', (e) => {
                    setIsAgentTyping(false);
                    if (e.sender_type !== 'App\\Models\\Visitor') {
                        setMessages(prev => [...prev, { 
                            id: e.id, 
                            text: e.body, 
                            sender: 'agent',
                            type: e.type || 'text',
                            attachment_url: e.attachment_url
                        }]);
                    }
                })
                .listen('.client.typing', (e) => {
                    if (e.senderType === 'user') {
                        setIsAgentTyping(true);
                        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                        typingTimeoutRef.current = setTimeout(() => setIsAgentTyping(false), 3000);
                    }
                });
        }
        return () => echo.disconnect();
    }, [conversationId]);

    // --- HANDLERS ---
    const handleInputChange = (e) => {
        setMessage(e.target.value);
        if (!conversationId) return;
        const now = Date.now();
        if (now - lastTypingSentTime.current > 2000) {
            lastTypingSentTime.current = now;
            axios.post(`${API_URL}/api/chat/typing`, { widget_token: token, conversation_id: conversationId }).catch(()=>{});
        }
    };

    // DOSYA SEÇME ve ÖNİZLEME MODUNA GEÇİŞ
    const handleFileSelect = (e) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file)); 
            setCaption(''); // Caption sıfırla
        }
    };

    // İPTAL ETME
    const cancelUpload = () => {
        setSelectedFile(null);
        setPreviewUrl(null);
        setCaption('');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const toggle = () => setIsOpen(!isOpen);

    // GÖNDERME İŞLEMİ
    const send = async (e) => {
        if (e) e.preventDefault();
        
        // Gönderilecek metin: Eğer dosya varsa caption'ı kullan, yoksa normal mesajı
        const textToSend = selectedFile ? caption : message;
        
        // Boş kontrolü (Dosya yoksa ve metin boşsa gönderme)
        if (!textToSend.trim() && !selectedFile) return;
        
        const tempId = Date.now();
        const msgType = selectedFile ? (selectedFile.type.startsWith('image/') ? 'image' : 'file') : 'text';
        
        // Optimistic UI
        setMessages(prev => [...prev, { 
            id: tempId, 
            text: textToSend, 
            sender: 'visitor',
            type: msgType, 
            // Eğer dosya varsa geçici previewUrl kullan, yoksa null
            attachment_url: selectedFile ? previewUrl : null 
        }]);

        // Referansları al
        const fileToSend = selectedFile;
        
        // State Temizle
        setMessage('');
        setSelectedFile(null);
        setPreviewUrl(null);
        setCaption('');
        if (fileInputRef.current) fileInputRef.current.value = '';

        try {
            const formData = new FormData();
            formData.append('widget_token', token);
            formData.append('visitor_uuid', visitorUUID);
            // DİKKAT: Boş string olsa bile gönderiyoruz ki backend 'message' keyini bulsun
            formData.append('message', textToSend || ""); 
            formData.append('current_url', window.location.href);
            
            if (fileToSend) {
                formData.append('attachment', fileToSend);
            }

            const response = await axios.post(`${API_URL}/api/chat/send`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            if (response.data.message && response.data.message.conversation_id) {
                const newConvId = response.data.message.conversation_id;
                if (conversationId != newConvId) {
                    setConversationId(newConvId);
                    localStorage.setItem('chat_conversation_id', newConvId);
                }
            }
        } catch (error) {
            console.error("Mesaj gönderilemedi ❌", error);
            alert("Mesaj gönderilemedi!");
        }
    };

    const markMessagesAsRead = () => {
        if (!conversationId) return;
        axios.post(`${API_URL}/api/chat/read`, { widget_token: token, conversation_id: conversationId }).catch(()=>{});
    };

    useEffect(() => {
        if (isOpen && messages.length > 0) {
            const lastMessage = messages[messages.length - 1];
            if (lastMessage.sender === 'agent') {
                markMessagesAsRead();
            }
        }
    }, [isOpen, messages]);

    // --- STYLES (Dynamic) ---
    const styles = {
        container: { position: 'fixed', bottom: '20px', right: '20px', zIndex: 2147483647, fontFamily: 'sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' },
        button: { backgroundColor: config.color, color: 'white', border: 'none', borderRadius: '50%', width: '60px', height: '60px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px' },
        chatWindow: { width: '350px', height: '500px', backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 5px 20px rgba(0,0,0,0.2)', marginBottom: '16px', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid #e5e7eb', position: 'relative' },
        header: { background: config.color, color: 'white', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
        messagesArea: { flex: 1, backgroundColor: '#f9fafb', padding: '16px', overflowY: 'auto' },
        footer: { padding: '12px', borderTop: '1px solid #f3f4f6', display: 'flex', gap: '8px', alignItems: 'center' },
        input: { flex: 1, padding: '10px', borderRadius: '20px', border: '1px solid #ddd' },
        fileButton: { cursor: 'pointer', color: '#6b7280', padding: '5px', background: 'none', border: 'none' },
        
        // --- ÖNİZLEME MODU STİLLERİ (YENİ) ---
        previewOverlay: {
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 50,
            display: 'flex', flexDirection: 'column'
        },
        previewHeader: { padding: '15px', display: 'flex', justifyContent: 'flex-end' },
        previewClose: { color: 'white', fontSize: '24px', background: 'none', border: 'none', cursor: 'pointer' },
        previewBody: { flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', overflow:'hidden' },
        previewImg: { maxWidth: '100%', maxHeight: '100%', borderRadius: '8px', objectFit: 'contain' },
        previewFileIcon: { fontSize: '50px', textAlign: 'center', color: 'white' },
        previewFooter: { padding: '15px', display: 'flex', gap: '10px', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
        captionInput: { flex: 1, padding: '12px', borderRadius: '25px', border: 'none', outline: 'none', backgroundColor: 'white' },
        sendButton: { backgroundColor: config.color, color: 'white', border: 'none', borderRadius: '50%', width: '45px', height: '45px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }
    };

    return (
        <div style={styles.container}>
            {isOpen && (
                <div style={styles.chatWindow}>
                    
                    {/* --- ÖNİZLEME KATMANI (WhatsApp Tarzı) --- */}
                    {selectedFile && previewUrl ? (
                        <div style={styles.previewOverlay}>
                            <div style={styles.previewHeader}>
                                <button onClick={cancelUpload} style={styles.previewClose}>✕</button>
                            </div>
                            <div style={styles.previewBody}>
                                {selectedFile.type.startsWith('image/') ? (
                                    <img src={previewUrl} style={styles.previewImg} />
                                ) : (
                                    <div style={styles.previewFileIcon}>
                                        📄 <div style={{fontSize:'14px', marginTop:'5px'}}>{selectedFile.name}</div>
                                    </div>
                                )}
                            </div>
                            <div style={styles.previewFooter}>
                                <input 
                                    value={caption} 
                                    onChange={(e) => setCaption(e.target.value)} 
                                    style={styles.captionInput} 
                                    placeholder="Açıklama ekle..." 
                                    onKeyDown={(e) => e.key === 'Enter' && send(e)}
                                    autoFocus
                                />
                                <button onClick={send} style={styles.sendButton}>➤</button>
                            </div>
                        </div>
                    ) : (
                        // --- NORMAL SOHBET ---
                        <>
                            <div style={styles.header}>
                                <div>
                                    <div style={{ fontWeight: 'bold' }}>{config.title}</div>
                                    <div style={{ fontSize: '12px', opacity: 0.8 }}>{status}</div>
                                </div>
                                <button onClick={toggle} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>✕</button>
                            </div>
                            
                            <div style={styles.messagesArea} ref={messagesContainerRef}>
                                {messages.map(m => (
                                    <div key={m.id} style={{ textAlign: m.sender === 'visitor' ? 'right' : 'left', margin: '5px 0' }}>
                                        <div style={{ display: 'inline-block', maxWidth: '80%' }}>
                                            {/* Resim Varsa */}
                                            {(m.type === 'image' || (m.attachment_url && m.attachment_url.match(/\.(jpeg|jpg|gif|png)$/i))) ? (
                                                <img 
                                                    src={m.attachment_url} 
                                                    alt="attachment" 
                                                    onLoad={scrollToBottom}
                                                    style={{ borderRadius: '8px', maxWidth: '100%', marginBottom: m.text ? '5px' : '0', border: '1px solid #eee' }} 
                                                />
                                            ) : m.attachment_url ? (
                                                <a href={m.attachment_url} target="_blank" style={{display:'block', marginBottom:'5px', color: config.color}}>📎 Dosya İndir</a>
                                            ) : null}

                                            {/* Metin Varsa */}
                                            {m.text && (
                                                <span style={{ 
                                                    background: m.sender === 'visitor' ? config.color : 'white', 
                                                    color: m.sender === 'visitor' ? 'white' : 'black', 
                                                    padding: '8px', borderRadius: '8px', display: 'inline-block', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' 
                                                }}>
                                                    {m.text}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                
                                {isAgentTyping && (
                                    <div style={{textAlign: 'left', margin: '5px 0'}}>
                                        <span style={{background: '#f3f4f6', color: '#6b7280', padding:'8px', borderRadius:'8px', display:'inline-block', fontSize:'12px', fontStyle:'italic'}}>
                                            Yazıyor...
                                        </span>
                                    </div>
                                )}
                            </div>

                            <form style={styles.footer} onSubmit={send}>
                                <input 
                                    type="file" 
                                    ref={fileInputRef} 
                                    style={{ display: 'none' }} 
                                    onChange={handleFileSelect} 
                                    accept="image/*,.pdf,.doc,.docx" 
                                />
                                
                                <button 
                                    type="button" 
                                    style={styles.fileButton} 
                                    onClick={() => fileInputRef.current.click()}
                                    title="Dosya Ekle"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                                </button>

                                <input value={message} onChange={handleInputChange} style={styles.input} placeholder="Mesaj..." />
                            </form>
                        </>
                    )}
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