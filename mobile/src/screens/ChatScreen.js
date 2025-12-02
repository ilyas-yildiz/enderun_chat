import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, Image, Linking, Alert, SafeAreaView, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api, { REVERB_CONFIG } from '../services/api';
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import * as ImagePicker from 'expo-image-picker';

window.Pusher = Pusher;

export default function ChatScreen({ route, navigation }) {
    const { conversationId } = route.params;
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);

    // Güvenli alan ölçülerini al
    const insets = useSafeAreaInsets();

    // 1. İLK YÜKLEME
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

    // 2. REAL-TIME BAĞLANTI
    useEffect(() => {
        const echo = new Echo({
            ...REVERB_CONFIG,
            client: new Pusher(REVERB_CONFIG.key, REVERB_CONFIG)
        });

        const channel = echo.channel(`chat.${conversationId}`);

        channel.listen('.message.sent', (e) => {
            setMessages(prev => {
                if (prev.find(m => m.id === e.id)) return prev;

                const newMessage = {
                    id: e.id,
                    text: e.body,
                    createdAt: e.created_at,
                    is_admin: e.sender_type === 'App\\Models\\User',
                    type: e.type,
                    attachment_url: e.attachment_url
                };

                return [newMessage, ...prev];
            });
        });

        return () => echo.disconnect();
    }, [conversationId]);

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Hata', 'Galeriye erişim izni gerekiyor!');
            return;
        }

        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: false,
            quality: 0.7,
        });

        if (!result.canceled) {
            setSelectedImage(result.assets[0]);
        }
    };

    const handleSend = async () => {
        if (!inputText.trim() && !selectedImage) return;

        const tempMsg = {
            id: Date.now(),
            text: inputText,
            is_admin: true,
            createdAt: new Date().toISOString(),
            type: selectedImage ? 'image' : 'text',
            attachment_url: selectedImage ? selectedImage.uri : null
        };

        setMessages(prev => [tempMsg, ...prev]);

        const textToSend = inputText;
        const imageToSend = selectedImage;

        // UI Temizle
        setInputText('');
        setSelectedImage(null);
        setSending(true);

        try {
            const formData = new FormData();
            if (textToSend) formData.append('message', textToSend);

            if (imageToSend) {
                const localUri = imageToSend.uri;
                const filename = localUri.split('/').pop();
                const match = /\.(\w+)$/.exec(filename);
                const type = match ? `image/${match[1]}` : `image`;

                formData.append('attachment', {
                    uri: localUri,
                    name: filename,
                    type: type,
                });
            }

            await api.post(`/conversations/${conversationId}/reply`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
        } catch (error) {
            console.error("Mesaj gitmedi", error);
            Alert.alert("Hata", "Mesaj gönderilemedi!");
        } finally {
            setSending(false);
        }
    };

    const renderItem = ({ item }) => {
        const isMe = item.is_admin;
        return (
            <View style={[styles.bubble, isMe ? styles.myBubble : styles.theirBubble]}>
                {item.type === 'image' && item.attachment_url ? (
                    <Image
                        source={{ uri: item.attachment_url }}
                        style={styles.chatImage}
                        resizeMode="cover"
                    />
                ) : item.attachment_url ? (
                    <TouchableOpacity onPress={() => Linking.openURL(item.attachment_url)}>
                        <Text style={{ color: isMe ? 'white' : 'blue', textDecorationLine: 'underline', marginBottom: 5 }}>📎 Dosyayı Aç</Text>
                    </TouchableOpacity>
                ) : null}

                {item.text ? <Text style={[styles.msgText, isMe ? styles.myText : styles.theirText]}>{item.text}</Text> : null}
                <Text style={[styles.dateText, isMe ? styles.myDate : styles.theirDate]}>
                    {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
            </View>
        );
    };

    // --- RESİM SEÇİLDİYSE TAM EKRAN ONAY MODU (YENİLENMİŞ) ---
    if (selectedImage) {
        return (
            <SafeAreaView style={styles.fullScreenSafeArea}>
                <KeyboardAvoidingView
                    style={{ flex: 1 }}
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    // DÜZELTME: Offset artırıldı (+60) ki input klavyenin tam üstüne binsin
                    keyboardVerticalOffset={Platform.OS === "android" ? StatusBar.currentHeight + 60 : 60}
                >
                    <View style={styles.fullScreenContainer}>
                        {/* Üst Bar (Kapat Butonu) */}
                        <View style={styles.topOverlay}>
                            <TouchableOpacity onPress={() => setSelectedImage(null)} style={styles.closeButton}>
                                <Text style={styles.closeButtonText}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Resim Alanı (Esnek) */}
                        <View style={styles.imageWrapper}>
                            <Image
                                source={{ uri: selectedImage.uri }}
                                style={styles.fullScreenImage}
                                resizeMode="contain"
                            />
                        </View>

                        {/* Alt Kısım: Input (Sabit) */}
                        {/* DÜZELTME: Alt bara güvenli alan (safe area) kadar padding eklendi */}
                        <View style={[styles.bottomOverlay, { paddingBottom: Math.max(insets.bottom, 10) }]}>
                            <View style={styles.captionInputContainer}>
                                <TextInput
                                    style={styles.captionInput}
                                    value={inputText}
                                    onChangeText={setInputText}
                                    placeholder="Açıklama ekle..."
                                    placeholderTextColor="#ccc"
                                    multiline
                                />
                                <TouchableOpacity style={styles.sendButtonLarge} onPress={handleSend} disabled={sending}>
                                    {sending ? <ActivityIndicator color="white" /> : <Text style={styles.sendButtonText}>➤</Text>}
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </SafeAreaView>
        );
    }

    // --- NORMAL SOHBET MODU ---
    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={100}
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

            <View style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
                <TouchableOpacity onPress={pickImage} style={styles.attachButton}>
                    <Text style={{ fontSize: 24 }}>📷</Text>
                </TouchableOpacity>

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
    chatImage: { width: 200, height: 150, borderRadius: 8, marginBottom: 5, backgroundColor: '#e5e7eb' },

    // Input Alanı
    inputContainer: {
        flexDirection: 'row',
        padding: 10,
        backgroundColor: 'white',
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
        alignItems: 'center'
    },
    input: { flex: 1, backgroundColor: '#f9fafb', borderRadius: 20, paddingHorizontal: 15, paddingVertical: 10, maxHeight: 100, borderWidth: 1, borderColor: '#e5e7eb' },
    sendButton: { marginLeft: 10, backgroundColor: '#4F46E5', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    sendButtonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
    attachButton: { marginRight: 10, padding: 5 },

    // --- TAM EKRAN ÖNİZLEME STİLLERİ ---
    fullScreenSafeArea: { flex: 1, backgroundColor: 'black' },
    fullScreenContainer: { flex: 1, justifyContent: 'space-between' },

    imageWrapper: { flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%' },
    fullScreenImage: { width: '100%', height: '100%' },

    topOverlay: {
        position: 'absolute',
        top: 10,
        left: 0,
        right: 0,
        padding: 20,
        alignItems: 'flex-start',
        zIndex: 20
    },
    closeButton: { backgroundColor: 'rgba(0,0,0,0.5)', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    closeButtonText: { color: 'white', fontSize: 20, fontWeight: 'bold' },

    bottomOverlay: {
        backgroundColor: 'rgba(0,0,0,0.8)',
        padding: 10,
        width: '100%'
    },
    captionInputContainer: { flexDirection: 'row', alignItems: 'center' },
    captionInput: { flex: 1, color: 'white', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 25, paddingHorizontal: 20, paddingVertical: 10, marginRight: 10, fontSize: 16 },
    sendButtonLarge: { backgroundColor: '#4F46E5', width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' }
});