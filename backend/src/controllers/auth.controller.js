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

      return res.status(200).json({
        message: 'Inicio de sesión exitoso',
        token: sessionData.token,
        user: {
          id: sessionData.id_empleado || sessionData.id,
          nombre: sessionData.nombre,
          email: sessionData.email,
          username: sessionData.username,
          rol: sessionData.rol
        }
      });
    } catch (error) {
      console.error('Error en AuthController.login:', error);
      return res.status(500).json({ error: 'Error interno del servidor.' });
    }
  }
};

module.exports = AuthController;
