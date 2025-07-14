import React, { useEffect, useState, createContext } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import AuthScreen from './screens/AuthScreen';
import ContactsScreen from './screens/ContactsScreen';
import ChatScreen from './screens/ChatScreen';

export const AuthContext = createContext();

const Stack = createNativeStackNavigator();

export default function App() {
  const [authData, setAuthData] = useState({ token: null, userId: null });

  return (
    <AuthContext.Provider value={{ authData, setAuthData }}>
      <NavigationContainer>
        <Stack.Navigator>
          {!authData.token ? (
            <Stack.Screen
              name="Auth"
              component={AuthScreen}
              options={{ headerShown: false }}
            />
          ) : (
            <>
              <Stack.Screen name="Contacts" component={ContactsScreen} />
              <Stack.Screen name="Chat" component={ChatScreen} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </AuthContext.Provider>
  );
}
