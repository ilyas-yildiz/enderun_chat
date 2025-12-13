import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import api, { REVERB_CONFIG } from '../services/api';
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

window.Pusher = Pusher;

// --- GÜVENLİ BİLDİRİM HANDLER ---
// Expo Go'da bu kısım hata fırlatabilir, o yüzden try-catch ile sarıyoruz.
try {
    Notifications.setNotificationHandler({
        handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
        }),
    });
} catch (error) {
    console.warn("Bildirim sistemi başlatılamadı (Expo Go kısıtlaması olabilir).");
}

export default function HomeScreen({ navigation }) {
    const [conversations, setConversations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [user, setUser] = useState(null);
    const [expoPushToken, setExpoPushToken] = useState('');

    // 1. Kullanıcı Bilgisini Al
    useEffect(() => {
        const getUser = async () => {
            const userData = await AsyncStorage.getItem('user');
            if (userData) setUser(JSON.parse(userData));
        };
        getUser();
    }, []);

    // 2. BİLDİRİM İZNİ VE TOKEN ALMA (GÜVENLİ)
    useEffect(() => {
        registerForPushNotificationsAsync()
            .then(token => {
                if (token) {
                    setExpoPushToken(token);
                    saveTokenToBackend(token);
                } else {
                    console.log("Push Token alınamadı (Emülatör veya Expo Go kısıtlaması).");
                }
            })
            .catch(err => {
                console.log("Bildirim servisi hatası:", err);
            });
    }, []);

    const saveTokenToBackend = async (token) => {
        try {
            console.log("Token Backend'e gönderiliyor:", token);
            await api.post('/user/device-token', { token });
            console.log("✅ Token başarıyla kaydedildi.");
        } catch (error) {
            console.error("Token kaydetme hatası:", error);
        }
    };

    // 3. API'den Listeyi Çek
    const fetchConversations = async () => {
        try {
            const response = await api.get('/conversations');
            setConversations(response.data);
        } catch (error) {
            console.error("Liste hatası:", error);
            if (error.response && error.response.status === 401) {
                handleLogout();
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchConversations();
        }, [])
    );

    const calculateStatusText = (hasUnread, senderType) => {
        if (hasUnread) return 'Okunmadı';
        if (senderType === 'App\\Models\\User') return 'Cevaplandı';
        return 'Okundu';
    };

    // 4. REAL-TIME DİNLEME
    useEffect(() => {
        if (!user) return;

        const echo = new Echo({
            ...REVERB_CONFIG,
            client: new Pusher(REVERB_CONFIG.key, REVERB_CONFIG)
        });

        console.log(`📡 Mobil Gelen Kutusu Dinleniyor: App.Models.User.${user.id}`);
        const channel = echo.channel(`App.Models.User.${user.id}`);

        channel.listen('.message.sent', (e) => {
            console.log("🔔 Yeni Mesaj:", e);

            setConversations(prevList => {
                const index = prevList.findIndex(c => c.id === e.conversation_id);
                let updatedList = [...prevList];
                let updatedChat;

                const isVisitorMessage = e.sender_type === 'App\\Models\\Visitor';
                const newStatusText = calculateStatusText(isVisitorMessage, e.sender_type);

                if (index > -1) {
                    updatedChat = {
                        ...updatedList[index],
                        last_message: e.body || (e.type === 'image' ? '📷 Resim' : 'Dosya'),
                        time: 'Şimdi',
                        has_unread: isVisitorMessage,
                        last_sender_type: e.sender_type,
                        status_text: newStatusText
                    };
                    updatedList.splice(index, 1);
                } else {
                    updatedChat = {
                        id: e.conversation_id,
                        visitor_name: e.visitor ? e.visitor.name : 'Yeni Ziyaretçi',
                        website_name: 'Site',
                        last_message: e.body || '...',
                        time: 'Şimdi',
                        has_unread: isVisitorMessage,
                        last_sender_type: e.sender_type,
                        status_text: newStatusText
                    };
                }
                return [updatedChat, ...updatedList];
            });
        });

        channel.listen('.messages.read', (e) => {
             setConversations(prevList => 
                prevList.map(c => {
                    if (c.id === e.conversationId || c.id === e.conversation_id) {
                         const newStatus = c.last_sender_type === 'App\\Models\\User' ? 'Cevaplandı' : 'Okundu';
                         return { ...c, has_unread: false, status_text: newStatus };
                    }
                    return c;
                })
             );
        });

        return () => echo.disconnect();
    }, [user]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchConversations();
    };

    const handleLogout = async () => {
        try { await api.post('/logout'); } catch (e) {}
        await AsyncStorage.removeItem('auth_token');
        await AsyncStorage.removeItem('user');
        navigation.replace('Login');
    };

    const getStatusColor = (item) => {
        if (item.has_unread) return '#22c55e'; 
        if (item.last_sender_type === 'App\\Models\\User') return '#9ca3af'; 
        return '#6366f1'; 
    };

    const renderItem = ({ item }) => {
        const statusColor = getStatusColor(item);

        return (
            <TouchableOpacity 
                style={[
                    styles.card, 
                    { borderLeftColor: statusColor, borderLeftWidth: 4 } 
                ]} 
                onPress={() => {
                    setConversations(prev => prev.map(c => {
                        if (c.id === item.id) {
                             const newStatus = c.last_sender_type === 'App\\Models\\User' ? 'Cevaplandı' : 'Okundu';
                             return { ...c, has_unread: false, status_text: newStatus };
                        }
                        return c;
                    }));
                    navigation.navigate('Chat', { conversationId: item.id });
                }}
            >
                <View style={styles.cardHeader}>
                    <Text style={styles.visitorName}>{item.visitor_name}</Text>
                    <View style={styles.headerRight}>
                        <Text style={styles.time}>{item.time}</Text>
                        <Text style={[styles.statusText, { color: statusColor }]}>
                            {item.status_text}
                        </Text>
                    </View>
                </View>
                
                <Text style={styles.message} numberOfLines={1}>
                    {item.last_message}
                </Text>
                
                <View style={styles.footer}>
                    <Text style={[styles.siteName, { color: statusColor }]}>
                        {item.website_name}
                    </Text>
                    {item.has_unread && (
                        <View style={[styles.unreadBadge, { backgroundColor: statusColor }]} />
                    )}
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Gelen Kutusu</Text>
                <TouchableOpacity onPress={handleLogout}>
                    <Text style={styles.logoutText}>Çıkış</Text>
                </TouchableOpacity>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color="#4F46E5" style={{ marginTop: 20 }} />
            ) : (
                <FlatList
                    data={conversations}
                    renderItem={renderItem}
                    keyExtractor={item => item.id.toString()}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>Henüz hiç mesaj yok.</Text>
                        </View>
                    }
                    contentContainerStyle={{ paddingBottom: 20, flexGrow: 1 }}
                />
            )}
        </View>
    );
}

