import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm } from '@inertiajs/react';
import { useState, useEffect, useRef } from 'react';
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

window.Pusher = Pusher;

export default function ChatsIndex({ auth, conversations, website_id }) {
    // Sohbet Listesini State'e çevirdik (Canlı güncelleme için)
    const [chatList, setChatList] = useState(conversations);
    const [selectedChat, setSelectedChat] = useState(null);
    const [localMessages, setLocalMessages] = useState([]);
    const messagesEndRef = useRef(null);

    const { data, setData, post, processing, reset } = useForm({
        message: '',
    });

    // --- GLOBAL LISTENER: Website Kanalını Dinle (Sidebar İçin) ---
    useEffect(() => {
        if (!website_id) return;

        const echo = new Echo({
            broadcaster: 'reverb',
            key: import.meta.env.VITE_REVERB_APP_KEY,
            wsHost: import.meta.env.VITE_REVERB_HOST,
            wsPort: import.meta.env.VITE_REVERB_PORT ?? 80,
            wssPort: import.meta.env.VITE_REVERB_PORT ?? 443,
            forceTLS: (import.meta.env.VITE_REVERB_SCHEME === 'https'),
            enabledTransports: ['ws', 'wss'],
        });

        console.log(`🌍 Website Kanalı Dinleniyor: website.${website_id}`);

        echo.channel(`website.${website_id}`)
            .listen('.message.sent', (e) => {
                console.log("🔔 Genel Bildirim:", e);

                // Sohbet Listesini Güncelle
                setChatList((prevList) => {
                    // 1. Bu mesaj hangi sohbete ait?
                    const existingChatIndex = prevList.findIndex(c => c.id === e.conversation_id);

                    let updatedList = [...prevList];

                    if (existingChatIndex > -1) {
                        // VAR OLAN SOHBET:
                        // Sohbeti kopyala
                        const chatToMove = { ...updatedList[existingChatIndex] };

                        // Mesajlar dizisini güncelle (Önizleme için)
                        // Eğer messages dizisi yoksa oluştur, varsa sonuna ekle
                        chatToMove.messages = [...(chatToMove.messages || []), e];
                        chatToMove.updated_at = new Date().toISOString(); // Tarihi güncelle

                        // Listeden çıkar ve EN BAŞA ekle
                        updatedList.splice(existingChatIndex, 1);
                        updatedList.unshift(chatToMove);
                    } else {
                        // YENİ SOHBET (Listede yoksa):
                        // Yeni bir sohbet objesi oluştur ve başa ekle
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

                // Eğer bu mesaj ŞU AN AÇIK olan sohbete aitse, mesaj alanını da güncelle
                if (selectedChat && selectedChat.id === e.conversation_id) {
                    setLocalMessages(prev => {
                        if (prev.find(m => m.id === e.id)) return prev;
                        return [...prev, e];
                    });
                }
            });

        return () => {
            echo.leave(`website.${website_id}`);
        };
    }, [website_id, selectedChat]); // selectedChat değiştiğinde listener güncellensin ki if bloğu doğru çalışsın

    // --- SEÇİLİ SOHBET DEĞİŞİMİ ---
    useEffect(() => {
        if (selectedChat) {
            setLocalMessages(selectedChat.messages);
            // Seçilince okundu olarak işaretleme (Opsiyonel: İleride API isteği atılabilir)
        }
    }, [selectedChat]);

    // Scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [localMessages]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!selectedChat) return;

        // Optimistic UI: Mesajı hemen ekrana ve listeye ekle
        // (Backend'den gelmesini beklemeden)
        // Not: Reverb'den gelince ID çakışmasını handle ediyoruz zaten.

        post(route('chats.reply', selectedChat.id), {
            preserveScroll: true,
            onSuccess: () => reset(),
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
                                            className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-white transition ${selectedChat?.id === chat.id ? 'bg-white border-l-4 border-l-indigo-500' : ''}`}
                                        >
                                            <div className="flex justify-between items-start mb-1">
                                                <span className={`font-semibold text-sm ${selectedChat?.id === chat.id ? 'text-indigo-700' : 'text-gray-800'}`}>
                                                    {chat.visitor?.name || 'Ziyaretçi'}
                                                </span>
                                                <span className="text-xs text-gray-400">
                                                    {new Date(chat.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                            <div className="text-xs text-gray-500 truncate flex justify-between">
                                                <span>
                                                    {chat.messages && chat.messages.length > 0
                                                        ? chat.messages[chat.messages.length - 1].body
                                                        : '...'}
                                                </span>
                                                {/* Yeni mesaj geldiyse bir belirteç konulabilir */}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* SAĞ TARAF: SOHBET PENCERESİ */}
                        <div className="w-2/3 flex flex-col bg-white">
                            {selectedChat ? (
                                <>
                                    <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                                        <div>
                                            <h3 className="font-bold text-gray-800">{selectedChat.visitor?.name}</h3>
                                            <span className="text-xs text-green-600 flex items-center gap-1">
                                                <span className="w-2 h-2 bg-green-500 rounded-full"></span> Çevrimiçi
                                            </span>
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
                                                    <div className={`text-[10px] mt-1 text-right ${msg.sender_type === 'App\\Models\\Visitor' ? 'text-gray-400' : 'text-indigo-200'}`}>
                                                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
                                                onChange={e => setData('message', e.target.value)}
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