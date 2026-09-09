const crypto = require('crypto');

function hashPassword(plainTextPassword) {
    return crypto.createHash('sha256').update(plainTextPassword).digest('hex');
}

module.exports = { hashPassword };

console.log(hashPassword("admin"))