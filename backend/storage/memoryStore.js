const messages = [];   // { from, to, encryptedPayload, timestamp }
const posts = [];      // { id, from, content, media, timestamp, likes: [] }
const userContacts = new Map(); // userId -> [contactUserId, ...]
const userProfiles = new Map(); // userId -> { name, avatarUrl, bio, ... }

// Сообщения
function saveMessage({ from, to, encryptedPayload }) {
  messages.push({ from, to, encryptedPayload, timestamp: Date.now() });
}

// Посты
function savePost(post) {
  posts.push({ ...post, likes: [] });
}

function getPostById(postId) {
  return posts.find((p) => p.id === postId);
}

function updatePost(postId, updates) {
  const post = getPostById(postId);
  if (!post) return null;
  Object.assign(post, updates);
  return post;
}

function likePost(postId, userId) {
  const post = getPostById(postId);
  if (post && !post.likes.includes(userId)) {
    post.likes.push(userId);
  }
}

function getPostsForUser(userId) {
  const contacts = getUserContacts(userId);
  return posts.filter((p) => contacts.includes(p.from));
}

// Контакты
function getUserContacts(userId) {
  return userContacts.get(userId) || [];
}

function addContact(userId, contactId) {
  if (!userContacts.has(userId)) userContacts.set(userId, []);
  const contacts = userContacts.get(userId);
  if (!contacts.includes(contactId)) contacts.push(contactId);
}

// Профили
function getUserProfile(userId) {
  return userProfiles.get(userId) || null;
}

function updateUserProfile(userId, updates) {
  if (!userProfiles.has(userId)) return null;
  const profile = userProfiles.get(userId);
  Object.assign(profile, updates);
  userProfiles.set(userId, profile);
  return profile;
}

function createUserProfile(userId, initialData = {}) {
  if (!userProfiles.has(userId)) {
    userProfiles.set(userId, {
      name: '',
      avatarUrl: '',
      bio: '',
      ...initialData,
    });
  }
}

module.exports = {
  saveMessage,
  savePost,
  getPostById,
  updatePost,
  likePost,
  getPostsForUser,
  getUserContacts,
  addContact,
  getUserProfile,
  updateUserProfile,
  createUserProfile,
};
