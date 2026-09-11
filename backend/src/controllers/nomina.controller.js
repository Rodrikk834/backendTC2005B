const NominaService = require('../services/nomina.service');

const NominaController = {
  async getNominas(req, res) {
    try {
      const empleadoId = req.user?.id || req.query.empleado_id || 'EP-4091';
      const { anio, mes } = req.query;

      const nominas = await NominaService.getNominasByEmpleado(empleadoId, { anio, mes });
      return res.status(200).json(nominas);
    } catch (error) {
      console.error('Error en NominaController.getNominas:', error);
      return res.status(500).json({ error: 'Error interno del servidor.' });
    }
  },

  async getNominaDetalle(req, res) {
    try {
      const { id } = req.params;
      const empleadoId = req.user?.id || req.query.empleado_id;

      const detalle = await NominaService.getNominaDetalle(id, empleadoId);
      if (!detalle) {
        return res.status(404).json({ error: 'Recibo de nómina no encontrado.' });
      }

      return res.status(200).json(detalle);
    } catch (error) {
      console.error('Error en NominaController.getNominaDetalle:', error);
      return res.status(500).json({ error: 'Error interno del servidor.' });
    }
  }
};

module.exports = NominaController;
