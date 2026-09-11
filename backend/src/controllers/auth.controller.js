const AuthService = require('../services/auth.service');

const AuthController = {
  async login(req, res) {
    try {
      const { email, username, password } = req.body;
      const loginEmail = email || username;

      if (!loginEmail || !password) {
        return res.status(400).json({ error: 'El correo (o usuario) y la contraseña son requeridos.' });
      }

      const sessionData = await AuthService.authenticate(loginEmail, password);
      if (!sessionData) {
        return res.status(401).json({ error: 'Credenciales inválidas.' });
      }

      return res.status(200).json({
        message: 'Inicio de sesión exitoso',
        token: sessionData.token,
        user: {
          id: sessionData.id,
          nombre: sessionData.nombre,
          email: sessionData.email,
          rol: sessionData.rol,
          avatar: sessionData.avatar
        }
      });
    } catch (error) {
      console.error('Error en AuthController.login:', error);
      return res.status(500).json({ error: 'Error interno del servidor.' });
    }
  }
};

module.exports = AuthController;
