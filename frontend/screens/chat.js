import React, { useEffect, useState, useContext } from 'react';
import { View, FlatList, TextInput, Button, Text, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import axios from 'axios';
import { AuthContext } from '../App';

const BACKEND_URL = 'http://localhost:3000'; // поменяй на свой адрес

export default function ChatScreen({ route }) {
  const { contactId, contactName } = route.params;
  const { authData } = useContext(AuthContext);

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');

  const fetchMessages = async () => {
    try {
      const res = await axios.get(BACKEND_URL + '/messages', {
        headers: { Authorization: `Bearer ${authData.token}` }
      });
      // Отфильтруем сообщения между текущим пользователем и выбранным контактом
      const filtered = res.data.filter(
        m =>
          (m.from === contactId && m.to === authData.userId) ||
          (m.to === contactId && m.from === authData.userId)
      );
      setMessages(filtered);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, []);

  const sendMessage = async () => {
    if (!text.trim()) return;
    try {
      await axios.post(
        BACKEND_URL + '/messages',
        { toUserId: contactId, text },
        { headers: { Authorization: `Bearer ${authData.token}` } }
      );
      setMessages(prev => [...prev, { from: authData.userId, to: contactId, text, id: Date.now().toString() }]);
      setText('');
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
      keyboardVerticalOffset={80}
    >
      <FlatList
        data={messages}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <Text style={item.from === authData.userId ? styles.outgoing : styles.incoming}>
            {item.text}
          </Text>
        )}
      />
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Введите сообщение"
        />
        <Button title="Отправить" onPress={sendMessage} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 10 },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    paddingHorizontal: 10,
    marginRight: 8,
    height: 40,
  },
  outgoing: { alignSelf: 'flex-end', backgroundColor: '#DCF8C6', padding: 8, marginVertical: 4, borderRadius: 10, maxWidth: '80%' },
  incoming: { alignSelf: 'flex-start', backgroundColor: '#EEE', padding: 8, marginVertical: 4, borderRadius: 10, maxWidth: '80%' },
});
