const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { createUserProfile } = require('./storage/memoryStore');

const users = new Map(); // userId -> { username, passwordHash, salt }

const JWT_SECRET = 'your-very-secure-secret-key'; // Поменяй на env-переменную в проде
const JWT_EXPIRES_IN = '7d';

// Хэширование пароля (PBKDF2)
function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
}

function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

// Регистрация нового пользователя
function register(username, password) {
  if ([...users.values()].some(u => u.username === username)) {
    throw new Error('Username already exists');
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = hashPassword(password, salt);
  const userId = crypto.randomUUID();

  users.set(userId, { username, passwordHash, salt });
  createUserProfile(userId, { name: username });

  // Возвращаем токен сразу после регистрации
  return { userId, username, token: generateToken(userId) };
}

// Аутентификация пользователя
function login(username, password) {
  const userEntry = [...users.entries()].find(([id, u]) => u.username === username);
  if (!userEntry) return null;
  const [userId, userData] = userEntry;
  const attemptedHash = hashPassword(password, userData.salt);
  if (attemptedHash === userData.passwordHash) {
    return { userId, username, token: generateToken(userId) };
  }
  return null;
}

module.exports = {
  register,
  login,
  generateToken,
  verifyToken,
};
