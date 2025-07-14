import React, { useEffect, useState, useContext } from 'react';
import { View, FlatList, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import axios from 'axios';
import { AuthContext } from '../App';

const BACKEND_URL = 'http://localhost:8080'; // поменяй на свой адрес

export default function ContactsScreen({ navigation }) {
  const { authData } = useContext(AuthContext);
  const [contacts, setContacts] = useState([]);

  useEffect(() => {
    axios.get(BACKEND_URL + '/contacts', {
      headers: { Authorization: `Bearer ${authData.token}` }
    })
      .then(res => setContacts(res.data))
      .catch(err => Alert.alert('Ошибка', err.response?.data?.error || err.message));
  }, []);

  return (
    <View style={styles.container}>
      <FlatList
        data={contacts}
        keyExtractor={item => item.userId}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.contact}
            onPress={() => navigation.navigate('Chat', { contactId: item.userId, contactName: item.username })}
          >
            <Text>{item.username}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text>Контакты отсутствуют</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  contact: { padding: 15, borderBottomWidth: 1, borderBottomColor: '#ccc' },
});
