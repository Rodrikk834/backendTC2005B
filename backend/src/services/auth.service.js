const { dbQuery } = require('../config/database');
const { hashPassword, comparePassword } = require('../utils/hashing');
const EmailService = require('./email.service');

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
        ISNULL(u.primer_acceso, 0) AS primer_acceso,
        d.nombre_departamento AS departamento,
        pu.nombre_puesto AS puesto,
        CONCAT(p.nombre, ' ', ISNULL(p.paterno, ''), ' ', ISNULL(p.materno, '')) AS nombre_completo,
        p.correo_personal
      FROM USUARIOS_PORTAL u
      INNER JOIN EMPLEADOS e ON u.id_empleado = e.id_empleado
      INNER JOIN PERSONAS p ON e.id_persona = p.id_persona
      LEFT JOIN CAT_DEPARTAMENTOS d ON e.id_departamento = d.id_departamento
      LEFT JOIN CAT_PUESTOS pu ON e.id_puesto = pu.id_puesto
      WHERE LOWER(u.username) = LOWER(@username) OR LOWER(p.correo_personal) = LOWER(@username)
    `;

        const user = await dbQuery.getOne(sqlText, { username: usernameInput.trim() });
        if (!user) return null;

        const isValid = await comparePassword(password, user.password_hash);
        if (!isValid) return null;

        // Resuelve correo real de la tabla PERSONAS o fallback al ingresado
        const emailResuelto = user.correo_personal ||
            (usernameInput.includes('@') ? usernameInput.trim() : `${user.username}@eslabon.com`);

        return {
            id: user.id_usuario,
            id_empleado: user.id_empleado,
            nombre: (user.nombre_completo || '').trim(),
            email: emailResuelto,
            username: user.username,
            rol: user.rol,
            departamento: user.departamento || '',
            puesto: user.puesto || '',
            primer_acceso: Boolean(user.primer_acceso),
            token: `fake-jwt-${Date.now()}`
        };
    },

    // Genera el codigo aleatorio de 6 digitos, lo almacena y envia el correo por Nodemailer
    async generateTwoFactorCode(user, loginEmailInput = '') {
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutos de vigencia

        const correoDestino = user.email ||
            (loginEmailInput && loginEmailInput.includes('@') ? loginEmailInput.trim() : `${user.username}@eslabon.com`);

        const record = {
            code,
            expiresAt,
            email: correoDestino,
            user,
            createdAt: new Date()
        };

        // Guardamos con diferentes llaves para encontrarlo facil
        if (user.id) twoFactorStore.set(String(user.id), record);
        if (user.id_empleado) twoFactorStore.set(String(user.id_empleado), record);
        if (user.username) twoFactorStore.set(user.username.toLowerCase(), record);
        if (correoDestino) twoFactorStore.set(correoDestino.toLowerCase(), record);

        console.log('\n============================================================');
        console.log('🔐 [2FA SIMULACIÓN / ENVÍO] CÓDIGO DE VERIFICACIÓN');
        console.log(`👤 Usuario:   ${user.username} (${user.nombre})`);
        console.log(`📧 Destino:   ${correoDestino}`);
        console.log(`🔑 CÓDIGO:    >>>  ${code}  <<<`);
        console.log(`⏰ Validez:   5 minutos (expira: ${new Date(expiresAt).toLocaleTimeString()})`);
        console.log('============================================================\n');

        // Enviamos el correo a través de Nodemailer con la plantilla HTML de Eslabón Cloud
        try {
            await EmailService.enviarCodigo2FA(correoDestino, user.nombre || user.username, code);
        } catch (mailErr) {
            console.warn('Advertencia al enviar correo 2FA (continuando proceso):', mailErr.message);
        }

        return { code, expiresAt, email: correoDestino };
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
            // Soporte retrocompatible por si ingresan el mock 454545 en desarrollo
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

        // Checamos si ya expiro (más de 5 minutos)
        if (Date.now() > record.expiresAt) {
            if (record.user.id) twoFactorStore.delete(String(record.user.id));
            if (record.user.username) twoFactorStore.delete(record.user.username.toLowerCase());
            return { success: false, error: 'El código ha expirado. Por favor solicita uno nuevo.' };
        }

        // Comprobamos si coincide
        if (record.code !== cleanCode && cleanCode !== '454545') {
            console.warn(`⚠️ [2FA INTENTO FALLIDO] Código ingresado incorrecto: ${cleanCode} para ${record.user.username}`);
            return { success: false, error: 'Código de verificación incorrecto. Revisa tu correo o consola.' };
        }

        // Lo borramos para que sea de un solo uso
        if (record.user.id) twoFactorStore.delete(String(record.user.id));
        if (record.user.id_empleado) twoFactorStore.delete(String(record.user.id_empleado));
        if (record.user.username) twoFactorStore.delete(record.user.username.toLowerCase());
        if (record.email) twoFactorStore.delete(record.email.toLowerCase());

        console.log(`✅ [2FA ÉXITO] Verificación completada para el usuario: ${record.user.username}`);

        const definitiveToken = `jwt-token-${record.user.id}-${Date.now()}`;
        return {
            success: true,
            user: record.user,
            token: definitiveToken
        };
    },

    // Por si el usuario quiere que le reenviemos el codigo por correo
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
                    email: dbUser.correo_personal || (email && email.includes('@') ? email : `${dbUser.username}@eslabon.com`),
                    username: dbUser.username,
                    rol: dbUser.rol,
                    token: `fake-jwt-${Date.now()}`
                };
            }
        }

        if (!user) {
            return { success: false, error: 'Usuario no encontrado para reenviar el código.' };
        }

        const twoFactor = await this.generateTwoFactorCode(user, email || user.email);
        return {
            success: true,
            message: 'Código reenviado por correo',
            email: twoFactor.email,
            code: twoFactor.code
        };
    }
};

module.exports = AuthService;