const { dbQuery } = require('../config/database');
const { hashPassword } = require('../utils/hashing');

const AuthService = {
  async authenticate(usernameInput, password) {
    if (!usernameInput || !password) return null;

    const sqlText = `
      SELECT 
        u.id_usuario,
        u.id_empleado,
        u.username,
        u.password_hash,
        u.rol,
        CONCAT(p.nombre, ' ', p.paterno, ' ', ISNULL(p.materno, '')) AS nombre_completo,
        p.correo_personal
      FROM USUARIOS_PORTAL u
      INNER JOIN EMPLEADOS e ON u.id_empleado = e.id_empleado
      INNER JOIN PERSONAS p ON e.id_persona = p.id_persona
      WHERE LOWER(u.username) = LOWER(@username) OR LOWER(p.correo_personal) = LOWER(@username)
    `;

    const user = await dbQuery.getOne(sqlText, { username: usernameInput.trim() });
    if (!user) return null;

    const isValid = user.password_hash === password || hashPassword(password) === user.password_hash;
    if (!isValid) return null;

    return {
      id: user.id_usuario,
      id_empleado: user.id_empleado,
      nombre: user.nombre_completo,
      email: user.correo_personal || user.username,
      username: user.username,
      rol: user.rol,
      token: `fake-jwt-${Date.now()}`
    };
  }
};

module.exports = AuthService;
