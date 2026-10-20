const { Router } = require('express');
const EmpresaController = require('../controllers/empresa.controller');
const { verifyToken, requireAdmin } = require('../middlewares/auth.middleware');

const router = Router();

// GET /api/empresa/branding: Público / Autenticado (toma ?empresa_id=X o la empresa del usuario)
router.get('/branding', (req, res, next) => {
  if (req.headers['authorization']) {
    return verifyToken(req, res, () => EmpresaController.getBranding(req, res));
  }
  return EmpresaController.getBranding(req, res);
});

// PUT /api/empresa/branding: Requiere autenticación con verifyToken y rol Administrador
// Regla de aislamiento estricta: Solo puede modificar la empresa a la que pertenece
router.put('/branding', verifyToken, requireAdmin, EmpresaController.updateBranding);

// Directorio de empresas registradas
router.get('/lista', EmpresaController.getListaEmpresas);
router.get('/empresas', EmpresaController.getListaEmpresas);

module.exports = router;
