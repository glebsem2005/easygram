const crypto = require('crypto');

class CryptoService {
  constructor() {
    this.curveName = 'prime256v1'; // NIST P-256 curve
  }

  // Генерация пары ключей (ECDH)
  generateKeyPair() {
    const ecdh = crypto.createECDH(this.curveName);
    ecdh.generateKeys();
    return {
      publicKey: ecdh.getPublicKey('base64', 'compressed'),
      privateKey: ecdh.getPrivateKey('base64'),
      ecdhInstance: ecdh, // для локального хранения и вычислений
    };
  }

  // Получить общий секрет (shared secret) с помощью чужого публичного ключа
  computeSharedSecret(ownPrivateKeyBase64, otherPublicKeyBase64) {
    const ecdh = crypto.createECDH(this.curveName);
    ecdh.setPrivateKey(Buffer.from(ownPrivateKeyBase64, 'base64'));
    const otherPubKeyBuffer = Buffer.from(otherPublicKeyBase64, 'base64');
    const sharedSecret = ecdh.computeSecret(otherPubKeyBuffer);
    return sharedSecret; // Buffer
  }

  // Шифрование AES-GCM
  encrypt(sharedSecret, plaintext) {
    const iv = crypto.randomBytes(12); // 96-bit IV для AES-GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', this.deriveKey(sharedSecret), iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    const authTag = cipher.getAuthTag();

    return {
      iv: iv.toString('base64'),
      ciphertext: encrypted,
      authTag: authTag.toString('base64'),
    };
  }

  // Расшифровка AES-GCM
  decrypt(sharedSecret, ivBase64, ciphertextBase64, authTagBase64) {
    const iv = Buffer.from(ivBase64, 'base64');
    const authTag = Buffer.from(authTagBase64, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.deriveKey(sharedSecret), iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertextBase64, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  // Производим хэширование shared secret для получения 256-битного ключа AES
  deriveKey(sharedSecret) {
    // SHA-256 хэш от sharedSecret — получается 32 байта для AES-256
    return crypto.createHash('sha256').update(sharedSecret).digest();
  }
}

module.exports = new CryptoService();
