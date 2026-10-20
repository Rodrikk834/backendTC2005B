const SolicitudesService = require('../services/solicitudes.service');

const SolicitudesController = {
  async getSolicitudes(req, res) {
    try {
      const empleadoId = req.user?.id_empleado || req.user?.id || req.query.empleado_id || 1;
      const solicitudes = await SolicitudesService.getSolicitudesByEmpleado(empleadoId);
      return res.status(200).json(solicitudes);
    } catch (error) {
      console.error('Error en SolicitudesController.getSolicitudes:', error);
      return res.status(500).json({ error: 'Error interno al consultar solicitudes.' });
    }
  },

  async getSolicitudesEquipo(req, res) {
    try {
      const jefeId = req.query.jefe_id || req.user?.id_empleado || req.user?.id || 1;
      const { estatus, departamento_id } = req.query;
      const resultado = await SolicitudesService.getSolicitudesEquipo(jefeId, { estatus, departamento_id });
      return res.status(200).json(resultado);
    } catch (error) {
      console.error('Error en SolicitudesController.getSolicitudesEquipo:', error);
      return res.status(500).json({ error: 'Error interno al consultar solicitudes del equipo.' });
    }
  },

  async getSolicitudDetalle(req, res) {
    try {
      const { id } = req.params;
      const solicitud = await SolicitudesService.getSolicitudById(id);
      if (!solicitud) {
        return res.status(404).json({ error: 'Solicitud no encontrada.' });
      }
      return res.status(200).json(solicitud);
    } catch (error) {
      console.error('Error en SolicitudesController.getSolicitudDetalle:', error);
      return res.status(500).json({ error: 'Error interno al consultar detalle de solicitud.' });
    }
  },

  async createSolicitud(req, res) {
    try {
      const empleadoId = req.user?.id_empleado || req.user?.id || req.body.empleado_id || 1;
      const { tipo, datos } = req.body;

      if (!tipo) {
        return res.status(400).json({ error: 'El campo "tipo" es obligatorio.' });
      }

      const nuevaSolicitud = await SolicitudesService.createSolicitud({
        empleado_id: empleadoId,
        tipo,
        datos: datos || req.body
      });

      return res.status(201).json({
        message: 'Solicitud creada exitosamente.',
        solicitud: nuevaSolicitud
      });
    } catch (error) {
      console.error('Error en SolicitudesController.createSolicitud:', error);
      return res.status(500).json({ error: 'Error interno al crear solicitud.' });
    }
  },

  async aprobarSolicitud(req, res) {
    try {
      const { id } = req.params;
      const autorizadorId = req.body.autorizador_id || req.user?.id_empleado || req.user?.id || 1;

      const solicitud = await SolicitudesService.aprobarSolicitud(id, autorizadorId);
      if (!solicitud) {
        return res.status(404).json({ error: 'Solicitud no encontrada.' });
      }

      return res.status(200).json({
        message: 'Solicitud aprobada exitosamente.',
        solicitud
      });
    } catch (error) {
      console.error('Error en SolicitudesController.aprobarSolicitud:', error);
      return res.status(400).json({ error: error.message || 'Error interno al aprobar solicitud.' });
    }
  },

  async rechazarSolicitud(req, res) {
    try {
      const { id } = req.params;
      const autorizadorId = req.body.autorizador_id || req.user?.id_empleado || req.user?.id || 1;
      const { motivo_rechazo } = req.body;

      const solicitud = await SolicitudesService.rechazarSolicitud(id, autorizadorId, motivo_rechazo);
      if (!solicitud) {
        return res.status(404).json({ error: 'Solicitud no encontrada.' });
      }

      return res.status(200).json({
        message: 'Solicitud rechazada exitosamente.',
        solicitud
      });
    } catch (error) {
      console.error('Error en SolicitudesController.rechazarSolicitud:', error);
      return res.status(400).json({ error: error.message || 'Error interno al rechazar solicitud.' });
    }
  }
};

module.exports = SolicitudesController;
