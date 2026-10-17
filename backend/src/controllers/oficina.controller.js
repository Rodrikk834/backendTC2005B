const OficinaService = require('../services/oficina.service');

const OficinaController = {

  // GET /api/oficina/inventario/:idUsuario/:ordenUI
  async getInventario(req, res) {
    try {
      const { idUsuario, ordenUI } = req.params;

      if (!idUsuario || ordenUI === undefined) {
        return res.status(400).json({ error: 'Faltan parámetros idUsuario u ordenUI.' });
      }

      const muebles = await OficinaService.obtenerInventario(idUsuario, ordenUI);
      return res.status(200).json({ success: true, muebles });
    } catch (error) {
      return res.status(500).json({ error: 'Error al obtener el inventario.' });
    }
  },

  // GET /api/oficina/:idUsuario
  async getOficina(req, res) {
    try {
      const { idUsuario } = req.params;

      if (!idUsuario) {
        return res.status(400).json({ error: 'El ID del usuario es requerido.' });
      }

      const layout = await OficinaService.obtenerOficina(idUsuario);
      
      if (!layout) {
        // Si no tiene oficina, devolvemos un JSON de oficina vacío por defecto
        return res.status(200).json({ success: true, layout: { muebles: [] } });
      }

      return res.status(200).json({ success: true, layout: JSON.parse(layout) });
    } catch (error) {
      return res.status(500).json({ error: 'Error al obtener la oficina.' });
    }
  },

  // POST /api/oficina/guardar
  async saveOficina(req, res) {
    try {
      const { idUsuario, layoutJson } = req.body;

      if (!idUsuario || !layoutJson) {
        return res.status(400).json({ error: 'El idUsuario y el layoutJson son requeridos.' });
      }

      await OficinaService.guardarOficina(idUsuario, layoutJson);
      
      return res.status(200).json({ success: true, message: 'Oficina guardada correctamente.' });
    } catch (error) {
      return res.status(500).json({ error: 'Error interno al guardar la oficina.' });
    }
  }
};

module.exports = OficinaController;