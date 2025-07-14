const userProfiles = new Map(); // userId -> profile
const contacts = new Map(); // userId -> Set(userId)
const messages = new Map(); // userId -> []
const posts = new Map(); // userId -> []

function createUserProfile(userId, profile) {
  userProfiles.set(userId, { 
    ...profile, 
    createdAt: Date.now(), 
    interests: [],        
    friends: new Set(),   
    phoneNumber: profile.phoneNumber || null,
  });
  contacts.set(userId, new Set());
  messages.set(userId, []);
  posts.set(userId, []);
}

function getUserProfile(userId) {
  const profile = userProfiles.get(userId);
  if (!profile) return null;
  return {
    ...profile,
    friends: Array.from(profile.friends || []),
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
    profile.interests = Array.isArray(updates.interests) ? updates.interests : profile.interests;
    delete updates.interests;
  }

  if (updates.phoneNumber) {
    profile.phoneNumber = updates.phoneNumber;
    delete updates.phoneNumber;
  }

  const updated = { ...profile, ...updates, updatedAt: Date.now() };
  userProfiles.set(userId, updated);
  return updated;
}

function getContacts(userId) {
  const userContacts = contacts.get(userId);
  if (!userContacts) return [];
  return Array.from(userContacts).map(id => getUserProfile(id));
}

function getMessagesForUser(userId) {
  return messages.get(userId) || [];
}

function addMessage(userId, message) {
  if (!messages.has(userId)) messages.set(userId, []);
  messages.get(userId).push(message);
}

function addFileMessage(userId, message) {
  if (!messages.has(userId)) messages.set(userId, []);
  messages.get(userId).push(message);
}

function getPostsForUser(userId) {
  return posts.get(userId) || [];
}

function addPost(userId, post) {
  if (!posts.has(userId)) posts.set(userId, []);
  posts.get(userId).push(post);
}

function updatePost(userId, postId, updates) {
  const userPosts = posts.get(userId);
  if (!userPosts) return null;
  const postIndex = userPosts.findIndex(p => p.id === postId);
  if (postIndex === -1) return null;
  userPosts[postIndex] = { ...userPosts[postIndex], ...updates, updatedAt: Date.now() };
  return userPosts[postIndex];
}

function deletePost(userId, postId) {
  const userPosts = posts.get(userId);
  if (!userPosts) return false;
  const index = userPosts.findIndex(p => p.id === postId);
  if (index === -1) return false;
  userPosts.splice(index, 1);
  return true;
}

// Функции для матчинга
function countCommonFriends(userA, userB) {
  const friendsA = userProfiles.get(userA)?.friends || new Set();
  const friendsB = userProfiles.get(userB)?.friends || new Set();
  let count = 0;
  for (const f of friendsA) {
    if (friendsB.has(f)) count++;
  }
  return count;
}

function interestSimilarity(userA, userB) {
  const interestsA = new Set(userProfiles.get(userA)?.interests || []);
  const interestsB = new Set(userProfiles.get(userB)?.interests || []);
  const intersection = new Set([...interestsA].filter(x => interestsB.has(x)));
  const union = new Set([...interestsA, ...interestsB]);
  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

function getMatchingUsers(userId) {
  const allUserIds = [...userProfiles.keys()].filter(id => id !== userId);
  const matches = allUserIds.map(id => ({
    userId: id,
    profile: getUserProfile(id),
    commonFriends: countCommonFriends(userId, id),
    interestMatch: interestSimilarity(userId, id),
  }));

  matches.sort((a, b) => {
    if (b.interestMatch !== a.interestMatch) return b.interestMatch - a.interestMatch;
    return b.commonFriends - a.commonFriends;
  });

  return matches;
}

// Поиск по номерам телефонов
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
