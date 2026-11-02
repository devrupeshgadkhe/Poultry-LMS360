
const crypto = require('crypto');
const fs = require('fs');

function decrypt(encryptedText, key) {
  const parts = encryptedText.split(':');
  if (parts.length !== 2) throw new Error('invalid parts');
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = parts[1];
  const derivedKey = crypto.createHash('sha256').update(key).digest();
  const decipher = crypto.createDecipheriv('aes-256-cbc', derivedKey, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

const key = process.env.BACKUP_ENCRYPTION_KEY || 'PoultryLMS360SecureDefaultBackupKey_2026';
const ciphertext = fs.readFileSync('cipher.txt', 'utf8').trim();

try {
  const plain = decrypt(ciphertext, key);
  console.log('Decrypted length:', plain.length);
  const data = JSON.parse(plain);
  console.log('Keys in decrypted:', Object.keys(data));
  if (data.tables) {
    console.log('Tables count:', data.tables.length);
    console.log('Table names:', data.tables.map(t => ({ name: t.name, rows: t.rows ? t.rows.length : 0 })));
  }
} catch (e) {
  console.error('Decryption failed:', e.message);
}
