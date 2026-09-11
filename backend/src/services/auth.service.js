const { dbQuery } = require('../config/database');
const { hashPassword } = require('../utils/hashing');

const AuthService = {
  async authenticate(email, password) {
    if (!email || !password) return null;

    const user = await dbQuery.get(
      'SELECT id, nombre, email, password_hash, rol, avatar FROM usuarios WHERE LOWER(email) = LOWER(?)',
      [email.trim()]
    );

    if (!user) return null;

    const isValid = user.password_hash === password || hashPassword(password) === user.password_hash;
    if (!isValid) return null;

    return {
      id: user.id,
      nombre: user.nombre,
      email: user.email,
      rol: user.rol,
      avatar: user.avatar,
      token: `fake-jwt-${Date.now()}`
    };
  }
};

module.exports = AuthService;
