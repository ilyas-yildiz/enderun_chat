import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, View } from 'react-native';
import api from './src/services/api';
import ChatScreen from './src/screens/ChatScreen';

// Ekranlar
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';

const Stack = createNativeStackNavigator();

export default function App() {
    const [loading, setLoading] = useState(true);
    const [initialRoute, setInitialRoute] = useState('Login');

    // Uygulama açılırken Token kontrolü yap
    useEffect(() => {
        const checkToken = async () => {
            try {
                const token = await AsyncStorage.getItem('auth_token');
                if (token) {
                    // Token varsa axios'a tanıt ve Home'a git
                    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
                    setInitialRoute('Home');
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        checkToken();
    }, []);

    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#4F46E5" />
            </View>
        );
    }

    return (
        <NavigationContainer>
            <Stack.Navigator initialRouteName={initialRoute}>
                <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
                <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Sohbetler' }} />
                <Stack.Screen name="Chat" component={ChatScreen} options={{ title: 'Sohbet' }} />
            </Stack.Navigator>
        </NavigationContainer>
    );
}