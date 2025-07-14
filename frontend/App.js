// App.js
import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import AuthScreen from './screens/AuthScreen';
import ContactsScreen from './screens/ContactsScreen';
import ChatScreen from './screens/ChatScreen';

import AsyncStorage from '@react-native-async-storage/async-storage';

const Stack = createNativeStackNavigator();

export default function App() {
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // При старте пытаемся загрузить токен из памяти
    AsyncStorage.getItem('token').then(t => {
      setToken(t);
      setLoading(false);
    });
  }, []);

  if (loading) return null; // или спиннер

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {!token ? (
          <Stack.Screen name="Auth">
            {props => <AuthScreen {...props} onLogin={t => {
              setToken(t);
              AsyncStorage.setItem('token', t);
            }} />}
          </Stack.Screen>
        ) : (
          <>
            <Stack.Screen name="Contacts" component={ContactsScreen} />
            <Stack.Screen name="Chat" component={ChatScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
