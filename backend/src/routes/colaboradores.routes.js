const { Router } = require('express');
const ColaboradoresController = require('../controllers/colaboradores.controller');

const router = Router();

// Endpoint para invitar a un nuevo colaborador
router.post('/invitar', ColaboradoresController.invitar);

// Endpoint para listar colaboradores
router.get('/', ColaboradoresController.getColaboradores);

// Endpoint para completar expediente y onboarding
router.post('/completar-registro', ColaboradoresController.completarRegistro);

module.exports = router;
