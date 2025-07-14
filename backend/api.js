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

// Настройка CORS и body-parser
app.use(cors());
app.use(bodyParser.json());

// Настройка multer для загрузки файлов (сохраняем в память)
const upload = multer({ storage: multer.memoryStorage() });

// --- JWT middleware для защиты API ---
function authMiddleware(req, res, next) {
  if (req.path.startsWith('/auth')) return next(); // регистрация и логин без проверки

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Токен не предоставлен' });

  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: 'Неверный токен' });

  req.userId = payload.userId;
  next();
}

app.use(authMiddleware);

// --- Эндпоинты ---

// Регистрация
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

// Логин
app.post('/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username и password обязательны' });
  const user = login(username, password);
  if (!user) return res.status(401).json({ error: 'Неверный логин или пароль' });
  res.json({ success: true, user });
});

// Получить профиль текущего пользователя
app.get('/profile', (req, res) => {
  const profile = memoryStore.getUserProfile(req.userId);
  if (!profile) return res.status(404).json({ error: 'Профиль не найден' });
  res.json(profile);
});

// Редактировать профиль
app.put('/profile', (req, res) => {
  const updates = req.body;
  const updatedProfile = memoryStore.updateUserProfile(req.userId, updates);
  res.json(updatedProfile);
});

// Получить список контактов (других пользователей)
app.get('/contacts', (req, res) => {
  const contacts = memoryStore.getContacts(req.userId);
  res.json(contacts);
});

// Сообщения: получить все для текущего пользователя
app.get('/messages', (req, res) => {
  const messages = memoryStore.getMessagesForUser(req.userId);
  res.json(messages);
});

// Отправить сообщение (текст)
app.post('/messages', (req, res) => {
  const { toUserId, text } = req.body;
  if (!toUserId || !text) return res.status(400).json({ error: 'toUserId и text обязательны' });

  const message = memoryStore.addMessage(req.userId, toUserId, text);
  res.json(message);
});

// Загрузка файлов (фото, голосовые, видео) с сообщениями
app.post('/messages/upload', upload.single('file'), (req, res) => {
  const { toUserId, type } = req.body; // type: image/audio/video
  if (!toUserId || !type || !req.file) {
    return res.status(400).json({ error: 'toUserId, type и файл обязательны' });
  }
  // В memoryStore добавим файл как base64 или буфер (примитивно)
  const fileData = req.file.buffer.toString('base64');
  const message = memoryStore.addFileMessage(req.userId, toUserId, type, fileData, req.file.mimetype);
  res.json(message);
});

// Посты: получить ленту постов (только от контактов)
app.get('/posts', (req, res) => {
  const posts = memoryStore.getPostsForUser(req.userId);
  res.json(posts);
});

// Создать пост
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

// Редактировать пост
app.put('/posts/:postId', (req, res) => {
  const { postId } = req.params;
  const updates = req.body;
  const post = memoryStore.updatePost(req.userId, postId, updates);
  if (!post) return res.status(404).json({ error: 'Пост не найден или нет прав' });
  res.json(post);
});

// Удалить пост
app.delete('/posts/:postId', (req, res) => {
  const { postId } = req.params;
  const success = memoryStore.deletePost(req.userId, postId);
  if (!success) return res.status(404).json({ error: 'Пост не найден или нет прав' });
  res.json({ success: true });
});

// --- WebSocket с авторизацией ---

// Map userId => Set<WebSocket>
const clients = new Map();

wss.on('connection', function connection(ws, req) {
  // При подключении клиент должен первым сообщением отправить JSON: { type: 'auth', token: '...' }
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

      // После авторизации обрабатываем другие типы сообщений
      // Пример: { type: 'message', toUserId: '...', text: '...' }
      if (data.type === 'message') {
        const { toUserId, text } = data;
        if (!toUserId || !text) {
          ws.send(JSON.stringify({ type: 'error', error: 'toUserId и text обязательны' }));
          return;
        }

        // Сохраняем сообщение в memoryStore
        const msg = memoryStore.addMessage(ws.userId, toUserId, text);

        // Отправляем сообщение получателю, если онлайн
        const receivers = clients.get(toUserId);
        if (receivers) {
          receivers.forEach(clientWs => {
            clientWs.send(JSON.stringify({ type: 'message', message: msg }));
          });
        }

        // Подтверждаем отправителю
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

// Запуск сервера
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Backend server listening on port ${PORT}`);
});
