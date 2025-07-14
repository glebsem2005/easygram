const messages = [];   // { from, to, encryptedPayload, timestamp }
const posts = [];      // { id, from, content, media, timestamp, likes: [] }
const userContacts = new Map(); // userId -> [contactUserId, ...]

function saveMessage({ from, to, encryptedPayload }) {
  messages.push({
    from,
    to,
    encryptedPayload,
    timestamp: Date.now()
  });
}

function savePost(post) {
  posts.push({ ...post, likes: [] });
}

function likePost(postId, userId) {
  const post = posts.find(p => p.id === postId);
  if (post && !post.likes.includes(userId)) {
    post.likes.push(userId);
  }
}

function getPostsForUser(userId) {
  // Возвращает посты контактов
  const contacts = getUserContacts(userId);
  return posts.filter(p => contacts.includes(p.from));
}

function getUserContacts(userId) {
  return userContacts.get(userId) || [];
}

function addContact(userId, contactId) {
  if (!userContacts.has(userId)) {
    userContacts.set(userId, []);
  }
  const contacts = userContacts.get(userId);
  if (!contacts.includes(contactId)) {
    contacts.push(contactId);
  }
}

module.exports = {
  saveMessage,
  savePost,
  likePost,
  getPostsForUser,
  getUserContacts,
  addContact,
};
