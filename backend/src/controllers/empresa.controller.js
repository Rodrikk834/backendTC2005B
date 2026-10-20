const EmpresaService = require('../services/empresa.service');

const EmpresaController = {
  /**
   * GET /api/empresa/branding
   * Recibe ?empresa_id=X (si no se envía, toma el id_empresa del usuario autenticado)
   */
  async getBranding(req, res) {
    try {
      const empresaIdQuery = req.query.empresa_id || req.query.id || req.query.empresa || req.headers['x-company-id'] || null;
      const targetEmpresa = empresaIdQuery || req.user?.id_empresa || null;

      const branding = await EmpresaService.getBranding(targetEmpresa);
      return res.status(200).json(branding);
    } catch (error) {
      console.error('Error en EmpresaController.getBranding:', error);
      return res.status(500).json({ error: 'Error al consultar el branding de la empresa.' });
    }
  },

  /**
   * PUT /api/empresa/branding
   * Seguridad Multi-Empresa Estricta:
   * Solo el Administrador de su propia empresa puede modificar su marca corporativa
   */
  async updateBranding(req, res) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'Sesión no autorizada para modificar la marca.' });
      }

      const userRole = (user.rol || '').toLowerCase();
      if (!userRole.includes('administrador') && !userRole.includes('admin')) {
        return res.status(403).json({ error: 'Acceso denegado: Se requieren permisos de Administrador.' });
      }

      const adminEmpresaId = user.id_empresa || 1;
      const requestedEmpresaId = req.body.empresa_id || req.body.empresaId || req.query.empresa_id || null;

      // REGLA DE AISLAMIENTO MULTI-EMPRESA ESTRICTA:
      // Si se envía un ID de empresa y es distinto a la empresa a la que pertenece el Admin, se rechaza
      if (requestedEmpresaId && parseInt(requestedEmpresaId, 10) !== parseInt(adminEmpresaId, 10)) {
        return res.status(403).json({
          error: `Violación de aislamiento multi-empresa: Tu usuario pertenece a la empresa con ID ${adminEmpresaId} y no tienes permiso para modificar empresas ajenas.`
        });
      }

      const result = await EmpresaService.updateBrandingByEmpresaId(adminEmpresaId, req.body);
      return res.status(200).json(result);
    } catch (error) {
      console.error('Error en EmpresaController.updateBranding:', error);
      return res.status(400).json({
        error: error.message || 'Error al actualizar la marca corporativa.'
      });
    }
  },

  /**
   * GET /api/empresa/lista
   */
  async getListaEmpresas(req, res) {
    try {
      const empresas = await EmpresaService.getListaEmpresas();
      return res.status(200).json(empresas);
    } catch (error) {
      console.error('Error en EmpresaController.getListaEmpresas:', error);
      return res.status(500).json({ error: 'Error al listar las empresas.' });
    }
  }
};

module.exports = EmpresaController;
