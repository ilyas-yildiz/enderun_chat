import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm, router } from '@inertiajs/react';
import { useState, useEffect, useRef } from 'react';
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import axios from 'axios';

window.Pusher = Pusher;

export default function ChatsIndex({ auth, conversations }) {
    const [chatList, setChatList] = useState(conversations);
    const [selectedChat, setSelectedChat] = useState(null);
    const [localMessages, setLocalMessages] = useState([]);
    const messagesEndRef = useRef(null);

    // YAZIYOR İNDİKATÖRÜ STATE'LERİ
    const [isVisitorTyping, setIsVisitorTyping] = useState(false);
    const typingTimeoutRef = useRef(null);
    const lastTypingSentTime = useRef(0);

    // SES DOSYASI REFERANSI
    const notificationSound = useRef(new Audio('/sounds/notification.mp3'));

    const { data, setData, post, processing, reset } = useForm({
        message: '',
    });

    // --- REVERB 1: GLOBAL (Admin Kanalını Dinle) ---
    useEffect(() => {
        // Admin kendi özel kanalını dinler (auth.user.id)
        const userId = auth.user.id;

        const echo = new Echo({
            broadcaster: 'reverb',
            key: import.meta.env.VITE_REVERB_APP_KEY,
            wsHost: import.meta.env.VITE_REVERB_HOST,
            wsPort: import.meta.env.VITE_REVERB_PORT ?? 80,
            wssPort: import.meta.env.VITE_REVERB_PORT ?? 443,
            forceTLS: (import.meta.env.VITE_REVERB_SCHEME === 'https'),
            enabledTransports: ['ws', 'wss'],
        });

        console.log(`👑 Admin Kanalı Dinleniyor: App.Models.User.${userId}`);

        // Kanal adı Backend'deki ile birebir aynı olmalı
        echo.channel(`App.Models.User.${userId}`)
            .listen('.message.sent', (e) => {
                // ... (İçerik aynı kalacak: Ses çalma ve Liste güncelleme)

                // SES ÇALMA
                if (e.sender_type === 'App\\Models\\Visitor') {
                    try {
                        notificationSound.current.currentTime = 0;
                        notificationSound.current.play().catch(err => console.warn(err));
                    } catch (err) { }
                }

                // LİSTE GÜNCELLEME
                setChatList((prevList) => {
                    const index = prevList.findIndex(c => c.id === e.conversation_id);
                    let updatedList = [...prevList];

                    if (index > -1) {
                        const chat = { ...updatedList[index] };
                        chat.messages = [...(chat.messages || []), e];
                        chat.updated_at = new Date().toISOString();
                        if (e.visitor) chat.visitor = e.visitor;

                        updatedList.splice(index, 1);
                        updatedList.unshift(chat);
                    } else {
                        const newChat = {
                            id: e.conversation_id,
                            visitor: e.visitor,
                            updated_at: new Date().toISOString(),
                            messages: [e]
                        };
                        updatedList.unshift(newChat);
                    }
                    return updatedList;
                });
            });

        return () => echo.leave(`App.Models.User.${userId}`);
    }, [auth.user.id]);

    // --- REVERB 2: LOCAL (SOHBET ODASI) ---
    useEffect(() => {
        if (!selectedChat) return;

        const echo = new Echo({
            broadcaster: 'reverb',
            key: import.meta.env.VITE_REVERB_APP_KEY,
            wsHost: import.meta.env.VITE_REVERB_HOST,
            wsPort: import.meta.env.VITE_REVERB_PORT ?? 80,
            wssPort: import.meta.env.VITE_REVERB_PORT ?? 443,
            forceTLS: (import.meta.env.VITE_REVERB_SCHEME === 'https'),
            enabledTransports: ['ws', 'wss'],
        });

        echo.channel(`chat.${selectedChat.id}`)
            .listen('.message.sent', (e) => {
                setIsVisitorTyping(false);

                setLocalMessages(prev => {
                    // 1. Eğer gelen mesajda temp_id varsa, yerel listede bu temp_id'ye sahip mesajı bul
                    if (e.temp_id) {
                        const match = prev.find(m => m.temp_id === e.temp_id);
                        if (match) {
                            // Eşleşme bulundu! Geçici mesajı sil, Gerçek mesajı yerine koy.
                            return prev.map(m => m.temp_id === e.temp_id ? e : m);
                        }
                    }

                    // 2. Normal ID kontrolü (Çift eklemeyi önle)
                    if (prev.find(m => m.id === e.id)) return prev;

                    // 3. Eşleşme yoksa yeni mesaj olarak ekle
                    return [...prev, e];
                });
            })
            .listen('.client.typing', (e) => {
                if (e.senderType === 'visitor') {
                    setIsVisitorTyping(true);
                    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                    typingTimeoutRef.current = setTimeout(() => setIsVisitorTyping(false), 3000);
                }
            })
            .listen('.messages.read', () => {
                setLocalMessages(prev => prev.map(msg => {
                    if (msg.sender_type !== 'App\\Models\\Visitor') {
                        return { ...msg, is_read: true };
                    }
                    return msg;
                }));
            });

        return () => echo.disconnect();

    }, [selectedChat?.id]);

    useEffect(() => {
        if (selectedChat) {
            setLocalMessages(selectedChat.messages || []);
            setIsVisitorTyping(false);
        }
    }, [selectedChat]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [localMessages]);

    const handleInputChange = (e) => {
        setData('message', e.target.value);
        if (!selectedChat) return;

        const now = Date.now();
        if (now - lastTypingSentTime.current > 2000) {
            lastTypingSentTime.current = now;
            axios.post(route('chats.typing', selectedChat.id)).catch(() => { });
        }
    };

    const handleDeleteChat = (e, chatId) => {
        e.stopPropagation();
        if (confirm('Bu sohbeti silmek istediğinize emin misiniz?')) {
            router.delete(route('chats.destroy', chatId), {
                onSuccess: () => {
                    setChatList(prev => prev.filter(c => c.id !== chatId));
                    if (selectedChat && selectedChat.id === chatId) {
                        setSelectedChat(null);
                        setLocalMessages([]);
                    }
                },
                preserveScroll: true
            });
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!selectedChat || !data.message.trim()) return;

        // Benzersiz geçici ID oluştur
        const tempId = crypto.randomUUID();

        const tempMsg = {
            id: Date.now(), // React key için
            temp_id: tempId, // Eşleştirme için
            body: data.message,
            sender_type: 'App\\Models\\User',
            created_at: new Date().toISOString(),
            is_read: true, // Admin kendi mesajını okumuş sayılır
            conversation_id: selectedChat.id
        };

        setLocalMessages(prev => [...prev, tempMsg]);

        const currentMsg = data.message;
        setData('message', '');

        // İsteği temp_id ile gönder
        axios.post(route('chats.reply', selectedChat.id), {
            message: currentMsg,
            temp_id: tempId // <--- Backend'e bunu yolluyoruz
        }).catch(err => {
            console.error("Mesaj gitmedi", err);
            alert("Mesaj gönderilemedi!");
        });
    };

    return (
        <AuthenticatedLayout
            user={auth.user}
            header={<h2 className="font-semibold text-xl text-gray-800 leading-tight">Canlı Destek</h2>}
        >
            <Head title="Sohbetler" />

            <div className="py-12 h-screen max-h-[calc(100vh-65px)] overflow-hidden">
                <div className="max-w-7xl mx-auto sm:px-6 lg:px-8 h-full">
                    <div className="bg-white overflow-hidden shadow-sm sm:rounded-lg h-full flex border border-gray-200">

                        {/* SOL TARA: SOHBET LİSTESİ */}
                        <div className="w-1/3 border-r border-gray-200 bg-gray-50 flex flex-col">
                            <div className="p-4 border-b border-gray-200 bg-white">
                                <h3 className="font-bold text-gray-700">Gelen Kutusu</h3>
                            </div>
                            <div className="flex-1 overflow-y-auto">
                                {chatList.length === 0 ? (
                                    <div className="p-4 text-center text-gray-500 text-sm">
                                        Henüz mesaj yok.
                                    </div>
                                ) : (
                                    chatList.map((chat) => (
                                        <div
                                            key={chat.id}
                                            onClick={() => setSelectedChat(chat)}
                                            className={`group p-4 border-b border-gray-100 cursor-pointer hover:bg-white transition relative ${selectedChat?.id === chat.id ? 'bg-white border-l-4 border-l-indigo-500' : ''}`}
                                        >
                                            <div className="flex justify-between items-start mb-1">
                                                <span className={`font-semibold text-sm ${selectedChat?.id === chat.id ? 'text-indigo-700' : 'text-gray-800'}`}>
                                                    {chat.visitor?.name || 'Ziyaretçi'}
                                                </span>
                                                <span className="text-xs text-gray-400">
                                                    {new Date(chat.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                            <div className="text-xs text-gray-500 truncate pr-6">
                                                {chat.messages && chat.messages.length > 0
                                                    ? chat.messages[chat.messages.length - 1].body
                                                    : '...'}
                                            </div>

                                            <button
                                                onClick={(e) => handleDeleteChat(e, chat.id)}
                                                className="absolute bottom-3 right-3 text-gray-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100 p-1"
                                                title="Sohbeti Sil"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* SAĞ TARAF: SOHBET PENCERESİ */}
                        <div className="w-2/3 flex flex-col bg-white">
                            {selectedChat ? (
                                <>
                                    <div className="border-b border-gray-200 bg-gray-50">
                                        <div className="p-4 flex justify-between items-center">
                                            <div>
                                                <h3 className="font-bold text-gray-800 text-lg">{selectedChat.visitor?.name}</h3>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-green-600 flex items-center gap-1">
                                                        <span className="w-2 h-2 bg-green-500 rounded-full"></span> Çevrimiçi
                                                    </span>
                                                    {isVisitorTyping && (
                                                        <span className="text-xs text-gray-500 italic animate-pulse">
                                                            yazıyor...
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="px-4 pb-3 flex flex-wrap gap-3 text-xs text-gray-500 border-t border-gray-200 pt-2 bg-white/50">
                                            <div className="flex items-center gap-1" title="Konum">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                                </svg>
                                                <span>{selectedChat.visitor?.city || '-'}, {selectedChat.visitor?.country || '-'}</span>
                                            </div>
                                            <div className="flex items-center gap-1" title="Cihaz">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                                </svg>
                                                <span>{selectedChat.visitor?.os} / {selectedChat.visitor?.browser}</span>
                                            </div>
                                            <div className="flex items-center gap-1" title="IP Adresi">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                                                </svg>
                                                <span>{selectedChat.visitor?.ip_address}</span>
                                            </div>
                                            {selectedChat.visitor?.current_url && (
                                                <div className="flex items-center gap-1 ml-auto" title="Şu an bulunduğu sayfa">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                                    </svg>
                                                    <a
                                                        href={selectedChat.visitor.current_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-blue-600 hover:underline truncate max-w-[200px]"
                                                    >
                                                        {selectedChat.visitor.current_url}
                                                    </a>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex-1 p-4 overflow-y-auto bg-gray-50 space-y-4">
                                        {localMessages.map((msg) => (
                                            <div key={msg.id} className={`flex ${msg.sender_type === 'App\\Models\\Visitor' ? 'justify-start' : 'justify-end'}`}>
                                                <div className={`max-w-[70%] p-3 rounded-lg text-sm shadow-sm ${msg.sender_type === 'App\\Models\\Visitor'
                                                    ? 'bg-white text-gray-800 border border-gray-200'
                                                    : 'bg-indigo-600 text-white'
                                                    }`}>
                                                    {msg.body}

                                                    <div className={`text-[10px] mt-1 flex items-center justify-end gap-1 ${msg.sender_type === 'App\\Models\\Visitor' ? 'text-gray-400' : 'text-indigo-200'}`}>
                                                        <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>

                                                        {msg.sender_type !== 'App\\Models\\Visitor' && (
                                                            <span title={msg.is_read ? "Okundu" : "İletildi"}>
                                                                <svg xmlns="http://www.w3.org/2000/svg" className={`h-3 w-3 ${msg.is_read ? 'text-lime-300' : 'text-indigo-300'}`} viewBox="0 0 20 20" fill="currentColor">
                                                                    <path d="M9 12.553L15.618 4.67a1 1 0 011.527 1.137l-7.394 8.8a1 1 0 01-1.503.027L4.767 11.21a1 1 0 011.414-1.415l2.819 2.758z" />
                                                                    <path d="M5 12.553L11.618 4.67a1 1 0 011.527 1.137l-7.394 8.8a1 1 0 01-1.503.027L0.767 11.21a1 1 0 011.414-1.415l2.819 2.758z" />
                                                                </svg>
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        <div ref={messagesEndRef} />
                                    </div>

                                    <div className="p-4 border-t border-gray-200">
                                        <form className="flex gap-2" onSubmit={handleSubmit}>
                                            <input
                                                type="text"
                                                value={data.message}
                                                onChange={handleInputChange}
                                                placeholder="Bir mesaj yazın..."
                                                className="flex-1 border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                                disabled={processing}
                                            />
                                            <button
                                                type="submit"
                                                disabled={processing}
                                                className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition disabled:opacity-50"
                                            >
                                                Gönder
                                            </button>
                                        </form>
                                    </div>
                                </>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                    </svg>
                                    <p>Detayları görmek için soldan bir sohbet seçin.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}