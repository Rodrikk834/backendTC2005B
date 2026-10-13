const AsistenciaService = require('../services/asistencia.service');

const AsistenciaController = {
  async getAsistencia(req, res) {
    try {
      const empleadoId = req.user?.id_empleado || req.user?.id || req.query.empleado_id || 1;
      const { anio, mes } = req.query;

      const asistencia = await AsistenciaService.getAsistenciaByEmpleado(empleadoId, { anio, mes });
      return res.status(200).json(asistencia);
    } catch (error) {
      console.error('Error en AsistenciaController.getAsistencia:', error);
      return res.status(500).json({ error: 'Error interno al consultar asistencia.' });
    }
  },

  async getBitacora(req, res) {
    try {
      const empleadoId = req.user?.id_empleado || req.user?.id || req.query.empleado_id || 1;
      const bitacoraData = await AsistenciaService.getBitacoraByEmpleado(empleadoId);
      return res.status(200).json(bitacoraData);
    } catch (error) {
      console.error('Error en AsistenciaController.getBitacora:', error);
      return res.status(500).json({ error: 'Error interno al consultar bitácora de asistencia.' });
    }
  }
};

module.exports = AsistenciaController;