// --- TOKEN ALMA YARDIMCI FONKSİYONU (GÜVENLİ) ---
async function registerForPushNotificationsAsync() {
  let token;

  // Expo Go SDK 53+ ile gelen Android kısıtlamasını bypass etmek için try-catch
  try {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      }

      if (Device.isDevice) {
        // İzin kontrolü sırasında hata verirse yakala
        const { status: existingStatus } = await Notifications.getPermissionsAsync().catch(() => ({ status: 'undetermined' }));
        
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync().catch(() => ({ status: 'denied' }));
          finalStatus = status;
        }
        
        if (finalStatus !== 'granted') {
          console.log('Bildirim izni alınamadı (Expo Go kısıtlaması olabilir).');
          return;
        }
        
        // Token alma kısmı
        const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
        
        // Burası Expo Go'da hata fırlatırsa catch bloğuna düşer
        const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
        token = tokenData.data;
        console.log("📱 Expo Push Token:", token);
      } else {
        console.log('Bildirimler emülatörde çalışmaz, fiziksel cihaz gerekir.');
      }
  } catch (error) {
      console.warn("Bildirim sistemi uyarı (Görmezden gelinebilir):", error.message);
      return null;
  }

  return token;
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f3f4f6' },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
        marginTop: 30 
    },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1f2937' },
    logoutText: { color: '#ef4444', fontWeight: '600' },
    
    card: {
        backgroundColor: 'white',
        padding: 16,
        marginHorizontal: 16,
        marginTop: 12,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    visitorName: { fontSize: 16, fontWeight: 'bold', color: '#1f2937' },
    headerRight: { alignItems: 'flex-end' },
    time: { fontSize: 12, color: '#9ca3af' },
    statusText: { fontSize: 10, fontWeight: '600', marginTop: 2 }, 
    
    message: { fontSize: 14, color: '#6b7280', marginBottom: 8 },
    
    footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    siteName: { fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
    
    unreadBadge: { width: 10, height: 10, borderRadius: 5 },

    emptyContainer: { alignItems: 'center', marginTop: 50 },
    emptyText: { fontSize: 18, color: '#374151', fontWeight: '600' },
});