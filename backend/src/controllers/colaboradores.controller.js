const ColaboradoresService = require('../services/colaboradores.service');

const ColaboradoresController = {
  /**
   * POST /api/colaboradores/invitar
   */
  async invitar(req, res) {
    try {
      const { email, rol, departamento, puesto, invitadoPorId, invitadoPorNombre } = req.body;

      if (!email || !email.trim()) {
        return res.status(400).json({ error: 'El correo del colaborador es obligatorio.' });
      }

      const colaborador = await ColaboradoresService.invitarColaborador({
        email,
        rol,
        departamento,
        puesto,
        invitadoPorId,
        invitadoPorNombre
      });

      return res.status(201).json({
        success: true,
        message: 'Invitación y contraseña de un solo uso generadas exitosamente.',
        colaborador
      });
    } catch (error) {
      console.error('Error en ColaboradoresController.invitar:', error);
      return res.status(400).json({
        error: error.message || 'Error al procesar la invitación del colaborador.'
      });
    }
  },

  /**
   * GET /api/colaboradores
   */
  async getColaboradores(req, res) {
    try {
      const { departamento } = req.query;
      const colaboradores = await ColaboradoresService.getColaboradores({ departamento });
      return res.status(200).json(colaboradores);
    } catch (error) {
      console.error('Error en ColaboradoresController.getColaboradores:', error);
      return res.status(500).json({
        error: 'Error al consultar la lista de colaboradores.'
      });
    }
  },

  /**
   * POST /api/completar-registro y POST /api/colaboradores/completar-registro
   */
  async completarRegistro(req, res) {
    try {
      const {
        userId,
        email,
        password,
        nombre,
        paterno,
        materno,
        rfc,
        curp,
        imss,
        telefono,
        banco,
        clabe_interbancaria,
        numero_cuenta
      } = req.body;

      const resultado = await ColaboradoresService.completarRegistro({
        userId,
        email,
        password,
        nombre,
        paterno,
        materno,
        rfc,
        curp,
        imss,
        telefono,
        banco,
        clabe_interbancaria,
        numero_cuenta
      });

      return res.status(200).json(resultado);
    } catch (error) {
      console.error('Error en ColaboradoresController.completarRegistro:', error);
      return res.status(400).json({
        error: error.message || 'Error al completar el expediente del colaborador.'
      });
    }
  }
};

module.exports = ColaboradoresController;
