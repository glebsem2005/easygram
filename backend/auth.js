const crypto = require('crypto');
const { createUserProfile, getUserProfile } = require('./storage/memoryStore');

const users = new Map(); // userId -> { username, passwordHash, salt }

// Хэширование пароля (PBKDF2)
function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
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

  return { userId, username };
}

// Аутентификация пользователя
function login(username, password) {
  const userEntry = [...users.entries()].find(([id, u]) => u.username === username);
  if (!userEntry) return null;
  const [userId, userData] = userEntry;
  const attemptedHash = hashPassword(password, userData.salt);
  if (attemptedHash === userData.passwordHash) {
    return { userId, username };
  }
  return null;
}

module.exports = {
  register,
  login,
};
