import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';

export default function LoginScreen({ navigation }) {
    const [email, setEmail] = useState('admin@enderun.com');
    const [password, setPassword] = useState('password');
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        setLoading(true);
        try {
            const response = await api.post('/login', { email, password });

            // Token ve User bilgisini kaydet
            const { token, user } = response.data;
            await AsyncStorage.setItem('auth_token', token);
            await AsyncStorage.setItem('user', JSON.stringify(user));

            // Token'ı sonraki istekler için axios header'ına ekle
            api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

            // Ana Sayfaya Yönlendir
            navigation.replace('Home');

        } catch (error) {
            console.error(error);
            Alert.alert('Hata', 'Giriş yapılamadı. Bilgileri kontrol edin.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Enderun Chat</Text>
            <Text style={styles.subtitle}>Yönetici Girişi</Text>

            <View style={styles.inputContainer}>
                <TextInput
                    style={styles.input}
                    placeholder="E-Posta"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                />
                <TextInput
                    style={styles.input}
                    placeholder="Şifre"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                />
            </View>

            <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Giriş Yap</Text>}
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#f3f4f6' },
    title: { fontSize: 32, fontWeight: 'bold', color: '#4F46E5', textAlign: 'center', marginBottom: 10 },
    subtitle: { fontSize: 18, color: '#6b7280', textAlign: 'center', marginBottom: 40 },
    inputContainer: { marginBottom: 20 },
    input: { backgroundColor: 'white', padding: 15, borderRadius: 10, marginBottom: 15, borderWidth: 1, borderColor: '#e5e7eb' },
    button: { backgroundColor: '#4F46E5', padding: 15, borderRadius: 10, alignItems: 'center' },
    buttonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
});