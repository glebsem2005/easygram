const { randomUUID } = require('crypto');

const userProfiles = new Map(); // userId -> profile
const contacts = new Map(); // userId -> Set(userId)
const messages = new Map(); // userId -> []
const posts = new Map(); // userId -> []

function createUserProfile(userId, profile) {
  userProfiles.set(userId, { 
    ...profile, 
    createdAt: Date.now(), 
    interests: profile.interests || [],        
    friends: new Set(profile.friends || []),   
    phoneNumber: profile.phoneNumber || null,
    updatedAt: Date.now(),
  });
  if (!contacts.has(userId)) contacts.set(userId, new Set());
  if (!messages.has(userId)) messages.set(userId, []);
  if (!posts.has(userId)) posts.set(userId, []);
}

function getUserProfile(userId) {
  const profile = userProfiles.get(userId);
  if (!profile) return null;
  return {
    ...profile,
    friends: Array.from(profile.friends),
  };
}

function updateUserProfile(userId, updates) {
  const profile = userProfiles.get(userId);
  if (!profile) return null;

  if (updates.friends) {
    profile.friends = new Set(updates.friends);
    delete updates.friends;
  }

  if (updates.interests) {
    if (Array.isArray(updates.interests)) {
      profile.interests = updates.interests;
    }
    delete updates.interests;
  }

  if (updates.phoneNumber !== undefined) {
    profile.phoneNumber = updates.phoneNumber;
    delete updates.phoneNumber;
  }

  Object.assign(profile, updates);
  profile.updatedAt = Date.now();

  userProfiles.set(userId, profile);
  return getUserProfile(userId);
}

function getContacts(userId) {
  const userContacts = contacts.get(userId);
  if (!userContacts) return [];
  return Array.from(userContacts).map(id => getUserProfile(id));
}

function addContact(userId, contactId) {
  if (!contacts.has(userId)) contacts.set(userId, new Set());
  contacts.get(userId).add(contactId);
}

function getMessagesForUser(userId) {
  return messages.get(userId) || [];
}

function addMessage(fromUserId, toUserId, text) {
  const message = {
    id: randomUUID(),
    fromUserId,
    toUserId,
    text,
    timestamp: Date.now(),
    type: 'text',
  };

  if (!messages.has(fromUserId)) messages.set(fromUserId, []);
  if (!messages.has(toUserId)) messages.set(toUserId, []);

  messages.get(fromUserId).push(message);
  messages.get(toUserId).push(message);

  return message;
}

function addFileMessage(fromUserId, toUserId, fileType, fileDataBase64, mimeType) {
  const message = {
    id: randomUUID(),
    fromUserId,
    toUserId,
    fileType,  // image/audio/video
    fileDataBase64,
    mimeType,
    timestamp: Date.now(),
    type: 'file',
  };

  if (!messages.has(fromUserId)) messages.set(fromUserId, []);
  if (!messages.has(toUserId)) messages.set(toUserId, []);

  messages.get(fromUserId).push(message);
  messages.get(toUserId).push(message);

  return message;
}

function getPostsForUser(userId) {
  // Показываем посты контактов + свои посты
  const userContacts = contacts.get(userId) || new Set();
  const feedPosts = [];

  // Добавляем свои посты
  if (posts.has(userId)) {
    feedPosts.push(...posts.get(userId));
  }

  // Добавляем посты контактов
  for (const contactId of userContacts) {
    if (posts.has(contactId)) {
      feedPosts.push(...posts.get(contactId));
    }
  }

  // Сортируем по дате, последние сверху
  feedPosts.sort((a, b) => b.createdAt - a.createdAt);
  return feedPosts;
}

function addPost(userId, text, imageBase64 = null, imageMime = null) {
  const post = {
    id: randomUUID(),
    userId,
    text,
    imageBase64,
    imageMime,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    likes: new Set(),
  };

  if (!posts.has(userId)) posts.set(userId, []);
  posts.get(userId).push(post);

  return post;
}

function updatePost(userId, postId, updates) {
  const userPosts = posts.get(userId);
  if (!userPosts) return null;

  const idx = userPosts.findIndex(p => p.id === postId);
  if (idx === -1) return null;

  const post = userPosts[idx];
  if (post.userId !== userId) return null;

  if (updates.likes) {
    // Обновляем лайки — массив или Set
    post.likes = new Set(updates.likes);
    delete updates.likes;
  }

  Object.assign(post, updates);
  post.updatedAt = Date.now();
  return post;
}

function deletePost(userId, postId) {
  const userPosts = posts.get(userId);
  if (!userPosts) return false;

  const idx = userPosts.findIndex(p => p.id === postId);
  if (idx === -1) return false;

  const post = userPosts[idx];
  if (post.userId !== userId) return false;

  userPosts.splice(idx, 1);
  return true;
}

// Матчинг — подсчёт общих друзей
function countCommonFriends(userAId, userBId) {
  const friendsA = userProfiles.get(userAId)?.friends || new Set();
  const friendsB = userProfiles.get(userBId)?.friends || new Set();

  let count = 0;
  for (const friendId of friendsA) {
    if (friendsB.has(friendId)) count++;
  }
  return count;
}

// Матчинг — похожесть интересов (джаккард)
function interestSimilarity(userAId, userBId) {
  const interestsA = new Set(userProfiles.get(userAId)?.interests || []);
  const interestsB = new Set(userProfiles.get(userBId)?.interests || []);

  const intersection = new Set([...interestsA].filter(x => interestsB.has(x)));
  const union = new Set([...interestsA, ...interestsB]);

  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

// Получить пользователей для матчинга (сортировка по интересам и друзьям)
function getMatchingUsers(userId) {
  const allUserIds = [...userProfiles.keys()].filter(id => id !== userId);

  const matches = allUserIds.map(otherId => ({
    userId: otherId,
    profile: getUserProfile(otherId),
    commonFriends: countCommonFriends(userId, otherId),
    interestMatch: interestSimilarity(userId, otherId),
  }));

  matches.sort((a, b) => {
    if (b.interestMatch !== a.interestMatch) return b.interestMatch - a.interestMatch;
    return b.commonFriends - a.commonFriends;
  });

  return matches;
}

// Поиск пользователей по номерам телефонов
function findUsersByPhoneNumbers(phoneNumbers) {
  const normalized = phoneNumbers.map(num => num.replace(/\D/g, ''));

  const found = [];
  for (const [userId, profile] of userProfiles.entries()) {
    if (!profile.phoneNumber) continue;
    const userPhone = profile.phoneNumber.replace(/\D/g, '');
    if (normalized.includes(userPhone)) {
      found.push({ userId, profile: getUserProfile(userId) });
    }
  }

  return found;
}

module.exports = {
  createUserProfile,
  getUserProfile,
  updateUserProfile,
  getContacts,
  addContact,
  getMessagesForUser,
  addMessage,
  addFileMessage,
  getPostsForUser,
  addPost,
  updatePost,
  deletePost,
  getMatchingUsers,
  findUsersByPhoneNumbers,
};
