import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import api, { REVERB_CONFIG } from '../services/api'; // REVERB_CONFIG'i import et
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

// React Native ortamında Pusher'ı global'e tanıtmamız gerekebilir
window.Pusher = Pusher;

export default function ChatScreen({ route, navigation }) {
    const { conversationId } = route.params;
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);

    // 1. İLK YÜKLEME (API'den Geçmişi Çek)
    useEffect(() => {
        const fetchMessages = async () => {
            try {
                const response = await api.get(`/conversations/${conversationId}`);
                setMessages(response.data.messages);
                navigation.setOptions({ title: response.data.visitor_name });
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };
        fetchMessages();
    }, [conversationId]);

    // 2. REAL-TIME BAĞLANTI (Reverb)
    useEffect(() => {
        // Echo Ayarları (api.js dosyasından geliyor)
        const echo = new Echo({
            ...REVERB_CONFIG,
            client: new Pusher(REVERB_CONFIG.key, REVERB_CONFIG) // Client'ı manuel veriyoruz
        });

        console.log(`🔌 Mobilde Soket Bağlanıyor: chat.${conversationId}`);

        // Kanala Abone Ol
        const channel = echo.channel(`chat.${conversationId}`);

        channel.listen('.message.sent', (e) => {
            console.log("📱 Mobile Mesaj Düştü:", e);

            setMessages(prev => {
                // Çift eklemeyi önle (Optimistic UI veya tekrarlayan eventler için)
                if (prev.find(m => m.id === e.id)) return prev;

                // Yeni mesajı en başa ekle (FlatList inverted olduğu için)
                // Gelen veriyi mobil formatına uyduruyoruz:
                const newMessage = {
                    id: e.id,
                    text: e.body,
                    createdAt: e.created_at,
                    is_admin: e.sender_type === 'App\\Models\\User'
                };

                return [newMessage, ...prev];
            });
        });

        // Temizlik: Sayfadan çıkınca bağlantıyı kes
        return () => {
            console.log("🔌 Mobilde Soket Kesildi");
            echo.disconnect();
        };
    }, [conversationId]);

    // Mesaj Gönder
    const handleSend = async () => {
        if (!inputText.trim()) return;

        const tempMsg = {
            id: Date.now(),
            text: inputText,
            is_admin: true, // Kendim (Admin)
            createdAt: new Date().toISOString()
        };

        setMessages(prev => [tempMsg, ...prev]);
        setInputText('');
        setSending(true);

        try {
            await api.post(`/conversations/${conversationId}/reply`, { message: tempMsg.text });
        } catch (error) {
            console.error("Mesaj gitmedi", error);
            alert("Mesaj gönderilemedi!");
        } finally {
            setSending(false);
        }
    };

    const renderItem = ({ item }) => {
        const isMe = item.is_admin;
        return (
            <View style={[styles.bubble, isMe ? styles.myBubble : styles.theirBubble]}>
                <Text style={[styles.msgText, isMe ? styles.myText : styles.theirText]}>{item.text}</Text>
                <Text style={[styles.dateText, isMe ? styles.myDate : styles.theirDate]}>
                    {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
            </View>
        );
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
        >
            {loading ? (
                <ActivityIndicator size="large" color="#4F46E5" style={{ marginTop: 20 }} />
            ) : (
                <FlatList
                    data={messages}
                    renderItem={renderItem}
                    keyExtractor={item => item.id.toString()}
                    inverted
                    contentContainerStyle={{ padding: 15 }}
                />
            )}

            <View style={styles.inputContainer}>
                <TextInput
                    style={styles.input}
                    value={inputText}
                    onChangeText={setInputText}
                    placeholder="Mesaj yaz..."
                    multiline
                />
                <TouchableOpacity style={styles.sendButton} onPress={handleSend} disabled={sending}>
                    <Text style={styles.sendButtonText}>➤</Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f3f4f6' },
    bubble: { maxWidth: '80%', padding: 12, borderRadius: 16, marginBottom: 10 },
    myBubble: { alignSelf: 'flex-end', backgroundColor: '#4F46E5', borderBottomRightRadius: 2 },
    theirBubble: { alignSelf: 'flex-start', backgroundColor: 'white', borderBottomLeftRadius: 2 },
    msgText: { fontSize: 16 },
    myText: { color: 'white' },
    theirText: { color: '#1f2937' },
    dateText: { fontSize: 10, marginTop: 4, textAlign: 'right' },
    myDate: { color: '#e0e7ff' },
    theirDate: { color: '#9ca3af' },
    inputContainer: {
        flexDirection: 'row',
        padding: 10,
        backgroundColor: 'white',
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
        alignItems: 'center'
    },
    input: {
        flex: 1,
        backgroundColor: '#f9fafb',
        borderRadius: 20,
        paddingHorizontal: 15,
        paddingVertical: 10,
        maxHeight: 100,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    sendButton: {
        marginLeft: 10,
        backgroundColor: '#4F46E5',
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendButtonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
});