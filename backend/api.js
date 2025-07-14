// backend/api.js

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const multer = require('multer');
const bodyParser = require('body-parser');
const cors = require('cors');

const { register, login, verifyToken } = require('./auth');
const memoryStore = require('./storage/memoryStore');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(bodyParser.json());
const upload = multer({ storage: multer.memoryStorage() });

// JWT middleware
function authMiddleware(req, res, next) {
  if (req.path.startsWith('/auth')) return next();

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Токен не предоставлен' });

  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: 'Неверный токен' });

  req.userId = payload.userId;
  next();
}
app.use(authMiddleware);

// Регистрация
app.post('/auth/register', (req, res) => {
  const { username, password, phoneNumber } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username и password обязательны' });
  try {
    const user = register(username, password);
    // Добавляем телефон в профиль если есть
    if (phoneNumber) {
      memoryStore.updateUserProfile(user.userId, { phoneNumber });
    }
    res.json({ success: true, user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Логин
app.post('/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username и password обязательны' });
  const user = login(username, password);
  if (!user) return res.status(401).json({ error: 'Неверный логин или пароль' });
  res.json({ success: true, user });
});

// Профиль
app.get('/profile', (req, res) => {
  const profile = memoryStore.getUserProfile(req.userId);
  if (!profile) return res.status(404).json({ error: 'Профиль не найден' });
  res.json(profile);
});

app.put('/profile', (req, res) => {
  const updates = req.body;
  const updatedProfile = memoryStore.updateUserProfile(req.userId, updates);
  if (!updatedProfile) return res.status(404).json({ error: 'Профиль не найден' });
  res.json(updatedProfile);
});

// Контакты
app.get('/contacts', (req, res) => {
  const contacts = memoryStore.getContacts(req.userId);
  res.json(contacts);
});

// Добавить контакт (например, друга)
app.post('/contacts', (req, res) => {
  const { friendUserId } = req.body;
  if (!friendUserId) return res.status(400).json({ error: 'friendUserId обязателен' });

  const userProfile = memoryStore.getUserProfile(req.userId);
  const friendProfile = memoryStore.getUserProfile(friendUserId);
  if (!friendProfile) return res.status(404).json({ error: 'Пользователь для добавления не найден' });

  // Добавляем друг другу в друзья
  if (!userProfile.friends.includes(friendUserId)) {
    userProfile.friends.push(friendUserId);
  }
  if (!friendProfile.friends.includes(req.userId)) {
    friendProfile.friends.push(req.userId);
  }
  memoryStore.updateUserProfile(req.userId, { friends: userProfile.friends });
  memoryStore.updateUserProfile(friendUserId, { friends: friendProfile.friends });

  res.json({ success: true });
});

// Сообщения
app.get('/messages', (req, res) => {
  const messages = memoryStore.getMessagesForUser(req.userId);
  res.json(messages);
});

app.post('/messages', (req, res) => {
  const { toUserId, text } = req.body;
  if (!toUserId || !text) return res.status(400).json({ error: 'toUserId и text обязательны' });

  const message = memoryStore.addMessage(req.userId, { from: req.userId, to: toUserId, text, timestamp: Date.now(), id: crypto.randomUUID() });
  res.json(message);
});

app.post('/messages/upload', upload.single('file'), (req, res) => {
  const { toUserId, type } = req.body;
  if (!toUserId || !type || !req.file) return res.status(400).json({ error: 'toUserId, type и файл обязательны' });

  const fileData = req.file.buffer.toString('base64');
  const message = memoryStore.addFileMessage(req.userId, { from: req.userId, to: toUserId, type, fileData, mime: req.file.mimetype, timestamp: Date.now(), id: crypto.randomUUID() });
  res.json(message);
});

// Посты
app.get('/posts', (req, res) => {
  const posts = memoryStore.getPostsForUser(req.userId);
  res.json(posts);
});

app.post('/posts', upload.single('image'), (req, res) => {
  const { text } = req.body;
  let imageBase64 = null;
  let imageMime = null;
  if (req.file) {
    imageBase64 = req.file.buffer.toString('base64');
    imageMime = req.file.mimetype;
  }
  if (!text && !imageBase64) return res.status(400).json({ error: 'Текст или изображение обязательны' });

  const post = memoryStore.addPost(req.userId, { id: crypto.randomUUID(), text, imageBase64, imageMime, timestamp: Date.now() });
  res.json(post);
});

app.put('/posts/:postId', (req, res) => {
  const { postId } = req.params;
  const updates = req.body;
  const post = memoryStore.updatePost(req.userId, postId, updates);
  if (!post) return res.status(404).json({ error: 'Пост не найден или нет прав' });
  res.json(post);
});

app.delete('/posts/:postId', (req, res) => {
  const { postId } = req.params;
  const success = memoryStore.deletePost(req.userId, postId);
  if (!success) return res.status(404).json({ error: 'Пост не найден или нет прав' });
  res.json({ success: true });
});

// Матчи — новая фича
app.get('/matches', (req, res) => {
  const matches = memoryStore.getMatchingUsers(req.userId);
  res.json(matches);
});

// Поиск пользователей по номерам телефонов
app.post('/users/search-by-phone', (req, res) => {
  const { phoneNumbers } = req.body;
  if (!phoneNumbers || !Array.isArray(phoneNumbers)) {
    return res.status(400).json({ error: 'phoneNumbers должен быть массивом' });
  }
  const users = memoryStore.findUsersByPhoneNumbers(phoneNumbers);
  res.json(users);
});

// WebSocket

const clients = new Map();

wss.on('connection', function connection(ws, req) {
  ws.isAuthorized = false;
  ws.userId = null;

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      if (!ws.isAuthorized) {
        if (data.type === 'auth' && data.token) {
          const payload = verifyToken(data.token);
          if (!payload) {
            ws.send(JSON.stringify({ type: 'error', error: 'Неверный токен' }));
            ws.close();
            return;
          }
          ws.isAuthorized = true;
          ws.userId = payload.userId;

          if (!clients.has(ws.userId)) {
            clients.set(ws.userId, new Set());
          }
          clients.get(ws.userId).add(ws);

          ws.send(JSON.stringify({ type: 'auth', success: true }));
          return;
        }
        ws.send(JSON.stringify({ type: 'error', error: 'Требуется авторизация' }));
        ws.close();
        return;
      }

      if (data.type === 'message') {
        const { toUserId, text } = data;
        if (!toUserId || !text) {
          ws.send(JSON.stringify({ type: 'error', error: 'toUserId и text обязательны' }));
          return;
        }

        const msg = memoryStore.addMessage(ws.userId, { from: ws.userId, to: toUserId, text, timestamp: Date.now(), id: crypto.randomUUID() });

        const receivers = clients.get(toUserId);
        if (receivers) {
          receivers.forEach(clientWs => {
            clientWs.send(JSON.stringify({ type: 'message', message: msg }));
          });
        }

        ws.send(JSON.stringify({ type: 'message_status', success: true, messageId: msg.id }));
      }
    } catch (err) {
      ws.send(JSON.stringify({ type: 'error', error: 'Ошибка разбора сообщения' }));
    }
  });

  ws.on('close', () => {
    if (ws.isAuthorized && ws.userId) {
      const userSockets = clients.get(ws.userId);
      if (userSockets) {
        userSockets.delete(ws);
        if (userSockets.size === 0) {
          clients.delete(ws.userId);
        }
      }
    }
  });
});

module.exports = { app, server };
