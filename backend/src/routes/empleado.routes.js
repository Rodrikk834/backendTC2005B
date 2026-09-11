const { Router } = require('express');
const EmpleadoController = require('../controllers/empleado.controller');

const router = Router();
router.get('/perfil', EmpleadoController.getPerfil);

module.exports = router;
