import React, { useState, useContext } from 'react';
import { View, TextInput, Button, Text, StyleSheet, Alert } from 'react-native';
import axios from 'axios';
import { AuthContext } from '../App';

const BACKEND_URL = 'http://localhost:3000'; // поменяй на свой адрес

export default function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { setAuthData } = useContext(AuthContext);

  const handleSubmit = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('Ошибка', 'Введите имя пользователя и пароль');
      return;
    }

    const endpoint = isLogin ? '/auth/login' : '/auth/register';

    try {
      const response = await axios.post(BACKEND_URL + endpoint, { username, password });
      if (response.data.success) {
        const { user } = response.data;
        setAuthData({ token: user.token, userId: user.userId });
      } else {
        Alert.alert('Ошибка', 'Неверные данные');
      }
    } catch (error) {
      Alert.alert('Ошибка', error.response?.data?.error || error.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{isLogin ? 'Вход' : 'Регистрация'}</Text>

      <TextInput
        placeholder="Имя пользователя"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        style={styles.input}
      />

      <TextInput
        placeholder="Пароль"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={styles.input}
      />

      <Button title={isLogin ? 'Войти' : 'Зарегистрироваться'} onPress={handleSubmit} />

      <Text
        style={styles.toggle}
        onPress={() => setIsLogin(!isLogin)}
      >
        {isLogin ? 'Нет аккаунта? Зарегистрироваться' : 'Есть аккаунт? Войти'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20 },
  input: {
    borderWidth: 1, borderColor: '#ccc', marginBottom: 12, padding: 10, borderRadius: 5,
  },
  title: { fontSize: 24, marginBottom: 20, textAlign: 'center' },
  toggle: { marginTop: 15, color: 'blue', textAlign: 'center' },
});
