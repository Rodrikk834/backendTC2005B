const AuthService = require('../services/auth.service');

const AuthController = {
  async login(req, res) {
    try {
      const { email, username, password } = req.body;
      const loginUser = email || username;

      if (!loginUser || !password) {
        return res.status(400).json({ error: 'El usuario/correo y la contraseña son requeridos.' });
      }

      const sessionData = await AuthService.authenticate(loginUser, password);
      if (!sessionData) {
        return res.status(401).json({ error: 'Credenciales inválidas.' });
      }

      // Si es el primer acceso (contraseña de un solo uso por invitación), se salta el 2FA y se pide completar expediente
      if (sessionData.primer_acceso) {
        return res.status(200).json({
          message: 'Primer acceso detectado. Por favor completa tu expediente y define tu contraseña permanente.',
          primerAcceso: true,
          requiereCompletarRegistro: true,
          token: sessionData.token,
          email: sessionData.email,
          user: {
            id: sessionData.id_empleado || sessionData.id,
            id_usuario: sessionData.id,
            id_empleado: sessionData.id_empleado,
            nombre: sessionData.nombre,
            email: sessionData.email,
            username: sessionData.username,
            rol: sessionData.rol,
            departamento: sessionData.departamento,
            puesto: sessionData.puesto,
            primerAcceso: true,
            primer_acceso: true
          }
        });
      }

      // Si se envió un correo explícito o se usó para el login, lo pasamos como destino prioritario
      const inputEmail = (email && email.includes('@')) ? email.trim() : (loginUser && loginUser.includes('@') ? loginUser.trim() : '');
      const twoFactor = await AuthService.generateTwoFactorCode(sessionData, inputEmail);

      return res.status(200).json({
        message: 'Inicio de sesión exitoso. Se requiere verificación en dos pasos.',
        require2FA: true,
        requires2FA: true,
        email: twoFactor.email,
        codigo2FA: twoFactor.code,
        userId: sessionData.id,
        username: sessionData.username,
        token: sessionData.token,
        user: {
          id: sessionData.id_empleado || sessionData.id,
          id_usuario: sessionData.id,
          id_empleado: sessionData.id_empleado,
          nombre: sessionData.nombre,
          email: twoFactor.email,
          username: sessionData.username,
          rol: sessionData.rol
        }
      });
    } catch (error) {
      console.error('Error en AuthController.login:', error);
      return res.status(500).json({ error: 'Error interno del servidor.' });
    }
  },

  async verify2FA(req, res) {
    try {
      const { code, userId, username, email } = req.body;

      if (!code) {
        return res.status(400).json({ error: 'El código de verificación es requerido.' });
      }

      const result = await AuthService.verifyTwoFactorCode({ userId, username, email, code });
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      return res.status(200).json({
        message: 'Verificación en dos pasos exitosa.',
        verified: true,
        token: result.token,
        user: {
          id: result.user.id_empleado || result.user.id,
          id_usuario: result.user.id,
          id_empleado: result.user.id_empleado,
          nombre: result.user.nombre,
          email: result.user.email,
          username: result.user.username,
          rol: result.user.rol
        }
      });
    } catch (error) {
      console.error('Error en AuthController.verify2FA:', error);
      return res.status(500).json({ error: 'Error interno del servidor.' });
    }
  },

  async resend2FA(req, res) {
    try {
      const { userId, username, email } = req.body;
      const result = await AuthService.resendTwoFactorCode({ userId, username, email });
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      return res.status(200).json({
        success: true,
        message: result.message || 'Código reenviado por correo',
        email: result.email,
        codigo2FA: result.code
      });
    } catch (error) {
      console.error('Error en AuthController.resend2FA:', error);
      return res.status(500).json({ error: 'Error interno del servidor.' });
    }
  }
};

module.exports = AuthController;
