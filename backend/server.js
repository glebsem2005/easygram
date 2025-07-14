const WebSocket = require('ws');
const { WS_PORT } = require('./config');
const {
  saveMessage,
  savePost,
  likePost,
  getUserContacts,
} = require('./storage/memoryStore');

const wss = new WebSocket.Server({ port: WS_PORT });
const clients = new Map(); // userId -> ws

console.log(`✅ WebSocket server running on ws://localhost:${WS_PORT}`);

wss.on('connection', (ws) => {
  let currentUserId = null;

  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg);

      switch (data.type) {
        case 'register':
          currentUserId = data.userId;
          clients.set(currentUserId, ws);
          console.log(`👤 User connected: ${currentUserId}`);
          break;

        case 'private_message': {
          const { to, encryptedPayload } = data;
          const recipient = clients.get(to);
          if (recipient) {
            recipient.send(JSON.stringify({
              type: 'private_message',
              from: currentUserId,
              encryptedPayload
            }));
          }
          saveMessage({ from: currentUserId, to, encryptedPayload });
          break;
        }

        case 'post': {
          const post = {
            id: data.postId,
            from: currentUserId,
            content: data.content,
            media: data.media || null,
            timestamp: Date.now()
          };
          savePost(post);

          // Отправляем пост контактам
          const contacts = getUserContacts(currentUserId);
          contacts.forEach(contactId => {
            const wsContact = clients.get(contactId);
            if (wsContact) {
              wsContact.send(JSON.stringify({
                type: 'new_post',
                post
              }));
            }
          });
          break;
        }

        case 'like': {
          likePost(data.postId, currentUserId);
          break;
        }

        case 'public_key': {
          const target = clients.get(data.to);
          if (target) {
            target.send(JSON.stringify({
              type: 'public_key',
              from: currentUserId,
              publicKey: data.publicKey
            }));
          }
          break;
        }

        case 'key_request': {
          const target = clients.get(data.to);
          if (target) {
            target.send(JSON.stringify({
              type: 'key_request',
              from: currentUserId
            }));
          }
          break;
        }

        case 'signal': {
          // WebRTC signaling (видеозвонки и т.п.)
          const target = clients.get(data.to);
          if (target) {
            target.send(JSON.stringify({
              type: 'signal',
              from: currentUserId,
              signal: data.signal
            }));
          }
          break;
        }

        default:
          console.warn('⚠️ Unknown message type:', data.type);
      }

    } catch (err) {
      console.error('❌ Invalid WS message:', err.message);
    }
  });

  ws.on('close', () => {
    if (currentUserId) {
      clients.delete(currentUserId);
      console.log(`👋 User disconnected: ${currentUserId}`);
    }
  });
});
