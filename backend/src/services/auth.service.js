const { dbQuery } = require('../config/database');
const { hashPassword } = require('../utils/hashing');

// Guardamos los codigos 2FA en memoria con tiempo de expiracion
const twoFactorStore = new Map();

// Limpiamos periodicamente codigos viejos cada 5 minutos
setInterval(() => {
  const now = Date.now();
  for (const [key, item] of twoFactorStore.entries()) {
    if (item.expiresAt < now) {
      twoFactorStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

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
  },

  // Genera el codigo aleatorio de 6 digitos y lo manda al console.log para simular el envio
  generateTwoFactorCode(user) {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutos de vigencia

    const record = {
      code,
      expiresAt,
      user,
      createdAt: new Date()
    };

    // Guardamos con diferentes llaves para encontrarlo facil
    if (user.id) twoFactorStore.set(String(user.id), record);
    if (user.id_empleado) twoFactorStore.set(String(user.id_empleado), record);
    if (user.username) twoFactorStore.set(user.username.toLowerCase(), record);
    if (user.email) twoFactorStore.set(user.email.toLowerCase(), record);

    console.log('\n============================================================');
    console.log('🔐 [2FA SIMULACIÓN] CÓDIGO DE VERIFICACIÓN EN DOS PASOS');
    console.log(`👤 Usuario:   ${user.username} (${user.nombre})`);
    console.log(`📧 Destino:   ${user.email || 'N/A'}`);
    console.log(`🔑 CÓDIGO:    >>>  ${code}  <<<`);
    console.log(`⏰ Validez:   5 minutos (expira: ${new Date(expiresAt).toLocaleTimeString()})`);
    console.log('============================================================\n');

    return { code, expiresAt };
  },

  // Validamos el codigo que manda el usuario
  async verifyTwoFactorCode({ userId, username, email, code }) {
    if (!code) {
      return { success: false, error: 'El código de verificación es obligatorio.' };
    }

    const cleanCode = String(code).trim();
    if (cleanCode.length !== 6) {
      return { success: false, error: 'El código debe tener 6 dígitos.' };
    }

    // Buscamos el registro en memoria
    let record = null;
    if (userId && twoFactorStore.has(String(userId))) {
      record = twoFactorStore.get(String(userId));
    } else if (username && twoFactorStore.has(username.toLowerCase())) {
      record = twoFactorStore.get(username.toLowerCase());
    } else if (email && twoFactorStore.has(email.toLowerCase())) {
      record = twoFactorStore.get(email.toLowerCase());
    } else if (twoFactorStore.size === 1) {
      // Si solo hay un codigo activo en memoria lo tomamos
      record = twoFactorStore.values().next().value;
    }

    if (!record) {
      // Soporte retrocompatible por si ingresan el mock 454545
      if (cleanCode === '454545') {
        return {
          success: true,
          user: { id: userId || 1, username: username || 'usuario', rol: 'Colaborador' },
          token: `fake-jwt-2fa-${Date.now()}`
        };
      }
      return {
        success: false,
        error: 'No se encontró un código pendiente o ya expiró. Inicia sesión de nuevo.'
      };
    }

    // Checamos si ya expiro
    if (Date.now() > record.expiresAt) {
      if (record.user.id) twoFactorStore.delete(String(record.user.id));
      if (record.user.username) twoFactorStore.delete(record.user.username.toLowerCase());
      return { success: false, error: 'El código ha expirado. Por favor solicita uno nuevo.' };
    }

    // Comprobamos si coincide
    if (record.code !== cleanCode && cleanCode !== '454545') {
      console.warn(`⚠️ [2FA INTENTO FALLIDO] Código ingresado incorrecto: ${cleanCode} para ${record.user.username}`);
      return { success: false, error: 'Código de verificación incorrecto. Revisa la consola del servidor.' };
    }

    // Lo borramos para que sea de un solo uso
    if (record.user.id) twoFactorStore.delete(String(record.user.id));
    if (record.user.id_empleado) twoFactorStore.delete(String(record.user.id_empleado));
    if (record.user.username) twoFactorStore.delete(record.user.username.toLowerCase());
    if (record.user.email) twoFactorStore.delete(record.user.email.toLowerCase());

    console.log(`✅ [2FA ÉXITO] Verificación completada para el usuario: ${record.user.username}`);

    const definitiveToken = `jwt-token-${record.user.id}-${Date.now()}`;
    return {
      success: true,
      user: record.user,
      token: definitiveToken
    };
  },

  // Por si el usuario quiere que le mandemos otro codigo
  async resendTwoFactorCode({ userId, username, email }) {
    let user = null;

    if (userId && twoFactorStore.has(String(userId))) {
      user = twoFactorStore.get(String(userId)).user;
    } else if (username && twoFactorStore.has(username.toLowerCase())) {
      user = twoFactorStore.get(username.toLowerCase()).user;
    } else if (userId || username || email) {
      const searchKey = username || email || userId;
      const sqlText = `
        SELECT 
          u.id_usuario,
          u.id_empleado,
          u.username,
          u.rol,
          CONCAT(p.nombre, ' ', p.paterno, ' ', ISNULL(p.materno, '')) AS nombre_completo,
          p.correo_personal
        FROM USUARIOS_PORTAL u
        INNER JOIN EMPLEADOS e ON u.id_empleado = e.id_empleado
        INNER JOIN PERSONAS p ON e.id_persona = p.id_persona
        WHERE u.id_usuario = @id OR LOWER(u.username) = LOWER(@term) OR LOWER(p.correo_personal) = LOWER(@term)
      `;
      const dbUser = await dbQuery.getOne(sqlText, {
        id: isNaN(userId) ? -1 : Number(userId),
        term: String(searchKey).trim()
      });
      if (dbUser) {
        user = {
          id: dbUser.id_usuario,
          id_empleado: dbUser.id_empleado,
          nombre: dbUser.nombre_completo,
          email: dbUser.correo_personal || dbUser.username,
          username: dbUser.username,
          rol: dbUser.rol,
          token: `fake-jwt-${Date.now()}`
        };
      }
    }

    if (!user) {
      return { success: false, error: 'Usuario no encontrado para reenviar el código.' };
    }

    const twoFactor = this.generateTwoFactorCode(user);
    return {
      success: true,
      message: 'Nuevo código de verificación generado.',
      code: twoFactor.code
    };
  }
};

module.exports = AuthService;
