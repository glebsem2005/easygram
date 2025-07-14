const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const multer = require('multer');
const bodyParser = require('body-parser');
const cors = require('cors');
const crypto = require('crypto');

const { register, login, verifyToken } = require('./auth');
const memoryStore = require('./storage/memoryStore');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(bodyParser.json());

const upload = multer({ storage: multer.memoryStorage() });

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

// --- Аутентификация ---

app.post('/auth/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username и password обязательны' });
  try {
    const user = register(username, password);
    res.json({ success: true, user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username и password обязательны' });
  const user = login(username, password);
  if (!user) return res.status(401).json({ error: 'Неверный логин или пароль' });
  res.json({ success: true, user });
});

// --- Профиль ---

app.get('/profile', (req, res) => {
  const profile = memoryStore.getUserProfile(req.userId);
  if (!profile) return res.status(404).json({ error: 'Профиль не найден' });
  res.json(profile);
});

app.put('/profile', (req, res) => {
  const updates = req.body;
  // Разрешаем обновлять: name, interests (array), phoneNumber, friends (array of userIds)
  const allowedFields = ['name', 'interests', 'phoneNumber', 'friends'];
  const filteredUpdates = {};
  allowedFields.forEach(f => {
    if (updates[f] !== undefined) filteredUpdates[f] = updates[f];
  });
  const updatedProfile = memoryStore.updateUserProfile(req.userId, filteredUpdates);
  res.json(updatedProfile);
});

// --- Контакты и мэтчинг ---

// Получить список контактов (все пользователи кроме себя)
app.get('/contacts', (req, res) => {
  const contacts = memoryStore.getContacts(req.userId);
  res.json(contacts);
});

// Мэтчинг - лента с "профилями" для свайпа с оценкой совместимости и общими друзьями
app.get('/matching', (req, res) => {
  const currentUserProfile = memoryStore.getUserProfile(req.userId);
  if (!currentUserProfile) return res.status(404).json({ error: 'Профиль не найден' });

  const allProfiles = memoryStore.getAllUserProfiles().filter(p => p.userId !== req.userId);

  function calcCommonFriends(p1, p2) {
    if (!p1.friends || !p2.friends) return 0;
    const set1 = new Set(p1.friends);
    const set2 = new Set(p2.friends);
    let count = 0;
    set1.forEach(f => { if (set2.has(f)) count++; });
    return count;
  }

  function calcInterestSimilarity(p1, p2) {
    if (!p1.interests || !p2.interests) return 0;
    const set1 = new Set(p1.interests);
    const set2 = new Set(p2.interests);
    let common = 0;
    set1.forEach(i => { if (set2.has(i)) common++; });
    const total = new Set([...p1.interests, ...p2.interests]).size || 1;
    return common / total; // коэффициент от 0 до 1
  }

  const matches = allProfiles.map(profile => {
    const commonFriends = calcCommonFriends(currentUserProfile, profile);
    const interestSimilarity = calcInterestSimilarity(currentUserProfile, profile);
    return {
      userId: profile.userId,
      name: profile.name,
      interests: profile.interests || [],
      commonFriends,
      interestSimilarity: +interestSimilarity.toFixed(2),
      avatar: profile.avatar || null,
    };
  });

  // Можно отсортировать по комбинированной метрике (например, общий балл)
  matches.sort((a, b) => {
    const scoreA = a.commonFriends * 0.5 + a.interestSimilarity * 5;
    const scoreB = b.commonFriends * 0.5 + b.interestSimilarity * 5;
    return scoreB - scoreA;
  });

  res.json(matches);
});

// --- Сообщения ---

app.get('/messages', (req, res) => {
  const messages = memoryStore.getMessagesForUser(req.userId);
  res.json(messages);
});

app.post('/messages', (req, res) => {
  const { toUserId, text } = req.body;
  if (!toUserId || !text) return res.status(400).json({ error: 'toUserId и text обязательны' });

  const message = memoryStore.addMessage(req.userId, toUserId, text);
  res.json(message);
});

app.post('/messages/upload', upload.single('file'), (req, res) => {
  const { toUserId, type } = req.body; // type: image/audio/video
  if (!toUserId || !type || !req.file) {
    return res.status(400).json({ error: 'toUserId, type и файл обязательны' });
  }
  const fileData = req.file.buffer.toString('base64');
  const message = memoryStore.addFileMessage(req.userId, toUserId, type, fileData, req.file.mimetype);
  res.json(message);
});

// --- Посты ---

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

  const post = memoryStore.addPost(req.userId, text, imageBase64, imageMime);
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

// --- WebSocket ---

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

        const msg = memoryStore.addMessage(ws.userId, toUserId, text);

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
        if (userSockets.size === 0) clients.delete(ws.userId);
      }
    }
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Backend server listening on port ${PORT}`);
});
