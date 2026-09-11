const EmpleadoService = require('../services/empleado.service');

const EmpleadoController = {
  async getPerfil(req, res) {
    try {
      const empleadoId = req.user?.id || req.query.empleado_id || 'EP-4091';

      const perfil = await EmpleadoService.getPerfil(empleadoId);
      if (!perfil) {
        return res.status(404).json({ error: 'Empleado no encontrado.' });
      }

      return res.status(200).json(perfil);
    } catch (error) {
      console.error('Error en EmpleadoController.getPerfil:', error);
      return res.status(500).json({ error: 'Error interno del servidor.' });
    }
  }
};

module.exports = EmpleadoController;
