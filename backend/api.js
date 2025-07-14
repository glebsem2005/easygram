const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const {
  HTTP_PORT,
  MEDIA_DIR,
  MAX_FILE_SIZE_MB,
  ALLOWED_MIME_TYPES,
} = require('./config');
const {
  addContact,
  getUserProfile,
  updateUserProfile,
  getPostById,
  updatePost,
} = require('./storage/memoryStore');

const app = express();
app.use(express.json());

if (!fs.existsSync(MEDIA_DIR)) {
  fs.mkdirSync(MEDIA_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, MEDIA_DIR);
  },
  filename(req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE_MB * 1024 * 1024 },
  fileFilter(req, file, cb) {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Недопустимый тип файла'));
  },
});

// Загрузка медиа (фото, видео, аудио)
app.post('/upload', upload.single('media'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });
  const url = `/media/${req.file.filename}`;
  res.json({ url });
});

// Статика медиа
app.use('/media', express.static(MEDIA_DIR));

// Добавление контакта
app.post('/contacts/add', (req, res) => {
  const { userId, contactId } = req.body;
  if (!userId || !contactId) {
    return res.status(400).json({ error: 'userId и contactId обязательны' });
  }
  addContact(userId, contactId);
  res.json({ success: true });
});

// --- Профиль пользователя ---

// Получить профиль
app.get('/profile/:userId', (req, res) => {
  const profile = getUserProfile(req.params.userId);
  if (!profile) return res.status(404).json({ error: 'Профиль не найден' });
  res.json(profile);
});

// Обновить профиль
app.put('/profile/:userId', (req, res) => {
  const updated = updateUserProfile(req.params.userId, req.body);
  if (!updated) return res.status(404).json({ error: 'Профиль не найден' });
  res.json({ success: true, profile: updated });
});

// --- Посты ---

// Получить пост по ID
app.get('/post/:postId', (req, res) => {
  const post = getPostById(req.params.postId);
  if (!post) return res.status(404).json({ error: 'Пост не найден' });
  res.json(post);
});

// Обновить пост
app.put('/post/:postId', (req, res) => {
  const updated = updatePost(req.params.postId, req.body);
  if (!updated) return res.status(404).json({ error: 'Пост не найден' });
  res.json({ success: true, post: updated });
});

app.listen(HTTP_PORT, () => {
  console.log(`✅ HTTP API server running on http://localhost:${HTTP_PORT}`);
});
