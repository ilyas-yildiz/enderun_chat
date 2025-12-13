import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, Image, Linking, Alert, SafeAreaView, StatusBar, Modal } from 'react-native';
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

    const insets = useSafeAreaInsets(); 

    // --- YARDIMCI: URL DÜZELTİCİ ---
    const fixImageUrl = (url) => {
        if (!url) return null;
        if (url.startsWith('http') && !url.includes('localhost')) return url;
        
        // API base URL'inden host'u al (Örn: http://192.168.1.35)
        const baseUrl = api.defaults.baseURL.replace('/api', ''); 

        // Eğer URL localhost içeriyorsa değiştir
        if (url.includes('localhost')) {
            return url.replace('http://localhost', baseUrl);
        }
        
        // Eğer relative path ise (/attachments/...) başına base ekle
        if (url.startsWith('/')) {
            return `${baseUrl}${url}`;
        }

        return url;
    };

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
                // Temp ID Kontrolü (Çift mesajı önlemek için)
                if (e.temp_id) {
                    const tempMatch = prev.find(m => m.temp_id === e.temp_id);
                    if (tempMatch) {
                        return prev.map(m => m.temp_id === e.temp_id ? {
                            id: e.id,
                            text: e.body,
                            createdAt: e.created_at,
                            is_admin: e.sender_type === 'App\\Models\\User',
                            type: e.type,
                            attachment_url: e.attachment_url,
                            temp_id: null
                        } : m);
                    }
                }

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

    // Benzersiz ID üreteci
    const generateTempId = () => {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    };

    const handleSend = async () => {
        if (!inputText.trim() && !selectedImage) return;
        
        const tempId = generateTempId();
        
        const tempMsg = {
            id: Date.now(),
            temp_id: tempId,
            text: inputText,
            is_admin: true,
            createdAt: new Date().toISOString(),
            type: selectedImage ? 'image' : 'text',
            attachment_url: selectedImage ? selectedImage.uri : null
        };

        setMessages(prev => [tempMsg, ...prev]);
        
        const textToSend = inputText;
        const imageToSend = selectedImage;
        
        setInputText('');
        setSelectedImage(null); // Modal Kapanır
        setSending(true);

        try {
            const formData = new FormData();
            if (textToSend) formData.append('message', textToSend);
            formData.append('temp_id', tempId);
            
            if (imageToSend) {
                const localUri = imageToSend.uri;
                const filename = localUri.split('/').pop();
                const match = /\.(\w+)$/.exec(filename);
                const type = match ? `image/${match[1]}` : `image`;

                // React Native FormData formatı
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
        const safeImageUrl = fixImageUrl(item.attachment_url);

        return (
            <View style={[styles.bubble, isMe ? styles.myBubble : styles.theirBubble]}>
                {/* GÖRSEL GÖSTERİMİ VE İNDİRME LİNKİ */}
                {item.type === 'image' && safeImageUrl ? (
                    <View>
                        <Image 
                            source={{ uri: safeImageUrl }} 
                            style={styles.chatImage} 
                            resizeMode="cover"
                        />
                        {/* İNDİR / AÇ LİNKİ (BURASI EKLENDİ) */}
                        <TouchableOpacity 
                            onPress={() => Linking.openURL(safeImageUrl)}
                            style={{marginTop: 5, alignSelf: 'flex-end'}}
                        >
                            <Text style={{color: isMe ? 'rgba(255,255,255,0.8)' : '#6366f1', fontSize: 12, textDecorationLine:'underline'}}>
                                📥 Resmi Aç
                            </Text>
                        </TouchableOpacity>
                    </View>
                ) : item.attachment_url ? (
                    <TouchableOpacity onPress={() => Linking.openURL(safeImageUrl)}>
                        <Text style={{color: isMe ? 'white' : 'blue', textDecorationLine: 'underline', marginBottom: 5}}>📎 Dosyayı Aç</Text>
                    </TouchableOpacity>
                ) : null}

                {item.text ? <Text style={[styles.msgText, isMe ? styles.myText : styles.theirText]}>{item.text}</Text> : null}
                <Text style={[styles.dateText, isMe ? styles.myDate : styles.theirDate]}>
                    {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
            </View>
        );
    };

    // TAM EKRAN ÖNİZLEME (Klavye Dostu)
    if (selectedImage) {
        return (
            <SafeAreaView style={styles.fullScreenSafeArea}>
                <KeyboardAvoidingView 
                    style={{ flex: 1 }}
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    keyboardVerticalOffset={Platform.OS === "android" ? StatusBar.currentHeight : 0}
                >
                    <View style={styles.fullScreenContainer}>
                        <View style={styles.topOverlay}>
                            <TouchableOpacity onPress={() => setSelectedImage(null)} style={styles.closeButton}>
                                <Text style={styles.closeButtonText}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.imageWrapper}>
                            <Image 
                                source={{ uri: selectedImage.uri }} 
                                style={styles.fullScreenImage} 
                                resizeMode="contain" 
                            />
                        </View>

                        <View style={[styles.bottomOverlay, { paddingBottom: Math.max(insets.bottom, 10) }]}>
                            <View style={styles.captionInputContainer}>
                                <TextInput
                                    style={styles.captionInput}
                                    value={inputText}
                                    onChangeText={setInputText}
                                    placeholder="Açıklama ekle..."
                                    placeholderTextColor="#ccc"
                                    multiline
                                    autoFocus
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
                    <Text style={{fontSize:24}}>📷</Text>
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

    fullScreenSafeArea: { flex: 1, backgroundColor: 'black' },
    fullScreenContainer: { flex: 1, justifyContent: 'space-between' },
    imageWrapper: { flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%', position: 'relative' },
    fullScreenImage: { width: '100%', height: '100%' },
    topOverlay: { 
        position: 'absolute', 
        top: 20, 
        right: 20, 
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