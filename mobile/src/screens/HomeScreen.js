import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native'; // Sayfaya geri dönünce tetiklemek için
import api from '../services/api';

export default function HomeScreen({ navigation }) {
    const [conversations, setConversations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Verileri Çek
    const fetchConversations = async () => {
        try {
            const response = await api.get('/conversations');
            setConversations(response.data);
        } catch (error) {
            console.error("Liste hatası:", error);
            // Token süresi dolmuş olabilir
            if (error.response && error.response.status === 401) {
                handleLogout();
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    // Sayfa her odaklandığında çalışır (Geri gelince yenile)
    useFocusEffect(
        useCallback(() => {
            fetchConversations();
        }, [])
    );

    const onRefresh = () => {
        setRefreshing(true);
        fetchConversations();
    };

    const handleLogout = async () => {
        try { await api.post('/logout'); } catch (e) { }
        await AsyncStorage.removeItem('auth_token');
        navigation.replace('Login');
    };

    // Tekil Sohbet Kartı Tasarımı
    const renderItem = ({ item }) => (
        <TouchableOpacity
            style={[styles.card, item.has_unread && styles.unreadCard]}
            onPress={() => navigation.navigate('Chat', { conversationId: item.id })}
        >
            <View style={styles.cardHeader}>
                <Text style={styles.visitorName}>{item.visitor_name}</Text>
                <Text style={styles.time}>{item.time}</Text>
            </View>

            <Text style={styles.message} numberOfLines={1}>
                {item.last_message}
            </Text>

            <View style={styles.footer}>
                <Text style={styles.siteName}>{item.website_name}</Text>
                {item.has_unread && <View style={styles.unreadBadge} />}
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            {/* Header */}
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
                            <Text style={styles.emptySubText}>Web sitenizden test mesajı atın.</Text>
                        </View>
                    }
                    contentContainerStyle={{ paddingBottom: 20, flexGrow: 1 }}
                />
            )}
        </View>
    );
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
        marginTop: 30 // Status bar payı
    },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#111827' },
    logoutText: { color: '#ef4444', fontWeight: '600' },

    // Kart
    card: {
        backgroundColor: 'white',
        padding: 16,
        marginHorizontal: 16,
        marginTop: 12,
        borderRadius: 12,
        // Gölge
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    unreadCard: { borderLeftWidth: 4, borderLeftColor: '#4F46E5' },

    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    visitorName: { fontSize: 16, fontWeight: 'bold', color: '#1f2937' },
    time: { fontSize: 12, color: '#9ca3af' },

    message: { fontSize: 14, color: '#6b7280', marginBottom: 8 },

    footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    siteName: { fontSize: 10, fontWeight: 'bold', color: '#6366f1', textTransform: 'uppercase' },
    unreadBadge: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#4F46E5' },

    emptyContainer: { alignItems: 'center', marginTop: 50 },
    emptyText: { fontSize: 18, color: '#374151', fontWeight: '600' },
    emptySubText: { fontSize: 14, color: '#9ca3af', marginTop: 5 },
});