const crypto = require('crypto');

const rawKey = "1e381fd8716b66ce7ba9b089d23fa8ddc42e74c09b1e0e5e5f2c6ca9b1987a1f";
const storedHash = "d81c3ee46afd299c5bb7b202488f9dcd985086975b9e9337c33607c7e556c6c7";

console.log("Stored hash matches sha256(rawKey):", crypto.createHash('sha256').update(rawKey).digest('hex') === storedHash);
console.log("Stored hash matches sha256('sots_' + rawKey):", crypto.createHash('sha256').update("sots_" + rawKey).digest('hex') === storedHash);
console.log("Hash of 'sots_' + rawKey:", crypto.createHash('sha256').update("sots_" + rawKey).digest('hex'));
